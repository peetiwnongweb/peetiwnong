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

// qrImageDataUrl สร้างจาก qrPayload สด ๆ ทุกครั้ง (ไม่แคช) - เร็วพอสำหรับ endpoint ที่มีแค่พี่ค่าย 1 คน poll ทุก 4 วิ ไม่คุ้มที่จะเพิ่มความซับซ้อนเรื่อง cache
async function serializeSession(session, req) {
  const qrPayload = buildCheckinUrl(req, session.token);
  // 480px แม้แสดงในการ์งปกติแค่ 320px แต่ตอนกดขยายเต็มจอ (ดู .oral-exam-qr-fullscreen-image) ขยายได้ถึง 75vw/75vh ซึ่งอาจใหญ่กว่านี้มาก ต้องมีความละเอียดต้นทางสูงพอไม่ให้ภาพแตก
  const qrImageDataUrl = await buildQrWithLogo(qrPayload);
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
    ...(await serializeSession(session, req)),
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

// พี่ค่ายนำน้องค่ายออกจากคิวสอบ (ปุ่มกากบาทในรายชื่อผู้เข้าสอบ) เช่นเช็คอินผิดวิชา/ไม่มาสอบ - น้องค่ายออกจากคิวเองไม่ได้แล้ว
// ลบได้เฉพาะแถวที่ยังรอประเมิน (PENDING) เท่านั้น แถวที่ประเมินแล้วเป็นประวัติคะแนน/ตัวนับ "ครั้งที่" ห้ามลบ
// ลบแล้วนับเป็นเหมือนไม่เคยเช็คอินเลย น้องค่ายเช็คอินใหม่ได้ถ้ารอบยังเปิดรับอยู่
async function removeAttempt(req, res) {
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
};
