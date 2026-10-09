const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { isAcademicManager } = require('../middleware/requireAuth');
const { generateSessionToken, ensureOralExamScoreBands, resolveAttemptScorePercent } = require('../lib/oralExam');
const { buildParticipantCode } = require('../lib/camp');
const { resolveParticipantWhere } = require('../lib/participantSimulation');

// คำนำหน้าชื่อติดกับชื่อจริงไม่มีเว้นวรรค (เหมือน subjectScoreController.js)
function toFullName(profile) {
  const prefixedFirstName = `${profile.prefix || ''}${profile.firstName || ''}`;
  return [prefixedFirstName, profile.lastName].filter(Boolean).join(' ') || '-';
}

// เปิด/ประเมิน/ปิดรอบสอบวิชานี้ได้เฉพาะหัวหน้าฝ่ายวิชาการ/ผู้บริหารค่าย หรือผู้สอนที่รับผิดชอบวิชานั้นจริง (เหมือน saveParticipantScores/updateSubject)
function canManageSubjectExam(user, subject) {
  return isAcademicManager(user) || subject.instructors.some((i) => i.userId === user.id);
}

function buildCheckinUrl(req, token) {
  return `${req.protocol}://${req.get('host')}/html/exam-checkin.html?token=${encodeURIComponent(token)}`;
}

const LOGO_PATH = path.join(__dirname, '../../fontend/assets/images/logo/logo1.png');
const QR_SIZE = 480;
// ป้ายขาวรองหลังโลโก้กันโลโก้โปร่งใส/มีขอบไม่เรียบไปกลืนกับลาย QR สีดำรอบ ๆ - ต้องเผื่อขอบขาวกว้างกว่าตัวโลโก้เล็กน้อย (ไม่ใช่แปะโลโก้ทับตรง ๆ)
const LOGO_BADGE_SIZE = Math.round(QR_SIZE * 0.22);
const LOGO_SIZE = Math.round(LOGO_BADGE_SIZE * 0.92);

// ฝังโลโก้ค่ายลงตรงกลางรูป QR จริง ๆ ด้วย sharp (ไม่ใช่แค่ซ้อนทับด้วย CSS ฝั่ง frontend) เพื่อให้รูปที่ได้เป็นไฟล์เดียวสมบูรณ์ ดาวน์โหลด/บันทึกแยกไปใช้ที่อื่นก็ยังมีโลโก้ติดมาด้วย
// ต้องคู่กับ errorCorrectionLevel: 'H' ตอนสร้าง QR เสมอ (รองรับส่วนที่ถูกบังได้สูงสุด ~30% - ป้ายโลโก้ที่ 24% ของขนาด QR ยังเผื่อระยะปลอดภัยไว้พอสมควร) ไม่งั้นสแกนไม่ติด
async function buildQrWithLogo(qrPayload) {
  const qrBuffer = await QRCode.toBuffer(qrPayload, { margin: 1, width: QR_SIZE, errorCorrectionLevel: 'H' });

  const logoResized = await sharp(LOGO_PATH)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  const badge = await sharp({
    create: {
      width: LOGO_BADGE_SIZE,
      height: LOGO_BADGE_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoResized, gravity: 'center' }])
    .png()
    .toBuffer();

  const composited = await sharp(qrBuffer)
    .composite([{ input: badge, gravity: 'center' }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${composited.toString('base64')}`;
}

// ชื่อคอร์สที่รอบนี้รับเช็คอิน: รอบที่ระบุคอร์สไว้ใช้คอร์สนั้น รอบเก่าที่เปิดก่อนมีช่องคอร์ส (courseFormatId: null) รับตามคอร์สของวิชา
// ถ้าวิชาเป็น "ทั้งคู่" ด้วย = รับทุกคอร์ส แสดงชื่อทุกคอร์สแทนข้อความลอย ๆ
async function resolveSessionCourseName(session) {
  if (session.courseFormat?.name) return session.courseFormat.name;
  if (session.subject?.courseFormat?.name) return session.subject.courseFormat.name;
  const prisma = await getPrisma();
  const all = await prisma.courseFormat.findMany({ orderBy: { id: 'asc' }, select: { name: true } });
  return all.map((c) => c.name).join(', ') || null;
}

// สร้างรูป QR (ใช้ sharp ซึ่งกิน CPU) ครั้งเดียวต่อ 1 ลิงก์แล้วจำไว้ - ช่วงค่ายมีพี่ค่ายหลายคนเปิดรอบสอบ poll พร้อมกันทุก 4 วิ
// ถ้าสร้างใหม่ทุกครั้งจะกิน CPU ของ Render แผนฟรีจนทั้งเว็บช้า เก็บแค่ 50 อันล่าสุด (1 รอบสอบ = 1 ลิงก์)
const qrImageCache = new Map();
async function getQrImageDataUrl(qrPayload) {
  if (qrImageCache.has(qrPayload)) return qrImageCache.get(qrPayload);
  const dataUrl = await buildQrWithLogo(qrPayload);
  qrImageCache.set(qrPayload, dataUrl);
  if (qrImageCache.size > 50) qrImageCache.delete(qrImageCache.keys().next().value);
  return dataUrl;
}

// withQr: false = ไม่แนบรูป QR (รูปใหญ่หลายสิบ KB) ใช้กับการ poll คิวทุก 4 วิ ซึ่งหน้าเว็บใช้แค่รายชื่อผู้เข้าสอบ ไม่ได้วาด QR ใหม่
async function serializeSession(session, req, { withQr = true } = {}) {
  const qrPayload = buildCheckinUrl(req, session.token);
  // 480px แม้แสดงในการ์งปกติแค่ 320px แต่ตอนกดขยายเต็มจอ (ดู .oral-exam-qr-fullscreen-image) ขยายได้ถึง 75vw/75vh ซึ่งอาจใหญ่กว่านี้มาก ต้องมีความละเอียดต้นทางสูงพอไม่ให้ภาพแตก
  const qrImageDataUrl = withQr ? await getQrImageDataUrl(qrPayload) : undefined;
  return {
    id: session.id,
    subjectId: session.subjectId,
    subjectName: session.subject?.name ?? null,
    courseFormatId: session.courseFormatId,
    courseFormatName: await resolveSessionCourseName(session),
    token: session.token,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    maxParticipants: session.maxParticipants,
    qrPayload,
    qrImageDataUrl,
  };
}

async function findSubjectWithInstructors(prisma, subjectId) {
  return prisma.subject.findUnique({
    where: { id: subjectId },
    include: { instructors: { select: { userId: true } } },
  });
}

// เปิดรอบสอบใหม่ของ 1 วิชา - เปิดได้ทีละ 1 รอบต่อวิชาเท่านั้น
async function openSession(req, res) {
  const subjectId = Number(req.body.subjectId);
  if (!subjectId) return res.status(400).json({ error: 'ต้องระบุวิชา' });
  const courseFormatId = Number(req.body.courseFormatId);
  if (!courseFormatId) return res.status(400).json({ error: 'ต้องระบุคอร์ส' });

  // ต้องระบุจำนวนผู้เข้าสอบสูงสุดเสมอ (บังคับ ไม่ให้เปิดแบบไม่จำกัดจำนวนอีกต่อไป) เป็นจำนวนเต็มบวกเท่านั้น
  if (req.body.maxParticipants === undefined || req.body.maxParticipants === null || req.body.maxParticipants === '') {
    return res.status(400).json({ error: 'ต้องระบุจำนวนผู้เข้าสอบสูงสุด' });
  }
  const maxParticipants = Number(req.body.maxParticipants);
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1) {
    return res.status(400).json({ error: 'จำนวนผู้เข้าสอบสูงสุดต้องเป็นจำนวนเต็มมากกว่า 0' });
  }

  const prisma = await getPrisma();
  const subject = await findSubjectWithInstructors(prisma, subjectId);
  if (!subject) return res.status(404).json({ error: 'ไม่พบวิชานี้' });
  if (!subject.requiresScoring) return res.status(400).json({ error: 'วิชานี้ไม่ต้องเก็บคะแนน เปิดสอบอธิบายไม่ได้' });
  if (!subject.hasExplanation) return res.status(400).json({ error: 'วิชานี้ตั้งค่าไม่สอบอธิบาย เปิดรอบสอบไม่ได้' });
  if (!canManageSubjectExam(req.session.user, subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เปิดรอบสอบวิชานี้' });
  }
  const courseFormat = await prisma.courseFormat.findUnique({ where: { id: courseFormatId } });
  if (!courseFormat) return res.status(400).json({ error: 'ไม่พบคอร์สนี้' });
  // วิชาเฉพาะคอร์ส เปิดได้แค่คอร์สของวิชานั้น ส่วนวิชา "ทั้งคู่" (courseFormatId: null) เลือกคอร์สไหนก็ได้ แต่รอบนั้นรับเฉพาะคอร์สที่เลือก
  if (subject.courseFormatId !== null && subject.courseFormatId !== courseFormatId) {
    return res.status(400).json({ error: 'วิชานี้ไม่ได้อยู่ในคอร์สที่เลือก' });
  }

  const existing = await prisma.oralExamSession.findFirst({ where: { subjectId, status: 'OPEN' } });
  if (existing) return res.status(409).json({ error: 'มีรอบสอบของวิชานี้เปิดอยู่แล้ว' });

  const session = await prisma.oralExamSession.create({
    data: { subjectId, courseFormatId, openedByUserId: req.session.user.id, token: generateSessionToken(), maxParticipants },
    include: { subject: { select: { name: true, courseFormat: { select: { name: true } } } }, courseFormat: { select: { name: true } } },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'ORAL_EXAM_SESSION',
    entityId: session.id,
    summary: `เปิดรอบสอบอธิบายวิชา "${subject.name}" คอร์ส${courseFormat.name}${maxParticipants ? ` (จำกัด ${maxParticipants} คน)` : ''}`,
  });

  res.status(201).json(await serializeSession(session, req));
}

// รอบสอบ "ที่ยังใช้งานอยู่" ของวิชานี้ พร้อมคิวคนที่เช็คอินเข้ามาแบบสด ๆ (ใช้ทั้งเช็คว่ามีรอบไหมและ poll ระหว่างรอบเปิดอยู่)
// นับเป็น "ยังใช้งานอยู่" ทั้ง OPEN (ช่วงรับเช็คอิน) และ STARTED (ปิดรับเช็คอินแล้ว กำลังประเมินหลังกด "เริ่ม") - เฉพาะ CLOSED (กด "ยกเลิกรอบสอบ" จบจริงแล้ว) เท่านั้นที่ไม่นับ
// กันปัญหารีเฟรชหน้าทิ้งไว้ระหว่างช่วงใดช่วงหนึ่ง (ไม่ว่าจะมีคนเช็คอินเข้ามาหรือยัง) แล้วมองไม่เห็นรอบที่ยังทำงานอยู่จริง
async function getActiveSession(req, res) {
  const subjectId = Number(req.query.subjectId);
  if (!subjectId) return res.status(400).json({ error: 'ต้องระบุวิชา' });

  const prisma = await getPrisma();
  const subject = await findSubjectWithInstructors(prisma, subjectId);
  if (!subject) return res.status(404).json({ error: 'ไม่พบวิชานี้' });
  if (!canManageSubjectExam(req.session.user, subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูรอบสอบวิชานี้' });
  }

  const session = await prisma.oralExamSession.findFirst({
    where: { subjectId, status: { in: ['OPEN', 'STARTED'] } },
    orderBy: { openedAt: 'desc' },
    include: {
      subject: { select: { name: true, courseFormat: { select: { name: true } } } },
      courseFormat: { select: { name: true } },
      attempts: {
        orderBy: { checkedInAt: 'asc' },
        include: {
          participantProfile: {
            select: {
              id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true,
              courseFormat: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!session) return res.json(null);

  res.json({
    ...(await serializeSession(session, req, { withQr: req.query.withQr !== '0' })),
    attempts: session.attempts.map((a) => ({
      id: a.id,
      participantProfileId: a.participantProfileId,
      code: buildParticipantCode(a.participantProfile.campGenerationNo ?? 1, a.participantProfile.courseFormat?.name, a.participantProfile.id),
      fullName: toFullName(a.participantProfile),
      nickname: a.participantProfile.nickname,
      attemptNumber: a.attemptNumber,
      status: a.status,
      checkedInAt: a.checkedInAt,
    })),
  });
}

// กด "เริ่ม" - ปิดรับเช็คอินใหม่ (OPEN -> STARTED) เข้าสู่ช่วงประเมิน แยกจาก "ยกเลิกรอบสอบ" (closeSession, -> CLOSED) ที่จบรอบจริง
// เรียกซ้ำได้ไม่พัง (idempotent) ถ้า status ไม่ใช่ OPEN แล้วก็แค่ไม่ทำอะไรเพิ่ม
async function startSession(req, res) {
  const sessionId = Number(req.params.sessionId);
  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: { subject: { include: { instructors: { select: { userId: true } } } } },
  });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้' });
  if (!canManageSubjectExam(req.session.user, session.subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เริ่มประเมินรอบสอบนี้' });
  }

  if (session.status === 'OPEN') {
    await prisma.oralExamSession.update({ where: { id: sessionId }, data: { status: 'STARTED', startedAt: new Date() } });
    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'ORAL_EXAM_SESSION',
      entityId: sessionId,
      summary: `เริ่มประเมินรอบสอบอธิบายวิชา "${session.subject.name}" (ปิดรับเช็คอินเพิ่ม)`,
    });
  }

  res.status(204).end();
}

// ประเมินผลหลายคนพร้อมกันในคลิกเดียว (เผื่อสอบเป็นคู่/กลุ่ม) body: { attemptIds:[], result:'PASSED'|'FAILED' }
// attempt ที่ไม่ใช่ PENDING แล้ว (ประเมินไปแล้ว) ถูกข้ามเงียบ ๆ ไม่ error กันกดซ้ำพัง
async function evaluateAttempts(req, res) {
  const sessionId = Number(req.params.sessionId);
  const attemptIds = Array.isArray(req.body.attemptIds) ? req.body.attemptIds.map(Number).filter((n) => Number.isInteger(n)) : [];
  const result = req.body.result;
  if (!['PASSED', 'FAILED'].includes(result)) return res.status(400).json({ error: 'ต้องระบุผลเป็นผ่านหรือไม่ผ่าน' });
  if (attemptIds.length === 0) return res.status(400).json({ error: 'ต้องเลือกอย่างน้อย 1 คน' });

  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: { subject: { include: { instructors: { select: { userId: true } } } } },
  });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้' });
  if (!canManageSubjectExam(req.session.user, session.subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ประเมินรอบสอบนี้' });
  }

  const attempts = await prisma.oralExamAttempt.findMany({ where: { id: { in: attemptIds }, sessionId } });
  const pendingAttempts = attempts.filter((a) => a.status === 'PENDING');
  const skipped = attemptIds.filter((id) => !pendingAttempts.some((a) => a.id === id));

  if (pendingAttempts.length === 0) {
    return res.json({ evaluated: [], skipped });
  }

  const bands = await ensureOralExamScoreBands(prisma);
  const evaluatedByUserId = req.session.user.id;
  const now = new Date();

  const evaluated = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const attempt of pendingAttempts) {
      if (result === 'PASSED') {
        const scorePercent = resolveAttemptScorePercent(attempt.attemptNumber, bands);
        const awardedScore = Math.round((scorePercent / 100) * session.subject.explanationMaxScore);
        await tx.oralExamAttempt.update({
          where: { id: attempt.id },
          data: { status: 'PASSED', evaluatedAt: now, evaluatedByUserId, awardedScore },
        });
        await tx.participantSubjectScore.upsert({
          where: { participantProfileId_subjectId: { participantProfileId: attempt.participantProfileId, subjectId: session.subjectId } },
          create: { participantProfileId: attempt.participantProfileId, subjectId: session.subjectId, explanationScore: awardedScore },
          update: { explanationScore: awardedScore },
        });
        results.push({ attemptId: attempt.id, status: 'PASSED', awardedScore });
      } else {
        await tx.oralExamAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', evaluatedAt: now, evaluatedByUserId, awardedScore: null },
        });
        results.push({ attemptId: attempt.id, status: 'FAILED', awardedScore: null });
      }
    }
    return results;
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: sessionId,
    summary: `ประเมินผลสอบอธิบายวิชา "${session.subject.name}" ${result === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'} ${evaluated.length} คน`,
  });

  res.json({ evaluated, skipped });
}

// ยกเลิก/ปิดรอบสอบ (กดซ้ำได้ ไม่ error) - คนที่ยังรอประเมิน (PENDING) ถูกนำออกจากคิวด้วย เหมือนไม่เคยเช็คอิน
// เพราะรอบที่ปิดแล้วไม่โผล่ให้พี่ค่ายประเมินต่อได้อีก (getActiveSession ดึงแค่ OPEN/STARTED) ถ้าปล่อยค้างไว้น้องค่ายจะติด "รอประเมิน" จนเช็คอินรอบใหม่ไม่ได้
async function closeSession(req, res) {
  const sessionId = Number(req.params.sessionId);
  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: { subject: { include: { instructors: { select: { userId: true } } } } },
  });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้' });
  if (!canManageSubjectExam(req.session.user, session.subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ปิดรอบสอบนี้' });
  }

  if (session.status !== 'CLOSED') {
    const [, removed] = await prisma.$transaction([
      prisma.oralExamSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', closedAt: new Date() } }),
      prisma.oralExamAttempt.deleteMany({ where: { sessionId, status: 'PENDING' } }),
    ]);
    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'ORAL_EXAM_SESSION',
      entityId: sessionId,
      summary: `ปิดรอบสอบอธิบายวิชา "${session.subject.name}"${removed.count ? ` (นำผู้ที่ยังไม่ได้ประเมิน ${removed.count} คนออกจากคิว)` : ''}`,
    });
  }

  res.status(204).end();
}

// เช็คอินเข้าคิวสอบ (ฝั่งน้องค่าย) - สแกน QR แล้วเว็บเรียก endpoint นี้ด้วย token ที่ฝังในลิงก์
async function checkIn(req, res) {
  const token = String(req.body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'ลิงก์ไม่ถูกต้อง' });

  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({ where: { token }, include: { subject: true, courseFormat: true } });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้ ลิงก์อาจไม่ถูกต้อง' });
  if (session.status !== 'OPEN') return res.status(410).json({ error: 'ลิงก์หมดอายุหรือรอบสอบถูกปิดแล้ว' });

  const profile = await prisma.participantProfile.findUnique({ where: { userId: req.session.user.id } });
  if (!profile) return res.status(404).json({ error: 'ไม่พบข้อมูลน้องค่ายของคุณ' });

  // รอบสอบระบุคอร์สไว้ตอนเปิด = รับเฉพาะน้องค่ายคอร์สนั้น (แม้วิชาจะเป็นวิชา "ทั้งคู่")
  // รอบเก่าที่เปิดก่อนมีช่องนี้ (courseFormatId: null) ใช้เงื่อนไขคอร์สของวิชาแทน - วิชา "ทั้งคู่" ผ่านได้ทุกคน
  if (session.courseFormatId !== null) {
    if (session.courseFormatId !== profile.courseFormatId) {
      return res.status(403).json({ error: `รอบสอบนี้เปิดสำหรับคอร์ส${session.courseFormat?.name || 'อื่น'}เท่านั้น` });
    }
  } else if (session.subject.courseFormatId !== null && session.subject.courseFormatId !== profile.courseFormatId) {
    return res.status(403).json({ error: 'วิชานี้ไม่ได้อยู่ในคอร์สของคุณ' });
  }

  // ล้างรายการ "รอประเมิน" ที่ค้างจากรอบที่ถูกปิดไปแล้ว (ข้อมูลเก่าก่อนแก้ closeSession) ไม่มีใครประเมินได้อีก ไม่งั้นน้องค่ายติดเช็คอินใหม่ไม่ได้
  await prisma.oralExamAttempt.deleteMany({
    where: { participantProfileId: profile.id, status: 'PENDING', session: { status: 'CLOSED' } },
  });

  const existingAttempts = await prisma.oralExamAttempt.findMany({
    where: { participantProfileId: profile.id, subjectId: session.subjectId },
  });
  if (existingAttempts.some((a) => a.status === 'PASSED')) {
    return res.status(409).json({ error: 'คุณสอบผ่านวิชานี้แล้ว' });
  }
  if (existingAttempts.some((a) => a.status === 'PENDING')) {
    return res.status(409).json({ error: 'คุณมีรายการรอประเมินผลอยู่แล้ว กรุณารอพี่ค่ายเรียก' });
  }

  // นับ attempt ทั้งหมดที่เคยเช็คอินในรอบนี้ (ไม่ว่าผลจะเป็นอะไร) เทียบกับจำนวนจำกัดที่ตั้งไว้ตอนเปิดรอบ (null = ไม่จำกัด)
  if (session.maxParticipants !== null) {
    const checkedInCount = await prisma.oralExamAttempt.count({ where: { sessionId: session.id } });
    if (checkedInCount >= session.maxParticipants) {
      return res.status(409).json({ error: 'เต็มแล้ว รอบสอบนี้รับผู้เข้าสอบครบตามจำนวนที่กำหนดแล้ว' });
    }
  }

  // นับเป็น "ครั้งที่เท่าไหร่" จากจำนวนครั้งที่ประเมินผลแล้วเท่านั้น (PASSED/FAILED) ไม่นับ PENDING ที่ยังไม่ประเมิน - ปกติแล้วเช็คอินใหม่จะไม่มี PENDING ค้างอยู่แล้วเสมอ (โดนกันไว้ด้านบน)
  // แต่กรองไว้ตรง ๆ กันพลาดชัดเจน ไม่ต้องพึ่งพาการรับประกันโดยอ้อมจากเงื่อนไขด้านบนเพียงอย่างเดียว
  const evaluatedAttemptsCount = existingAttempts.filter((a) => a.status !== 'PENDING').length;

  let attempt;
  try {
    attempt = await prisma.oralExamAttempt.create({
      data: {
        sessionId: session.id,
        participantProfileId: profile.id,
        subjectId: session.subjectId,
        attemptNumber: evaluatedAttemptsCount + 1,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'คุณเช็คอินรอบนี้ไปแล้ว' });
    throw error;
  }

  res.status(201).json({
    attemptId: attempt.id,
    subjectName: session.subject.name,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
  });
}

// ประวัติรอบสอบที่ปิดไปแล้วของวิชานี้ (ฝั่งพี่ค่าย) - รอบที่ยังเปิด/กำลังประเมินอยู่ดูที่ getActiveSession ไม่ปนกัน
// ==========================================
// บันทึกผลสอบอธิบายจากกระดาษ (กรณีระบบ QR ใช้งานไม่ได้) - เฉพาะหัวหน้าฝ่ายวิชาการ/ผู้บริหารค่าย (isAcademicManager)
// แจกกระดาษสอบตามปกติ แล้วมากรอกผลรายวัน: แต่ละครั้งที่บันทึก = 1 รอบสอบ (isManual) ของวิชา+คอร์ส+วันที่ที่เลือก
// "ครั้งที่" และคะแนนคิดแบบเดียวกับการประเมินผ่าน QR ทุกอย่าง (นับจากจำนวนครั้งที่ประเมินแล้ว + ตารางคะแนนตามครั้ง)
// ==========================================
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

async function findManualSubject(prisma, subjectId) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return { error: [404, 'ไม่พบวิชานี้'] };
  if (!subject.requiresScoring) return { error: [400, 'วิชานี้ไม่ต้องเก็บคะแนน'] };
  if (!subject.hasExplanation) return { error: [400, 'วิชานี้ตั้งค่าไม่สอบอธิบาย'] };
  return { subject };
}

// รายชื่อน้องค่ายในคอร์สที่เลือก พร้อมสถานะสอบอธิบายวิชานี้ (สอบไปแล้วกี่ครั้ง ผ่านหรือยัง) ใช้แสดงในฟอร์มบันทึกจากกระดาษ
async function getManualRoster(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'บันทึกผลจากกระดาษได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const subjectId = Number(req.query.subjectId);
  const courseFormatId = Number(req.query.courseFormatId);
  if (!subjectId || !courseFormatId) return res.status(400).json({ error: 'ต้องระบุวิชาและคอร์ส' });

  const prisma = await getPrisma();
  const { subject, error } = await findManualSubject(prisma, subjectId);
  if (error) return res.status(error[0]).json({ error: error[1] });
  if (subject.courseFormatId !== null && subject.courseFormatId !== courseFormatId) {
    return res.status(400).json({ error: 'วิชานี้ไม่ได้อยู่ในคอร์สที่เลือก' });
  }

  const profiles = await prisma.participantProfile.findMany({
    where: { courseFormatId, user: { approvalStatus: 'APPROVED' } },
    orderBy: { firstName: 'asc' },
    select: {
      id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true,
      courseFormat: { select: { name: true } },
      oralExamAttempts: { where: { subjectId }, select: { status: true } },
    },
  });

  res.json({
    subject: { id: subject.id, name: subject.name, explanationMaxScore: subject.explanationMaxScore },
    participants: profiles.map((p) => ({
      id: p.id,
      code: buildParticipantCode(p.campGenerationNo ?? 1, p.courseFormat?.name, p.id),
      fullName: toFullName(p),
      nickname: p.nickname,
      evaluatedCount: p.oralExamAttempts.filter((a) => a.status !== 'PENDING').length,
      passed: p.oralExamAttempts.some((a) => a.status === 'PASSED'),
      pending: p.oralExamAttempts.some((a) => a.status === 'PENDING'),
    })),
  });
}

// body: { subjectId, courseFormatId, examDate: 'YYYY-MM-DD', results: [{ participantProfileId, result: 'PASSED' | 'FAILED' }] }
// คนที่สอบผ่านวิชานี้ไปแล้ว / มีคิวรอประเมินค้างในระบบ QR / อยู่คนละคอร์ส ถูกข้าม (แจ้งกลับใน skipped) ไม่ error ทั้งก้อน
async function recordManualResults(req, res) {
  if (!isAcademicManager(req.session.user)) return res.status(403).json({ error: 'บันทึกผลจากกระดาษได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  const subjectId = Number(req.body.subjectId);
  const courseFormatId = Number(req.body.courseFormatId);
  const examDate = String(req.body.examDate || '');
  const results = Array.isArray(req.body.results) ? req.body.results : [];
  if (!subjectId || !courseFormatId) return res.status(400).json({ error: 'ต้องระบุวิชาและคอร์ส' });
  if (!DATE_ONLY.test(examDate)) return res.status(400).json({ error: 'วันที่สอบไม่ถูกต้อง' });
  const cleaned = results
    .map((r) => ({ participantProfileId: Number(r.participantProfileId), result: r.result }))
    .filter((r) => Number.isInteger(r.participantProfileId) && ['PASSED', 'FAILED'].includes(r.result));
  if (cleaned.length === 0) return res.status(400).json({ error: 'ยังไม่ได้เลือกผลสอบของใครเลย' });
  if (new Set(cleaned.map((r) => r.participantProfileId)).size !== cleaned.length) {
    return res.status(400).json({ error: 'มีรายชื่อซ้ำในการบันทึกครั้งนี้' });
  }

  const prisma = await getPrisma();
  const { subject, error } = await findManualSubject(prisma, subjectId);
  if (error) return res.status(error[0]).json({ error: error[1] });
  if (subject.courseFormatId !== null && subject.courseFormatId !== courseFormatId) {
    return res.status(400).json({ error: 'วิชานี้ไม่ได้อยู่ในคอร์สที่เลือก' });
  }

  const profiles = await prisma.participantProfile.findMany({
    where: { id: { in: cleaned.map((r) => r.participantProfileId) } },
    select: { id: true, prefix: true, firstName: true, lastName: true, courseFormatId: true, oralExamAttempts: { where: { subjectId }, select: { status: true } } },
  });
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const skipped = [];
  const toRecord = [];
  for (const r of cleaned) {
    const p = profileById.get(r.participantProfileId);
    if (!p || p.courseFormatId !== courseFormatId) { skipped.push({ participantProfileId: r.participantProfileId, reason: 'ไม่พบหรืออยู่คนละคอร์ส' }); continue; }
    if (p.oralExamAttempts.some((a) => a.status === 'PASSED')) { skipped.push({ participantProfileId: p.id, fullName: toFullName(p), reason: 'สอบผ่านวิชานี้ไปแล้ว' }); continue; }
    if (p.oralExamAttempts.some((a) => a.status === 'PENDING')) { skipped.push({ participantProfileId: p.id, fullName: toFullName(p), reason: 'มีคิวรอประเมินค้างในระบบ QR' }); continue; }
    toRecord.push({ ...r, profile: p, attemptNumber: p.oralExamAttempts.length + 1 });
  }
  if (toRecord.length === 0) return res.status(409).json({ error: 'ไม่มีรายชื่อที่บันทึกได้', skipped });

  const bands = await ensureOralExamScoreBands(prisma);
  // วันที่สอบตามกระดาษ (เที่ยงวันเวลาไทย กันวันเลื่อนตามเขตเวลา) ใช้เป็นเวลาเปิด/เริ่ม/ปิดรอบ และเวลาเช็คอิน
  const examAt = new Date(examDate + "T12:00:00+07:00");
  const now = new Date();
  const evaluatedByUserId = req.session.user.id;

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.oralExamSession.create({
      data: {
        subjectId, courseFormatId, openedByUserId: evaluatedByUserId, token: generateSessionToken(),
        status: 'CLOSED', isManual: true, openedAt: examAt, startedAt: examAt, closedAt: examAt,
      },
    });
    for (const r of toRecord) {
      const passed = r.result === 'PASSED';
      const awardedScore = passed
        ? Math.round((resolveAttemptScorePercent(r.attemptNumber, bands) / 100) * subject.explanationMaxScore)
        : null;
      await tx.oralExamAttempt.create({
        data: {
          sessionId: created.id, participantProfileId: r.participantProfileId, subjectId,
          attemptNumber: r.attemptNumber, status: r.result, checkedInAt: examAt,
          evaluatedAt: now, evaluatedByUserId, awardedScore,
        },
      });
      if (passed) {
        await tx.participantSubjectScore.upsert({
          where: { participantProfileId_subjectId: { participantProfileId: r.participantProfileId, subjectId } },
          create: { participantProfileId: r.participantProfileId, subjectId, explanationScore: awardedScore },
          update: { explanationScore: awardedScore },
        });
      }
    }
    return created;
  });

  const passedCount = toRecord.filter((r) => r.result === 'PASSED').length;
  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: session.id,
    summary: `บันทึกผลสอบอธิบายจากกระดาษ วิชา "${subject.name}" วันที่ ${examDate} ผ่าน ${passedCount} คน ไม่ผ่าน ${toRecord.length - passedCount} คน`,
  });

  res.status(201).json({ sessionId: session.id, recorded: toRecord.length, passed: passedCount, failed: toRecord.length - passedCount, skipped });
}

// ==========================================
// บันทึกผลจาก "เอกสารการสอบอธิบาย" รายคน (กระดาษที่แจกน้องไว้ ตาราง วิชา x ครั้งที่) - เฉพาะ isAcademicManager
// ทีมจัดการคะแนนเปิดใบของน้องทีละคน แล้วกรอกผลแต่ละวิชาต่อจากครั้งที่มีในระบบแล้ว (ไม่ผ่าน... แล้วผ่านเป็นครั้งสุดท้าย)
// แต่ละครั้งที่ต้องอยู่ในรอบสอบ (attempt ผูก session และ 1 คนมีได้ 1 แถวต่อรอบ) จึงใช้รอบกลางร่วมกัน 1 รอบต่อ วิชา+คอร์ส+ครั้งที่
// ระบุรอบด้วย token "sheet-<วิชา>-<คอร์ส>-<ครั้งที่>" (รอบปิดแล้ว สแกน QR เข้าไม่ได้) ประวัติจะไม่รกเป็นรอบละคน
// ==========================================
const SHEET_TOKEN_PREFIX = 'sheet-';
const sheetToken = (subjectId, courseFormatId, attemptNumber) => SHEET_TOKEN_PREFIX + subjectId + '-' + courseFormatId + '-' + attemptNumber;
const MAX_SHEET_ATTEMPTS = 10;

function requireManager(req, res) {
  if (isAcademicManager(req.session.user)) return true;
  res.status(403).json({ error: 'บันทึกผลจากกระดาษได้เฉพาะหัวหน้าฝ่ายวิชาการหรือผู้บริหารค่าย' });
  return false;
}

// วิชาที่มีสอบอธิบายของคอร์สนี้ (เรียงเหมือนในระบบ)
function sheetSubjects(prisma, courseFormatId) {
  return prisma.subject.findMany({
    where: { requiresScoring: true, hasExplanation: true, OR: [{ courseFormatId }, { courseFormatId: null }] },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, explanationMaxScore: true },
  });
}

// รายชื่อน้องค่ายในคอร์ส พร้อมความคืบหน้า (ผ่านแล้วกี่วิชา) ให้เลือกเปิดใบทีละคน
async function listSheetParticipants(req, res) {
  if (!requireManager(req, res)) return;
  const courseFormatId = Number(req.query.courseFormatId);
  if (!courseFormatId) return res.status(400).json({ error: 'ต้องระบุคอร์ส' });
  const prisma = await getPrisma();
  const [subjects, profiles] = await Promise.all([
    sheetSubjects(prisma, courseFormatId),
    prisma.participantProfile.findMany({
      where: { courseFormatId, user: { approvalStatus: 'APPROVED' } },
      orderBy: { firstName: 'asc' },
      select: {
        id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true,
        courseFormat: { select: { name: true } },
        oralExamAttempts: { select: { subjectId: true, status: true } },
      },
    }),
  ]);
  const subjectIds = new Set(subjects.map((s) => s.id));
  res.json({
    subjectCount: subjects.length,
    participants: profiles.map((p) => ({
      id: p.id,
      code: buildParticipantCode(p.campGenerationNo ?? 1, p.courseFormat?.name, p.id),
      fullName: toFullName(p),
      nickname: p.nickname,
      passedSubjects: new Set(p.oralExamAttempts.filter((a) => a.status === 'PASSED' && subjectIds.has(a.subjectId)).map((a) => a.subjectId)).size,
      attemptCount: p.oralExamAttempts.filter((a) => a.status !== 'PENDING' && subjectIds.has(a.subjectId)).length,
    })),
  });
}

async function buildSheet(prisma, participantProfileId) {
  const profile = await prisma.participantProfile.findUnique({
    where: { id: participantProfileId },
    select: {
      id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true, courseFormatId: true,
      courseFormat: { select: { name: true } },
      oralExamAttempts: { orderBy: { attemptNumber: 'asc' }, select: { subjectId: true, attemptNumber: true, status: true, awardedScore: true, session: { select: { token: true, isManual: true } } } },
    },
  });
  if (!profile || !profile.courseFormatId) return null;
  const subjects = await sheetSubjects(prisma, profile.courseFormatId);
  return {
    profile,
    sheet: {
      id: profile.id,
      code: buildParticipantCode(profile.campGenerationNo ?? 1, profile.courseFormat?.name, profile.id),
      fullName: toFullName(profile),
      nickname: profile.nickname,
      course: profile.courseFormat?.name || null,
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        explanationMaxScore: s.explanationMaxScore,
        attempts: profile.oralExamAttempts.filter((a) => a.subjectId === s.id).map((a) => ({
          attemptNumber: a.attemptNumber,
          status: a.status,
          awardedScore: a.awardedScore,
          source: a.session.token.startsWith(SHEET_TOKEN_PREFIX) ? 'sheet' : (a.session.isManual ? 'paper' : 'qr'),
        })),
      })),
    },
  };
}

async function getParticipantSheet(req, res) {
  if (!requireManager(req, res)) return;
  const prisma = await getPrisma();
  const built = await buildSheet(prisma, Number(req.params.participantProfileId));
  if (!built) return res.status(404).json({ error: 'ไม่พบน้องค่ายหรือยังไม่มีคอร์ส' });
  res.json(built.sheet);
}

// body: { entries: [{ subjectId, results: ['FAILED', ..., 'PASSED'?] }] } - ผลของครั้งใหม่ต่อจากที่มีในระบบแล้ว
// ต้องเป็นไม่ผ่านเรียงกันแล้วจบด้วยผ่านได้แค่ครั้งสุดท้าย วิชาที่ผ่านแล้วหรือมีคิว QR ค้างบันทึกเพิ่มไม่ได้
async function saveParticipantSheet(req, res) {
  if (!requireManager(req, res)) return;
  const participantProfileId = Number(req.params.participantProfileId);
  const entries = (Array.isArray(req.body.entries) ? req.body.entries : [])
    .map((e) => ({ subjectId: Number(e.subjectId), results: Array.isArray(e.results) ? e.results : [] }))
    .filter((e) => e.subjectId && e.results.length);
  if (!entries.length) return res.status(400).json({ error: 'ยังไม่ได้กรอกผลวิชาไหนเลย' });

  const prisma = await getPrisma();
  const built = await buildSheet(prisma, participantProfileId);
  if (!built) return res.status(404).json({ error: 'ไม่พบน้องค่ายหรือยังไม่มีคอร์ส' });
  const { profile, sheet } = built;
  const subjectById = new Map(sheet.subjects.map((s) => [s.id, s]));

  const plan = [];
  for (const entry of entries) {
    const subject = subjectById.get(entry.subjectId);
    if (!subject) return res.status(400).json({ error: 'มีวิชาที่ไม่ได้สอบอธิบายในคอร์สนี้' });
    const valid = entry.results.every((r, i) => (i === entry.results.length - 1 ? ['PASSED', 'FAILED'].includes(r) : r === 'FAILED'));
    if (!valid) return res.status(400).json({ error: 'วิชา "' + subject.name + '": ผลต้องเป็นไม่ผ่านเรียงกัน และผ่านได้แค่ครั้งสุดท้าย' });
    if (subject.attempts.some((a) => a.status === 'PASSED')) return res.status(409).json({ error: 'วิชา "' + subject.name + '" สอบผ่านไปแล้ว' });
    if (subject.attempts.some((a) => a.status === 'PENDING')) return res.status(409).json({ error: 'วิชา "' + subject.name + '" มีคิวรอประเมินค้างในระบบ QR' });
    const start = subject.attempts.length + 1;
    if (start - 1 + entry.results.length > MAX_SHEET_ATTEMPTS) return res.status(400).json({ error: 'วิชา "' + subject.name + '" เกิน ' + MAX_SHEET_ATTEMPTS + ' ครั้ง' });
    plan.push({ subject, results: entry.results, start });
  }

  const bands = await ensureOralExamScoreBands(prisma);
  const now = new Date();
  const userId = req.session.user.id;
  const courseFormatId = profile.courseFormatId;
  await prisma.$transaction(async (tx) => {
    for (const { subject, results, start } of plan) {
      for (let i = 0; i < results.length; i++) {
        const attemptNumber = start + i;
        const token = sheetToken(subject.id, courseFormatId, attemptNumber);
        const session = await tx.oralExamSession.upsert({
          where: { token },
          update: {},
          create: { subjectId: subject.id, courseFormatId, openedByUserId: userId, token, status: 'CLOSED', isManual: true, openedAt: now, startedAt: now, closedAt: now },
        });
        const passed = results[i] === 'PASSED';
        const awardedScore = passed ? Math.round((resolveAttemptScorePercent(attemptNumber, bands) / 100) * subject.explanationMaxScore) : null;
        await tx.oralExamAttempt.create({
          data: { sessionId: session.id, participantProfileId, subjectId: subject.id, attemptNumber, status: results[i], checkedInAt: now, evaluatedAt: now, evaluatedByUserId: userId, awardedScore },
        });
        if (passed) {
          await tx.participantSubjectScore.upsert({
            where: { participantProfileId_subjectId: { participantProfileId, subjectId: subject.id } },
            create: { participantProfileId, subjectId: subject.id, explanationScore: awardedScore },
            update: { explanationScore: awardedScore },
          });
        }
      }
    }
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: participantProfileId,
    summary: 'บันทึกผลสอบอธิบายจากใบรายคนของ "' + sheet.fullName + '": ' + plan.map((p) => p.subject.name + ' ' + (p.results[p.results.length - 1] === 'PASSED' ? 'ผ่านครั้งที่ ' + (p.start + p.results.length - 1) : 'ไม่ผ่าน ' + p.results.length + ' ครั้ง')).join(', '),
  });

  const after = await buildSheet(prisma, participantProfileId);
  res.json(after.sheet);
}

// ล้างผลที่บันทึกจากใบรายคนของวิชานี้ (แก้กรอกผิด) - ลบเฉพาะครั้งที่มาจากใบ ถ้าหลังจากนั้นมีสอบผ่านระบบ QR ต่อแล้วจะล้างไม่ได้ (เลขครั้งจะขาดช่วง)
async function clearParticipantSheetSubject(req, res) {
  if (!requireManager(req, res)) return;
  const participantProfileId = Number(req.params.participantProfileId);
  const subjectId = Number(req.params.subjectId);
  const prisma = await getPrisma();
  const built = await buildSheet(prisma, participantProfileId);
  if (!built) return res.status(404).json({ error: 'ไม่พบน้องค่าย' });
  const subject = built.sheet.subjects.find((s) => s.id === subjectId);
  if (!subject) return res.status(404).json({ error: 'ไม่พบวิชานี้ในใบ' });
  const sheetAttempts = subject.attempts.filter((a) => a.source === 'sheet');
  if (!sheetAttempts.length) return res.status(400).json({ error: 'วิชานี้ไม่มีผลที่บันทึกจากใบ' });
  const firstSheet = Math.min(...sheetAttempts.map((a) => a.attemptNumber));
  if (subject.attempts.some((a) => a.source !== 'sheet' && a.attemptNumber > firstSheet)) {
    return res.status(409).json({ error: 'ล้างไม่ได้ เพราะมีการสอบผ่านระบบหลังจากครั้งที่บันทึกจากใบแล้ว' });
  }
  const hadPass = sheetAttempts.some((a) => a.status === 'PASSED');
  await prisma.$transaction(async (tx) => {
    await tx.oralExamAttempt.deleteMany({ where: { participantProfileId, subjectId, session: { token: { startsWith: SHEET_TOKEN_PREFIX } } } });
    if (hadPass) {
      await tx.participantSubjectScore.updateMany({ where: { participantProfileId, subjectId }, data: { explanationScore: null } });
    }
  });
  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'DELETE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: participantProfileId,
    summary: 'ล้างผลสอบอธิบายที่บันทึกจากใบ วิชา "' + subject.name + '" ของ "' + built.sheet.fullName + '" (' + sheetAttempts.length + ' ครั้ง)',
  });
  const after = await buildSheet(prisma, participantProfileId);
  res.json(after.sheet);
}

async function getSessionHistory(req, res) {
  const subjectId = Number(req.query.subjectId);
  if (!subjectId) return res.status(400).json({ error: 'ต้องระบุวิชา' });

  const prisma = await getPrisma();
  const subject = await findSubjectWithInstructors(prisma, subjectId);
  if (!subject) return res.status(404).json({ error: 'ไม่พบวิชานี้' });
  if (!canManageSubjectExam(req.session.user, subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูประวัติการสอบวิชานี้' });
  }

  const sessions = await prisma.oralExamSession.findMany({
    // เก็บเฉพาะรอบที่เคยกด "เริ่มการสอบอธิบาย" จริง (startedAt ไม่ null) - รอบที่เปิดไว้เฉย ๆ แล้วปิดทิ้งโดยไม่ได้ใช้งานจริงไม่ต้องขึ้นในประวัติ
    where: { subjectId, status: 'CLOSED', startedAt: { not: null } },
    orderBy: { openedAt: 'desc' },
    include: {
      attempts: {
        orderBy: { checkedInAt: 'asc' },
        include: {
          participantProfile: {
            select: {
              id: true, prefix: true, firstName: true, lastName: true, nickname: true, campGenerationNo: true,
              courseFormat: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  res.json({
    history: sessions.map((session) => ({
      id: session.id,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      maxParticipants: session.maxParticipants,
      isManual: session.isManual,
      // รอบกลางของใบรายคน (token "sheet-...") บอกครั้งที่ไว้แสดงในประวัติ
      sheetAttemptNumber: session.token.startsWith(SHEET_TOKEN_PREFIX) ? Number(session.token.split('-').pop()) : null,
      attempts: session.attempts.map((a) => ({
        id: a.id,
        participantProfileId: a.participantProfileId,
        code: buildParticipantCode(a.participantProfile.campGenerationNo ?? 1, a.participantProfile.courseFormat?.name, a.participantProfile.id),
        fullName: toFullName(a.participantProfile),
        nickname: a.participantProfile.nickname,
        attemptNumber: a.attemptNumber,
        status: a.status,
        checkedInAt: a.checkedInAt,
        awardedScore: a.awardedScore,
      })),
    })),
  });
}

// ลบรอบสอบออกจากประวัติ (ฝั่งพี่ค่าย) - ลบได้เฉพาะรอบที่ปิดแล้วเท่านั้น (รอบที่ยังเปิด/กำลังประเมินอยู่ต้องกด "ยกเลิกรอบสอบ" ให้ปิดก่อน กันลบรอบที่น้องค่ายกำลังสแกน/รอผลอยู่จริงไปโดยไม่ตั้งใจ)
// ลบ attempt ทุกแถวในรอบนี้ แล้วปรับ "ครั้งที่" ของการสอบครั้งหลัง ๆ ของผู้เข้าสอบแต่ละคนในรอบนี้ให้ลดลง 1 (เสมือนไม่เคยมีครั้งนี้เกิดขึ้น) - ไม่กระทบคะแนนที่บันทึกไปแล้วใน ParticipantSubjectScore (เหมือน cancelMyAttempt ด้านล่าง อัปเดตแยกกันคนละตารางตอนประเมิน ไม่ได้ผูกกับแถว attempt)
async function deleteSession(req, res) {
  const sessionId = Number(req.params.sessionId);
  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: {
      subject: { include: { instructors: { select: { userId: true } } } },
      attempts: true,
    },
  });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้' });
  if (!canManageSubjectExam(req.session.user, session.subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรอบสอบนี้' });
  }
  if (session.status !== 'CLOSED') {
    return res.status(400).json({ error: 'ลบได้เฉพาะรอบสอบที่ปิดแล้ว กรุณากด "ยกเลิกรอบสอบ" ก่อน' });
  }
  // รอบกลางของใบรายคนมีผลของน้องหลายคนรวมกัน ลบทั้งรอบไม่ได้ ให้ล้างรายคนที่การ์ดบันทึกจากใบแทน
  if (session.token.startsWith(SHEET_TOKEN_PREFIX)) {
    return res.status(400).json({ error: 'รอบนี้เป็นผลที่บันทึกจากใบรายคน ลบทั้งรอบไม่ได้ ให้ล้างผลรายคนที่การ์ด "บันทึกผลจากใบรายคน" แทน' });
  }

  await prisma.$transaction(async (tx) => {
    for (const attempt of session.attempts) {
      await tx.oralExamAttempt.delete({ where: { id: attempt.id } });
      // เลื่อนครั้งที่สอบครั้งหลัง ๆ ของคนคนนี้ในวิชานี้ลง 1 ให้เรียงต่อกันเหมือนเดิม (ไม่มีช่องว่างของเลขครั้งที่)
      await tx.oralExamAttempt.updateMany({
        where: {
          participantProfileId: attempt.participantProfileId,
          subjectId: attempt.subjectId,
          attemptNumber: { gt: attempt.attemptNumber },
        },
        data: { attemptNumber: { decrement: 1 } },
      });
    }
    await tx.oralExamSession.delete({ where: { id: sessionId } });
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'DELETE',
    entityType: 'ORAL_EXAM_SESSION',
    entityId: sessionId,
    summary: `ลบประวัติรอบสอบอธิบายวิชา "${session.subject.name}" (${session.attempts.length} คน)`,
  });

  res.status(204).end();
}

// ประวัติการสอบอธิบายของตัวเอง แยกรายวิชา (ฝั่งน้องค่าย)
async function getMyExamHistory(req, res) {
  const prisma = await getPrisma();
  const profile = await prisma.participantProfile.findUnique({
    where: resolveParticipantWhere(req) || { userId: -1 },
    select: {
      subjectScores: { select: { subjectId: true, explanationScore: true } },
      oralExamAttempts: {
        orderBy: [{ subjectId: 'asc' }, { attemptNumber: 'asc' }],
        include: {
          subject: { select: { id: true, name: true } },
          // สถานะรอบสอบที่แถวนี้สังกัดอยู่ - ฝั่งหน้าเว็บใช้เช็คว่าพี่ค่ายปิด/ยกเลิกรอบไปแล้วหรือยังตอนแถวยังค้าง PENDING อยู่ (ดู pollExamScanWaitStatus ใน participant-study.js เด้งออกจากหน้ารอผลอัตโนมัติถ้าปิดรอบไปแล้ว)
          session: { select: { status: true } },
        },
      },
    },
  });

  const bySubject = new Map();
  (profile?.oralExamAttempts || []).forEach((a) => {
    if (!bySubject.has(a.subjectId)) {
      bySubject.set(a.subjectId, { subjectId: a.subjectId, subjectName: a.subject.name, attempts: [] });
    }
    bySubject.get(a.subjectId).attempts.push({
      // id ของ attempt เอง (ไม่ใช่ attemptNumber) - ฝั่งหน้าเว็บต้องใช้ไปยิง DELETE /me/attempt/:attemptId ตอนกด "ออกจากการสอบ" ยกเลิกแถวที่ยังรอประเมิน
      id: a.id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      sessionStatus: a.session.status,
      checkedInAt: a.checkedInAt,
      evaluatedAt: a.evaluatedAt,
      awardedScore: a.awardedScore,
    });
  });

  const scoreBySubjectId = new Map((profile?.subjectScores || []).map((s) => [s.subjectId, s.explanationScore]));
  const history = Array.from(bySubject.values()).map((entry) => ({
    ...entry,
    currentExplanationScore: scoreBySubjectId.get(entry.subjectId) ?? null,
  }));

  res.json({ history });
}

// คิดคะแนนอธิบายของวิชานี้ใหม่จากแถวที่ผ่าน (ใช้หลังแก้ผล/ลบครั้งที่ประเมินแล้ว) - คะแนนตามเลขครั้งที่ และคะแนนในตารางคะแนน = ครั้งที่ผ่าน (ไม่มีครั้งที่ผ่าน = ว่าง)
async function resyncExplanationScore(tx, participantProfileId, subjectId, explanationMaxScore, bands) {
  const passed = await tx.oralExamAttempt.findMany({ where: { participantProfileId, subjectId, status: 'PASSED' }, orderBy: { attemptNumber: 'asc' } });
  let score = null;
  for (const a of passed) {
    score = Math.round((resolveAttemptScorePercent(a.attemptNumber, bands) / 100) * explanationMaxScore);
    if (a.awardedScore !== score) await tx.oralExamAttempt.update({ where: { id: a.id }, data: { awardedScore: score } });
  }
  await tx.participantSubjectScore.upsert({
    where: { participantProfileId_subjectId: { participantProfileId, subjectId } },
    create: { participantProfileId, subjectId, explanationScore: score },
    update: { explanationScore: score },
  });
}

async function findAttemptForEdit(req, res) {
  const sessionId = Number(req.params.sessionId);
  const attemptId = Number(req.params.attemptId);
  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: { subject: { include: { instructors: { select: { userId: true } } } } },
  });
  if (!session) { res.status(404).json({ error: 'ไม่พบรอบสอบนี้' }); return {}; }
  if (!canManageSubjectExam(req.session.user, session.subject)) { res.status(403).json({ error: 'ไม่มีสิทธิ์จัดการรอบสอบนี้' }); return {}; }
  const attempt = await prisma.oralExamAttempt.findUnique({
    where: { id: attemptId },
    include: { participantProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } },
  });
  if (!attempt || attempt.sessionId !== sessionId) { res.status(404).json({ error: 'ไม่พบผู้เข้าสอบคนนี้ในรอบสอบนี้' }); return {}; }
  return { prisma, session, attempt };
}

// แก้ผลที่ประเมินไปแล้ว (เผื่อกดผิด/บันทึกผิด) body: { result: 'PASSED'|'FAILED' }
// เปลี่ยนเป็น "ผ่าน" ได้เฉพาะครั้งล่าสุดของวิชานั้น (ถ้ามีครั้งถัดไปแล้ว ต้องลบครั้งหลังก่อน ไม่งั้นจะมีสอบต่อหลังผ่าน)
async function updateAttemptResult(req, res) {
  const result = req.body.result;
  if (!['PASSED', 'FAILED'].includes(result)) return res.status(400).json({ error: 'ต้องระบุผลเป็นผ่านหรือไม่ผ่าน' });
  const { prisma, session, attempt } = await findAttemptForEdit(req, res);
  if (!attempt) return;
  if (attempt.status === 'PENDING') return res.status(409).json({ error: 'คนนี้ยังรอประเมิน ให้กดผ่าน/ไม่ผ่านในรอบสอบแทน' });
  if (attempt.status === result) return res.json({ ok: true });

  if (result === 'PASSED') {
    const later = await prisma.oralExamAttempt.findFirst({
      where: { participantProfileId: attempt.participantProfileId, subjectId: attempt.subjectId, attemptNumber: { gt: attempt.attemptNumber } },
      orderBy: { attemptNumber: 'asc' },
    });
    if (later) return res.status(409).json({ error: `เปลี่ยนเป็นผ่านไม่ได้ เพราะมีสอบครั้งที่ ${later.attemptNumber} ต่อจากครั้งนี้แล้ว ให้ลบครั้งที่ ${later.attemptNumber} ขึ้นไปก่อน` });
  }

  const bands = await ensureOralExamScoreBands(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.oralExamAttempt.update({
      where: { id: attempt.id },
      data: { status: result, awardedScore: null, evaluatedAt: new Date(), evaluatedByUserId: req.session.user.id },
    });
    await resyncExplanationScore(tx, attempt.participantProfileId, attempt.subjectId, session.subject.explanationMaxScore, bands);
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: attempt.id,
    summary: `แก้ผลสอบอธิบายวิชา "${session.subject.name}" ของ "${toFullName(attempt.participantProfile)}" ครั้งที่ ${attempt.attemptNumber} จาก${attempt.status === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'}เป็น${result === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'}`,
  });
  res.json({ ok: true });
}

// พี่ค่ายนำน้องค่ายออกจากคิวสอบ (ปุ่มกากบาทในรายชื่อผู้เข้าสอบ) เช่นเช็คอินผิดวิชา/ไม่มาสอบ - น้องค่ายออกจากคิวเองไม่ได้แล้ว
// แถวที่ยังรอประเมิน (PENDING) ลบแล้วนับเป็นเหมือนไม่เคยเช็คอินเลย น้องค่ายเช็คอินใหม่ได้ถ้ารอบยังเปิดรับอยู่
// แถวที่ประเมินแล้ว (ลบจากประวัติ เผื่อบันทึกผิดคน) - เลื่อนเลขครั้งที่ของครั้งหลัง ๆ ลง 1 แล้วคิดคะแนนอธิบายใหม่
async function removeAttempt(req, res) {
  const evaluated = await findAttemptForEdit(req, res);
  if (!evaluated.attempt) return;
  if (evaluated.attempt.status !== 'PENDING') {
    const { prisma, session, attempt } = evaluated;
    const bands = await ensureOralExamScoreBands(prisma);
    const hadPass = attempt.status === 'PASSED' || (await prisma.oralExamAttempt.count({ where: { participantProfileId: attempt.participantProfileId, subjectId: attempt.subjectId, status: 'PASSED' } })) > 0;
    await prisma.$transaction(async (tx) => {
      await tx.oralExamAttempt.delete({ where: { id: attempt.id } });
      await tx.oralExamAttempt.updateMany({
        where: { participantProfileId: attempt.participantProfileId, subjectId: attempt.subjectId, attemptNumber: { gt: attempt.attemptNumber } },
        data: { attemptNumber: { decrement: 1 } },
      });
      if (hadPass) await resyncExplanationScore(tx, attempt.participantProfileId, attempt.subjectId, session.subject.explanationMaxScore, bands);
    });
    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'ORAL_EXAM_ATTEMPT',
      entityId: attempt.id,
      summary: `ลบผลสอบอธิบายวิชา "${session.subject.name}" ของ "${toFullName(attempt.participantProfile)}" ครั้งที่ ${attempt.attemptNumber} (${attempt.status === 'PASSED' ? 'ผ่าน' : 'ไม่ผ่าน'})`,
    });
    return res.status(204).end();
  }
  return removePendingAttempt(req, res);
}

async function removePendingAttempt(req, res) {
  const sessionId = Number(req.params.sessionId);
  const attemptId = Number(req.params.attemptId);
  const prisma = await getPrisma();
  const session = await prisma.oralExamSession.findUnique({
    where: { id: sessionId },
    include: { subject: { include: { instructors: { select: { userId: true } } } } },
  });
  if (!session) return res.status(404).json({ error: 'ไม่พบรอบสอบนี้' });
  if (!canManageSubjectExam(req.session.user, session.subject)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์จัดการรอบสอบนี้' });
  }

  const attempt = await prisma.oralExamAttempt.findUnique({
    where: { id: attemptId },
    include: { participantProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } },
  });
  if (!attempt || attempt.sessionId !== sessionId) return res.status(404).json({ error: 'ไม่พบผู้เข้าสอบคนนี้ในรอบสอบนี้' });
  if (attempt.status !== 'PENDING') {
    return res.status(409).json({ error: 'ผู้เข้าสอบคนนี้ประเมินผลไปแล้ว นำออกไม่ได้' });
  }

  await prisma.oralExamAttempt.delete({ where: { id: attemptId } });
  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'DELETE',
    entityType: 'ORAL_EXAM_ATTEMPT',
    entityId: attemptId,
    summary: `นำ "${toFullName(attempt.participantProfile)}" ออกจากคิวสอบอธิบายวิชา "${session.subject.name}"`,
  });

  res.status(204).end();
}

module.exports = {
  listSheetParticipants,
  getParticipantSheet,
  saveParticipantSheet,
  clearParticipantSheetSubject,
  getManualRoster,
  recordManualResults,
  openSession,
  getActiveSession,
  getSessionHistory,
  startSession,
  evaluateAttempts,
  closeSession,
  deleteSession,
  checkIn,
  getMyExamHistory,
  removeAttempt,
  updateAttemptResult,
};
