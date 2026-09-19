const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { isAcademicManager } = require('../middleware/requireAuth');

const INSTRUCTOR_INCLUDE = {
  instructors: {
    include: { user: { select: { id: true, staffProfile: { select: { firstName: true, lastName: true, nickname: true } } } } },
  },
};

// แปลง instructors (แถวจากตาราง join) ให้ใช้งานง่ายฝั่ง frontend: instructorUserIds (array id ล้วน ๆ สำหรับเช็คบ็อกซ์)
// + instructors (ชื่อพร้อมแสดงผล) แทนที่จะให้ frontend เดินโครงสร้าง join ทุกครั้ง
function shapeSubject(subject) {
  const { instructors, ...rest } = subject;
  return {
    ...rest,
    instructorUserIds: instructors.map((i) => i.userId),
    instructors: instructors.map((i) => ({
      userId: i.userId,
      name: [i.user.staffProfile?.firstName, i.user.staffProfile?.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
      nickname: i.user.staffProfile?.nickname || null,
    })),
  };
}

async function listSubjects(req, res) {
  const prisma = await getPrisma();
  const subjects = await prisma.subject.findMany({ include: INSTRUCTOR_INCLUDE, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  res.json(subjects.map(shapeSubject));
}

// วิชาที่ตัวเองเป็นผู้สอน (ใช้ทั้งฝั่งหน้าเว็บตัดสินว่าเป็น instructor tier ไหม และ render แท็บ "จัดการรายวิชาของตัวเอง")
async function listMySubjects(req, res) {
  const prisma = await getPrisma();
  const subjects = await prisma.subject.findMany({
    where: { instructors: { some: { userId: req.session.user.id } } },
    include: INSTRUCTOR_INCLUDE,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(subjects.map(shapeSubject));
}

// รายชื่อพี่ค่ายฝ่ายวิชาการ ให้เลือกเป็นผู้สอนประจำวิชา (ไม่ใช้ /api/users เพราะต้องสิทธิ์แอดมิน คืนแค่ฟิลด์ไม่อ่อนไหว)
async function listInstructorCandidates(req, res) {
  const prisma = await getPrisma();
  const staffProfiles = await prisma.staffProfile.findMany({
    where: { department: { name: 'ฝ่ายวิชาการ' } },
    select: { userId: true, prefix: true, firstName: true, lastName: true, nickname: true },
    orderBy: [{ firstName: 'asc' }],
  });
  res.json(staffProfiles.map((p) => ({
    id: p.userId,
    name: [`${p.prefix || ''}${p.firstName || ''}`, p.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
    nickname: p.nickname,
  })));
}

function validateCredits(credits) {
  if (credits !== undefined && (!Number.isFinite(credits) || credits <= 0)) {
    return 'หน่วยกิตต้องเป็นตัวเลขมากกว่า 0';
  }
  return null;
}

// คะแนนเต็มของแต่ละวิชากำหนดเองได้ไม่เท่ากัน (เช่น สอบเต็ม 50 อธิบายเต็ม 100) ใช้แปลงคะแนนดิบที่กรอกเป็นสัดส่วน % ก่อนถ่วงน้ำหนัก
function validateMaxScores(explanationMaxScore, achievementMaxScore) {
  if (explanationMaxScore !== undefined && (!Number.isInteger(explanationMaxScore) || explanationMaxScore < 1)) {
    return 'คะแนนเต็ม (อธิบาย) ต้องเป็นจำนวนเต็มอย่างน้อย 1';
  }
  if (achievementMaxScore !== undefined && (!Number.isInteger(achievementMaxScore) || achievementMaxScore < 1)) {
    return 'คะแนนเต็ม (คะแนนสอบ) ต้องเป็นจำนวนเต็มอย่างน้อย 1';
  }
  return null;
}

async function createSubject(req, res) {
  const { name } = req.body;
  const requiresScoring = req.body.requiresScoring !== undefined ? Boolean(req.body.requiresScoring) : true;
  const explanationMaxScore = req.body.explanationMaxScore !== undefined ? Number(req.body.explanationMaxScore) : 100;
  const achievementMaxScore = req.body.achievementMaxScore !== undefined ? Number(req.body.achievementMaxScore) : 100;
  const credits = req.body.credits !== undefined ? Number(req.body.credits) : 1;
  // courseFormatId: null = "ทั้งคู่" (ใช้ร่วมกันทุกคอร์ส) ต้องแยกจากกรณีไม่ได้ส่งฟิลด์นี้มาเลย (undefined = ไม่ถูกต้อง ยังไม่ได้เลือก)
  if (req.body.courseFormatId === undefined) {
    return res.status(400).json({ error: 'ต้องระบุคอร์ส' });
  }
  const courseFormatId = req.body.courseFormatId === null ? null : Number(req.body.courseFormatId);
  if (courseFormatId !== null && !courseFormatId) {
    return res.status(400).json({ error: 'คอร์สไม่ถูกต้อง' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อวิชา' });
  }
  const validationError = validateMaxScores(explanationMaxScore, achievementMaxScore) || validateCredits(credits);
  if (validationError) return res.status(400).json({ error: validationError });

  const prisma = await getPrisma();
  const created = await prisma.subject.create({
    data: { name: name.trim(), requiresScoring, explanationMaxScore, achievementMaxScore, credits, courseFormatId },
    include: INSTRUCTOR_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'SUBJECT',
    entityId: created.id,
    summary: `เพิ่มรายวิชา "${created.name}"`,
  });

  res.status(201).json(shapeSubject(created));
}

async function updateSubject(req, res) {
  const id = Number(req.params.id);
  let { name } = req.body;
  let requiresScoring = req.body.requiresScoring !== undefined ? Boolean(req.body.requiresScoring) : undefined;
  const explanationMaxScore = req.body.explanationMaxScore !== undefined ? Number(req.body.explanationMaxScore) : undefined;
  const achievementMaxScore = req.body.achievementMaxScore !== undefined ? Number(req.body.achievementMaxScore) : undefined;
  let credits = req.body.credits !== undefined ? Number(req.body.credits) : undefined;
  // courseFormatId: null = "ทั้งคู่" (ใช้ร่วมกันทุกคอร์ส) เป็นค่าที่ตั้งใจส่งมาจริง ต้องแยกจาก undefined (ไม่ได้ส่งฟิลด์นี้มาเลย = ไม่แก้ไขค่านี้)
  const courseFormatIdProvided = req.body.courseFormatId !== undefined;
  const courseFormatId = courseFormatIdProvided
    ? (req.body.courseFormatId === null ? null : Number(req.body.courseFormatId))
    : undefined;

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อวิชา' });
  }
  if (courseFormatIdProvided && courseFormatId !== null && !courseFormatId) {
    return res.status(400).json({ error: 'คอร์สไม่ถูกต้อง' });
  }
  let validationError = validateMaxScores(explanationMaxScore, achievementMaxScore) || validateCredits(credits);
  if (validationError) return res.status(400).json({ error: validationError });

  const prisma = await getPrisma();
  const existing = await prisma.subject.findUnique({ where: { id }, include: { instructors: true } });
  if (!existing) return res.status(404).json({ error: 'ไม่พบรายวิชาที่ต้องการแก้ไข' });

  const manager = isAcademicManager(req.session.user);
  const isOwnSubject = existing.instructors.some((i) => i.userId === req.session.user.id);
  if (!manager && !isOwnSubject) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขรายวิชานี้ (แก้ได้เฉพาะวิชาที่ตัวเองเป็นผู้สอน)' });
  }
  // หน่วยกิต/ชื่อวิชา/ต้องเก็บคะแนน เป็นข้อมูลเชิงโครงสร้างที่กระทบทั้งคอร์ส (หน่วยกิตกระทบสูตรคะแนนรวม, ชื่อวิชาต้องผ่านหัวหน้าฝ่ายวิชาการกันตั้งชื่อมั่ว, ปิด/เปิดเก็บคะแนนกระทบว่าวิชานี้จะโผล่ในตารางคะแนน/สอบอธิบายไหม) - ผู้สอนที่ไม่ใช่ manager แก้ได้แค่คะแนนเต็มของวิชาตัวเองเท่านั้น
  // ค่าที่ส่งมาแต่แก้ไม่ได้จะถูกเพิกเฉยเงียบ ๆ เหมือน pattern เดียวกับ subjectScoreController.js (ไม่ error เพราะช่องถูก disable ไว้ฝั่ง frontend อยู่แล้ว)
  if (!manager) {
    credits = undefined;
    name = undefined;
    requiresScoring = undefined;
  }

  try {
    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(requiresScoring !== undefined && { requiresScoring }),
        ...(explanationMaxScore !== undefined && { explanationMaxScore }),
        ...(achievementMaxScore !== undefined && { achievementMaxScore }),
        ...(credits !== undefined && { credits }),
        ...(courseFormatId !== undefined && { courseFormatId }),
      },
      include: INSTRUCTOR_INCLUDE,
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'SUBJECT',
      entityId: updated.id,
      summary: `แก้ไขรายวิชา "${updated.name}"`,
    });

    res.json(shapeSubject(updated));
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบรายวิชาที่ต้องการแก้ไข' });
    throw error;
  }
}

// แทนที่ชุดผู้สอนทั้งหมดของวิชานี้ (manager เท่านั้น - เช็คสิทธิ์ที่ route) body: { instructorUserIds: number[] } วิชาหนึ่งมีผู้สอนได้หลายคน
async function setSubjectInstructors(req, res) {
  const id = Number(req.params.id);
  const instructorUserIds = Array.isArray(req.body.instructorUserIds)
    ? [...new Set(req.body.instructorUserIds.map(Number))]
    : [];

  const prisma = await getPrisma();
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'ไม่พบรายวิชาที่ต้องการแก้ไข' });

  await prisma.$transaction([
    prisma.subjectInstructor.deleteMany({ where: { subjectId: id } }),
    ...(instructorUserIds.length
      ? [prisma.subjectInstructor.createMany({ data: instructorUserIds.map((userId) => ({ subjectId: id, userId })) })]
      : []),
  ]);

  const updated = await prisma.subject.findUnique({ where: { id }, include: INSTRUCTOR_INCLUDE });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'SUBJECT',
    entityId: id,
    summary: `แก้ไขผู้สอนวิชา "${existing.name}" (${instructorUserIds.length} คน)`,
  });

  res.json(shapeSubject(updated));
}

async function deleteSubject(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.subject.delete({ where: { id } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'SUBJECT',
      entityId: deleted.id,
      summary: `ลบรายวิชา "${deleted.name}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบรายวิชาที่ต้องการลบ' });
    throw error;
  }
}

module.exports = {
  listSubjects,
  listMySubjects,
  listInstructorCandidates,
  createSubject,
  updateSubject,
  setSubjectInstructors,
  deleteSubject,
};
