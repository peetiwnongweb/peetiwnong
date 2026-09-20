require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const helmet = require('helmet')
const compression = require('compression')
const pgSession = require('connect-pg-simple')(session)
const cors = require('cors')
const presidentsRoutes = require('./backend/routes/presidentsRoutes')
const newsRoutes = require('./backend/routes/newsRoutes')
const authRoutes = require('./backend/routes/authRoutes')
const activityLogRoutes = require('./backend/routes/activityLogRoutes')
const scheduleRoutes = require('./backend/routes/scheduleRoutes')
const userRoutes = require('./backend/routes/userRoutes')
const lookupsRoutes = require('./backend/routes/lookupsRoutes')
const siteSettingsRoutes = require('./backend/routes/siteSettingsRoutes')
const galleryRoutes = require('./backend/routes/galleryRoutes')
const campActivityRoutes = require('./backend/routes/campActivityRoutes')
const groupRoutes = require('./backend/routes/groupRoutes')
const subjectRoutes = require('./backend/routes/subjectRoutes')
const subjectScoreRoutes = require('./backend/routes/subjectScoreRoutes')
const gradeBandRoutes = require('./backend/routes/gradeBandRoutes')
const scoreWeightSettingRoutes = require('./backend/routes/scoreWeightSettingRoutes')
const campRoutes = require('./backend/routes/campRoutes')
const classScheduleRoutes = require('./backend/routes/classScheduleRoutes')
const studyDocumentRoutes = require('./backend/routes/studyDocumentRoutes')
const oralExamSessionRoutes = require('./backend/routes/oralExamSessionRoutes')
const oralExamScoreBandRoutes = require('./backend/routes/oralExamScoreBandRoutes')
const mediaRoutes = require('./backend/routes/mediaRoutes')
const { isDriveConfigured } = require('./backend/lib/googleDrive')
const { runBackup } = require('./backend/lib/campBackup')
const { getPrisma, getDbPool } = require('./backend/lib/prisma')
const { cleanupOldLogs } = require('./backend/lib/logRetention')
const { usageTracker, startUsageFlushScheduler } = require('./backend/middleware/usageTracker')
const { recordDailyUsageSnapshot } = require('./backend/lib/usageSnapshot')
const dashboardRoutes = require('./backend/routes/dashboardRoutes')
const { requireActiveCamp } = require('./backend/middleware/requireAuth')
const isProduction = process.env.NODE_ENV === 'production'

// กันลืมตั้ง SESSION_SECRET จริงตอนขึ้นโปรดักชัน (ค่า fallback ใช้ได้แค่ตอน dev/local เท่านั้น เดาได้เพราะอยู่ในซอร์สโค้ด)
if (isProduction && !process.env.SESSION_SECRET) {
    console.error('ต้องตั้งค่า SESSION_SECRET ก่อนรันโปรดักชัน (ห้ามใช้ค่า fallback ที่เดาได้จากซอร์สโค้ด)')
    process.exit(1)
}

const app = express()

// CORS configuration to allow cross-origin requests from Cloudflare Pages or frontend domains
app.use(cors({
    origin: process.env.FRONTEND_URL || true, // Allow frontend domain or allow all if not set
    credentials: true // Allow cookies to be sent
}))

// เชื่อ header X-Forwarded-* จาก reverse proxy ชั้นเดียว (Render/Railway/nginx ที่ทำ HTTPS ให้หน้าเว็บ) - ถ้าไม่เปิดไว้ req.protocol จะเป็น http เสมอแม้ผู้ใช้เข้าผ่าน https จริง ทำให้ลิงก์ QR เช็คอินสอบ (ดู buildCheckinUrl ใน oralExamSessionController.js) ผิดเป็น http:// ทั้งที่เว็บเป็น https:// และ cookie secure ก็จะไม่ยอมส่งตามไปด้วย
app.set('trust proxy', 1)

app.use(helmet({
    // ปิด CSP ของ helmet ไว้ก่อน เพราะหน้าเว็บโหลดสคริปต์/ฟอนต์จากหลาย origin (Google Fonts ฯลฯ) นโยบาย default ของ helmet เข้มเกินจะพังของเดิมทันที ต้องออกแบบ CSP เฉพาะทีหลังถ้าจะเปิด
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
// บีบอัด response ด้วย gzip ก่อนส่ง (HTML/CSS/JS/JSON เล็กลง 60-80%) เดิมไม่มี middleware นี้เลยส่งไฟล์ข้อความทุกไฟล์แบบไม่บีบอัด
// รูปภาพ (/media/*) ไม่โดนกระทบ - compression filter ค่าเริ่มต้นข้าม content-type ที่บีบอัดไปแล้วอยู่แล้ว (image/*) ให้เอง
app.use(compression())
app.use(express.json())

// เก็บ session ลง Postgres ตัวเดียวกับข้อมูลอื่น (ตาราง session สร้างอัตโนมัติถ้ายังไม่มี) แทน MemoryStore เดิม
// กัน login หลุดทุกครั้งที่เซิร์ฟเวอร์รีสตาร์ท (deploy ใหม่/เครื่อง crash/nodemon รีโหลดตอน dev) ซึ่งเดิมทำให้ maxAge 7 วันไม่มีความหมายจริงในทางปฏิบัติ
// ใช้ pool เดียวกับ Prisma (ดู backend/lib/prisma.js) ห้ามเปิด Pool แยก - Supabase session mode จำกัด 15 connection รวมทุกฝั่ง
app.use(session({
    store: new pgSession({ pool: getDbPool(), tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax', // ต้องเป็น 'none' เพราะ Frontend และ Backend อยู่คนละ Domain (cross-site)
        secure: isProduction, // ต้องเข้าผ่าน https เท่านั้นถึงส่ง cookie ตอนโปรดักชัน (dev/local เป็น http ธรรมดาต้องปล่อย false ไม่งั้น cookie จะไม่ติดเลย)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
    },
}))

// เก็บสถิติการใช้งาน (นับใน memory เขียนลง DB ทุก 1 นาที) ต้องอยู่หลัง session ถึงจะรู้ role ของผู้ใช้ และก่อน static เพื่อนับการเปิดหน้าเว็บด้วย
app.use(usageTracker)

// ไฟล์ CSS/JS ส่วนใหญ่อ้างด้วย query string ?v=วันที่-เลขรัน (cache-busting) แต่ไม่ครบ 100% ทั้งเว็บ (เจอจริงระหว่างแก้วันนี้ - news.js/loader.js/modal.css ไม่มี ?v= ทำให้เห็นโค้ดเก่าค้างหลัง deploy)
// จึงเช็คจาก query string ของคำขอจริงแทนการเดาจากนามสกุลไฟล์อย่างเดียว: มี ?v= แปลว่ามั่นใจว่า cache-bust ได้แน่ (path เปลี่ยนทุกครั้งที่เนื้อหาเปลี่ยน) ให้ cache ยาวได้เต็มที่
// ไม่มี ?v= (ไฟล์ไหนก็ตามที่ยังไม่ได้ใส่/ลืมใส่) ให้ cache สั้นแค่ 5 นาทีไว้ก่อน กันเห็นโค้ดเก่าค้างนานเกินไปโดยไม่ต้องไล่หาทุกจุดที่ยังไม่ได้ใส่ ?v= ให้ครบ
function setStaticCacheHeaders(res, filePath) {
    const isVersioned = /[?&]v=/.test(res.req.originalUrl || '')
    if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
    } else if (/\.(png|jpe?g|svg|webp|ico|woff2?|ttf)$/i.test(filePath)) {
        res.setHeader('Cache-Control', isVersioned ? 'public, max-age=31536000, immutable' : 'public, max-age=86400')
    }
}

app.use('/backend/uploads', express.static(path.join(__dirname, 'backend', 'uploads'), { setHeaders: setStaticCacheHeaders }))
app.use('/media', mediaRoutes)

app.use('/api/auth', authRoutes)
app.use('/api/presidents', presidentsRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/activity-logs', activityLogRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/users', userRoutes)
app.use('/api/lookups', lookupsRoutes)
app.use('/api/site-settings', siteSettingsRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/camps', campRoutes)

// ระบบวิชาการ + ระบบกิจกรรมทั้งหมดใช้ได้เฉพาะตอนมีค่ายที่กำลังดำเนินการ (สร้างค่าย + กำหนดตำแหน่งแล้ว ยังไม่กดจบค่าย) - ดู requireActiveCamp
// ก่อนหน้านั้นพี่ค่ายทุกคนเป็น "ทีมงานค่าย" ไม่มีสิทธิ์ และยังไม่มีน้องค่าย จึงไม่มีอะไรให้ระบบพวกนี้ทำ ล็อกทั้งก้อนไว้ให้ชัดเจนแทนที่จะเปิดให้เห็นหน้าว่าง ๆ
app.use([
    '/api/camp-activities', '/api/groups', '/api/subjects', '/api/subject-scores', '/api/grade-bands', '/api/score-weight-setting',
    '/api/class-schedules', '/api/study-documents', '/api/oral-exam-sessions', '/api/oral-exam-score-bands',
], requireActiveCamp)
app.use('/api/camp-activities', campActivityRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/subject-scores', subjectScoreRoutes)
app.use('/api/grade-bands', gradeBandRoutes)
app.use('/api/score-weight-setting', scoreWeightSettingRoutes)
app.use('/api/class-schedules', classScheduleRoutes)
app.use('/api/study-documents', studyDocumentRoutes)
app.use('/api/oral-exam-sessions', oralExamSessionRoutes)
app.use('/api/oral-exam-score-bands', oralExamScoreBandRoutes)
app.use('/api/dashboard', dashboardRoutes)

// /api/* ที่ไม่ตรง route ไหนเลย ให้ตอบ JSON แทนที่จะร่วงไปเจอ static handler ของ index.html (จะได้ error ที่อ่านออกตอนเรียก endpoint ผิด/พิมพ์ path ผิด แทนที่จะได้ HTML กลับมาเงียบ ๆ)
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'ไม่พบ endpoint นี้' })
})

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' })
})

const port = process.env.PORT || 5000
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`)
    initBackupScheduler()
    initLogCleanupScheduler()
    startUsageFlushScheduler()
    initUsageSnapshotScheduler()
})

// ==========================================
// ตัวตั้งเวลาสำรองข้อมูลอัตโนมัติขึ้น Google Drive (ดู backend/lib/campBackup.js)
// ข้ามตัวเองทั้งหมดถ้ายังไม่ได้ตั้งค่า Google Drive ใน .env เพื่อไม่ให้ dev/local ที่ไม่ได้ตั้งค่าไว้ต้องพังหรือเห็น error รบกวน
// ไม่ต้องกันรอบซ้อนที่นี่ - runBackup() มี mutex ของตัวเองแล้ว ครอบคลุมทุกทาง (ปุ่มกดเอง/ตัวตั้งเวลา/ก่อนสร้างค่ายใหม่)
// ==========================================
async function runScheduledBackupIfConfigured() {
    if (!isDriveConfigured()) return
    try {
        await runBackup({ trigger: 'SCHEDULED' })
    } catch (error) {
        console.error('สำรองข้อมูลอัตโนมัติล้มเหลว:', error)
    }
}

// nodemon restart ระหว่างสำรองข้อมูลจะทิ้งแถวสถานะ PENDING ค้างไว้ถาวร กวาดล้างให้เป็น FAILED ตอนบูตเซิร์ฟเวอร์ใหม่ทุกครั้ง
async function sweepStalePendingBackups() {
    try {
        const prisma = await getPrisma()
        const staleBefore = new Date(Date.now() - 2 * 60 * 60 * 1000)
        await prisma.campBackupRun.updateMany({
            where: { status: 'PENDING', startedAt: { lt: staleBefore } },
            data: { status: 'FAILED', errorMessage: 'เซิร์ฟเวอร์รีสตาร์ตระหว่างสำรองข้อมูล', finishedAt: new Date() },
        })
    } catch (error) {
        console.error('กวาดล้างสถานะสำรองข้อมูลค้างไม่สำเร็จ:', error)
    }
}

function initBackupScheduler() {
    if (!isDriveConfigured()) return
    sweepStalePendingBackups()

    const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS) || 12
    setTimeout(() => {
        runScheduledBackupIfConfigured()
        setInterval(runScheduledBackupIfConfigured, intervalHours * 60 * 60 * 1000)
    }, 60 * 1000)
}

// ==========================================
// ตัวตั้งเวลาล้าง log เก่า + ไฟล์ Drive ที่ไม่ได้ใช้แล้วอัตโนมัติ (ดู backend/lib/logRetention.js, backend/lib/driveRetention.js)
// กันตาราง ActivityLog/CampBackupRun และไฟล์สำรองใน Drive โตไม่มีที่สิ้นสุด รันวันละครั้งพอ ไม่ต้องถี่
// ส่วน log ทำงานเสมอไม่ขึ้นกับ Google Drive แต่ส่วนไฟล์ Drive จะข้ามตัวเองถ้ายังไม่ได้ตั้งค่า Drive/Supabase Storage ครบ
// ==========================================
function initLogCleanupScheduler() {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    setTimeout(() => {
        runLogCleanup()
        setInterval(runLogCleanup, ONE_DAY_MS)
    }, 90 * 1000)
}

async function runLogCleanup() {
    try {
        const { activityLogDeleted, campBackupRunDeleted, usageStatsDeleted } = await cleanupOldLogs()
        if (activityLogDeleted > 0 || campBackupRunDeleted > 0 || usageStatsDeleted > 0) {
            console.log(`ล้าง log เก่า: ActivityLog ${activityLogDeleted} แถว, CampBackupRun ${campBackupRunDeleted} แถว, สถิติการใช้งาน ${usageStatsDeleted} แถว`)
        }
    } catch (error) {
        console.error('ล้าง log เก่าไม่สำเร็จ:', error)
    }
}

// ==========================================
// ถ่ายภาพขนาดฐานข้อมูล/พื้นที่เก็บไฟล์วันละครั้ง (ดู backend/lib/usageSnapshot.js) ให้แดชบอร์ด "การใช้งานเว็บไซต์" ดูอัตราการโตย้อนหลังได้
// รันหลังบูต 2 นาที (ไม่แย่ง connection กับตอนเริ่มเซิร์ฟเวอร์) แล้วซ้ำทุก 24 ชม. - เป็น upsert ของ "วันนี้" รันซ้ำวันเดียวกันได้ไม่เกิดแถวซ้ำ
// ==========================================
function initUsageSnapshotScheduler() {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    const run = () => recordDailyUsageSnapshot().catch((error) => console.error('ถ่าย snapshot สถิติฐานข้อมูลไม่สำเร็จ:', error?.message || error))
    setTimeout(() => {
        run()
        setInterval(run, ONE_DAY_MS)
    }, 2 * 60 * 1000)
}
