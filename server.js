require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const helmet = require('helmet')
const pgSession = require('connect-pg-simple')(session)
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

// เชื่อ header X-Forwarded-* จาก reverse proxy ชั้นเดียว (Render/Railway/nginx ที่ทำ HTTPS ให้หน้าเว็บ) - ถ้าไม่เปิดไว้ req.protocol จะเป็น http เสมอแม้ผู้ใช้เข้าผ่าน https จริง ทำให้ลิงก์ QR เช็คอินสอบ (ดู buildCheckinUrl ใน oralExamSessionController.js) ผิดเป็น http:// ทั้งที่เว็บเป็น https:// และ cookie secure ก็จะไม่ยอมส่งตามไปด้วย
app.set('trust proxy', 1)

app.use(helmet({
    // ปิด CSP ของ helmet ไว้ก่อน เพราะหน้าเว็บโหลดสคริปต์/ฟอนต์จากหลาย origin (Google Fonts ฯลฯ) นโยบาย default ของ helmet เข้มเกินจะพังของเดิมทันที ต้องออกแบบ CSP เฉพาะทีหลังถ้าจะเปิด
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}))
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
        sameSite: 'lax', // กัน CSRF ระดับหนึ่ง (ทุก endpoint ใช้ cookie auth) โดยไม่พังลิงก์ข้ามเว็บแบบคลิกเปิดปกติ (เช่นลิงก์ QR เช็คอินสอบที่เปิดจากแอปกล้อง/แอปแชท)
        secure: isProduction, // ต้องเข้าผ่าน https เท่านั้นถึงส่ง cookie ตอนโปรดักชัน (dev/local เป็น http ธรรมดาต้องปล่อย false ไม่งั้น cookie จะไม่ติดเลย)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
    },
}))

// เก็บสถิติการใช้งาน (นับใน memory เขียนลง DB ทุก 1 นาที) ต้องอยู่หลัง session ถึงจะรู้ role ของผู้ใช้ และก่อน static เพื่อนับการเปิดหน้าเว็บด้วย
app.use(usageTracker)

// WebManager ยังเข้า /admin ได้เสมอ (สิทธิ์สูงสุด) ต่างจาก /staff กับ /participant ที่ตอนนี้กันไม่ให้ Owner ค้างอยู่แล้ว (ดู requireStaffPage/requireParticipantPage) เพราะ /admin ไม่ใช่หน้าตัวตนของพี่ค่ายคนใดคนหนึ่ง แต่เป็นแผงควบคุมสิทธิ์ผู้ดูแลระบบที่ WebManager มอบให้พี่ค่ายได้อยู่แล้ว
function requireAdminPage(req, res, next) {
    if (req.path === '/' || req.path === '/index.html') {
        const user = req.session && req.session.user
        const hasAdminAccess = user && ((user.role === 'STAFF' && user.isAdmin) || user.role === 'WEBMANAGER')
        if (!hasAdminAccess) {
            return res.redirect('/')
        }
    }
    next()
}

// /webmanager แยกออกจาก /admin โดยสิ้นเชิง เข้าได้เฉพาะ WEBMANAGER (สิทธิ์สูงสุด) เท่านั้น ไม่ใช่ผู้ใช้ที่ล็อกอินก็เด้งไปหน้า login ของตัวเอง ไม่ใช่หน้าแรกเว็บหลัก
function requireWebManagerPage(req, res, next) {
    if (req.path === '/' || req.path === '/index.html') {
        const user = req.session && req.session.user
        const hasWebManagerAccess = user && user.role === 'WEBMANAGER'
        if (!hasWebManagerAccess) {
            return res.redirect('/webmanager/login')
        }
    }
    next()
}

// ครอบทั้ง mount /staff (ไม่ใช่แค่ index.html) เพราะตอนนี้มีหน้าย่อยอย่าง profile.html ด้วย
// ไฟล์ static ที่หน้าพี่ค่ายอ้างอิง (css/js/assets) ทั้งหมดอยู่นอก /staff อยู่แล้วจึงไม่กระทบ
// WebManager ไม่ให้ค้างอยู่หน้านี้อีกต่อไป (เดิมเข้าได้เพื่อสวมรอยดูมุมมองพี่ค่าย) เด้งกลับ /webmanager/ แทนเสมอ - ใช้บัญชีพี่ค่ายทดสอบจริงแทนถ้าต้องการดูมุมมองนี้
function requireStaffPage(req, res, next) {
    const user = req.session && req.session.user
    if (user && user.role === 'WEBMANAGER') {
        return res.redirect('/webmanager/')
    }
    if (!user || user.role !== 'STAFF') {
        return res.redirect('/')
    }
    next()
}

// ครอบทั้ง mount /participant เหมือนกับ /staff (มี index.html และ profile.html) - WebManager เด้งกลับ /webmanager/ เหมือนกัน (ดูเหตุผลใน requireStaffPage)
function requireParticipantPage(req, res, next) {
    const user = req.session && req.session.user
    if (user && user.role === 'WEBMANAGER') {
        return res.redirect('/webmanager/')
    }
    if (!user || user.role !== 'PARTICIPANT') {
        return res.redirect('/')
    }
    next()
}

// พี่ค่าย/น้องค่าย/Owner ที่ login อยู่ ไม่ว่าจะพยายามเข้าหน้าแรกด้วยวิธีไหนก็ให้เด้งกลับไปหน้าของตัวเองเสมอ
// ไม่กระทบคนที่ยังไม่ login เข้าหน้าแรกได้ปกติ (user เป็น undefined เงื่อนไขทั้งหมดข้างล่างจึงไม่เข้า)
function keepStaffOnStaffPage(req, res, next) {
    if (req.path === '/' || req.path === '/index.html') {
        // iframe "ตัวอย่างหน้าเว็บหลัก" ในแผง WebManager (หน้าแรก) โหลด src="/?preview=1" ตั้งใจข้าม redirect นี้
        // ไม่งั้น session cookie ของ WebManager/พี่ค่าย/น้องค่ายที่ล็อกอินอยู่จะโดนเด้งกลับไปหน้าแผงของตัวเอง กลายเป็นโหลดทั้งแอปซ้อนอยู่ในกรอบพรีวิวเอง (วนไม่รู้จบ)
        if (req.query.preview === '1') return next()
        const user = req.session && req.session.user
        if (user && user.role === 'STAFF') {
            return res.redirect('/staff/')
        }
        if (user && user.role === 'PARTICIPANT') {
            return res.redirect('/participant/')
        }
        if (user && user.role === 'WEBMANAGER') {
            return res.redirect('/webmanager/')
        }
    }
    next()
}

// เปลี่ยนทุก URL ที่ลงท้าย .html ให้ redirect (301) ไปหาแบบไม่มีนามสกุลเสมอ ให้ที่อยู่บนเบราว์เซอร์สะอาด ("/staff/academic" แทน "/staff/academic.html")
// "index.html" พับรวมเป็น path ของโฟลเดอร์แม่ไปเลย ("/webmanager/index.html" -> "/webmanager/", "/index.html" -> "/") - ต้องอยู่ก่อน static ทุกตัวเสมอ
function redirectHtmlExtension(req, res, next) {
    if (!req.path.endsWith('.html')) return next()
    const withoutExt = req.path.slice(0, -5)
    const clean = withoutExt.endsWith('/index') ? (withoutExt.slice(0, -5) || '/') : withoutExt
    if (clean === req.path) return next()
    const queryIndex = req.originalUrl.indexOf('?')
    const query = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex)
    res.redirect(301, clean + query)
}

app.use(redirectHtmlExtension)
app.use(keepStaffOnStaffPage)
// extensions: ['html'] ให้ "/staff/academic" เสิร์ฟไฟล์ academic.html ได้ตรง ๆ โดยไม่ต้องมี .html ใน URL (ยังเสิร์ฟ index.html อัตโนมัติที่ path โฟลเดอร์เหมือนเดิมอยู่แล้ว)
app.use(express.static(path.join(__dirname, 'fontend', 'public'), { extensions: ['html'] }))
app.use('/assets', express.static(path.join(__dirname, 'fontend', 'assets')))
app.use('/backend/uploads', express.static(path.join(__dirname, 'backend', 'uploads')))
app.use('/media', mediaRoutes)
app.use('/admin', requireAdminPage, express.static(path.join(__dirname, 'fontend', 'admin'), { extensions: ['html'] }))
app.use('/webmanager', requireWebManagerPage, express.static(path.join(__dirname, 'fontend', 'webmanager'), { extensions: ['html'] }))
app.use('/staff', requireStaffPage, express.static(path.join(__dirname, 'fontend', 'staff'), { extensions: ['html'] }))
app.use('/participant', requireParticipantPage, express.static(path.join(__dirname, 'fontend', 'participant'), { extensions: ['html'] }))

// หน้าแรกของพี่ค่าย/น้องค่ายใช้ไฟล์เดียวกับหน้าแรกสาธารณะ (fontend/public/index.html) ไม่มีสำเนาแยกในโฟลเดอร์ fontend/staff, fontend/participant แล้ว
// เนื้อหาปรับตาม role ด้วย JS ฝั่ง client (auth.js) - requireStaffPage/requireParticipantPage ยังกันคนละ role เข้าไม่ได้เหมือนเดิม
app.get('/staff/', requireStaffPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'fontend', 'public', 'index.html'))
})
app.get('/participant/', requireParticipantPage, (req, res) => {
    res.sendFile(path.join(__dirname, 'fontend', 'public', 'index.html'))
})

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
