const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { resolveParticipantWhere } = require('../lib/participantSimulation');

const ORDER_BY = [{ classDate: 'asc' }, { sortOrder: 'asc' }, { startTime: 'asc' }];
const SCHEDULE_INCLUDE = {
  subject: { select: { id: true, name: true } },
  instructors: {
    include: { user: { select: { id: true, staffProfile: { select: { firstName: true, lastName: true, nickname: true } } } } },
  },
};

// แปล instructors (แถวจากตาราง join) ให้เป็นรูปแบบใช้งานง่ายฝั่ง frontend เหมือนกับ subject.instructors[]
function shapeScheduleEntry(entry) {
  const { instructors, ...rest } = entry;
  return {
    ...rest,
    instructors: instructors.map((i) => ({
      userId: i.userId,
      name: [i.user.staffProfile?.firstName, i.user.staffProfile?.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
      nickname: i.user.staffProfile?.nickname || null,
    })),
  };
}

function parseInstructorUserIds(value) {
  return Array.isArray(value) ? [...new Set(value.map(Number))].filter((id) => Number.isInteger(id) && id > 0) : [];
}

async function listClassSchedules(req, res) {
  const courseFormatId = Number(req.query.courseFormatId);
  if (!courseFormatId) return res.status(400).json({ error: 'ต้องระบุ courseFormatId' });

  const prisma = await getPrisma();
  const entries = await prisma.classSchedule.findMany({
    where: { courseFormatId },
    include: SCHEDULE_INCLUDE,
    orderBy: ORDER_BY,
  });
  res.json(entries.map(shapeScheduleEntry));
}

function validateTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return 'ต้องระบุเวลาเริ่มและเวลาจบ';
  if (startTime >= endTime) return 'เวลาเริ่มต้องมาก่อนเวลาจบ';
  return null;
}

function parseClassDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// กันเลือกวิชาผิดคอร์สมาผูกกับคาบเรียน (Subject มีคอร์สของตัวเองแยกอิสระจาก courseFormatId ของคาบเรียนนี้) คืน error string หรือ null ถ้าผ่าน
async function validateSubjectCourseFormat(prisma, subjectId, scheduleCourseFormatId) {
  if (!subjectId) return null;
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { courseFormatId: true } });
  if (!subject) return 'ไม่พบรายวิชาที่เลือก';
  // courseFormatId: null = "ทั้งคู่" ใช้ได้กับทุกคอร์ส ไม่ต้องเช็คตรงกัน
  if (subject.courseFormatId !== null && subject.courseFormatId !== scheduleCourseFormatId) return 'วิชาที่เลือกอยู่คนละคอร์สกับคาบเรียนนี้';
  return null;
}

async function createClassSchedule(req, res) {
  const { courseFormatId, startTime, endTime, note } = req.body;
  const subjectId = req.body.subjectId ? Number(req.body.subjectId) : null;
  const activityName = typeof req.body.activityName === 'string' ? req.body.activityName.trim() || null : null;
  const instructorUserIds = parseInstructorUserIds(req.body.instructorUserIds);
  const classDate = parseClassDate(req.body.classDate);

  if (!courseFormatId || !classDate) {
    return res.status(400).json({ error: 'ต้องระบุ courseFormatId และวันที่ (รูปแบบ YYYY-MM-DD)' });
  }
  const timeError = validateTimeRange(startTime, endTime);
  if (timeError) return res.status(400).json({ error: timeError });
  // วิชา (subjectId) กับกิจกรรม (activityName) เลือกได้อย่างใดอย่างหนึ่งเท่านั้น ส่วนหมายเหตุ (note) เป็นอิสระ ใส่เพิ่มได้เสมอ
  if (subjectId && activityName) {
    return res.status(400).json({ error: 'เลือกได้แค่วิชาหรือชื่อกิจกรรมอย่างใดอย่างหนึ่ง' });
  }

  const prisma = await getPrisma();

  const subjectError = await validateSubjectCourseFormat(prisma, subjectId, Number(courseFormatId));
  if (subjectError) return res.status(400).json({ error: subjectError });

  const created = await prisma.classSchedule.create({
    data: {
      courseFormatId: Number(courseFormatId),
      subjectId,
      activityName,
      classDate,
      startTime,
      endTime,
      note: note?.trim() || null,
      instructors: instructorUserIds.length ? { create: instructorUserIds.map((userId) => ({ userId })) } : undefined,
    },
    include: SCHEDULE_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'CLASS_SCHEDULE',
    entityId: created.id,
    summary: `เพิ่มตารางเรียนวันที่ ${req.body.classDate} ${created.startTime}-${created.endTime}`,
  });

  res.status(201).json(shapeScheduleEntry(created));
}

async function updateClassSchedule(req, res) {
  const id = Number(req.params.id);
  const { startTime, endTime, note } = req.body;
  const subjectId = req.body.subjectId !== undefined ? (req.body.subjectId ? Number(req.body.subjectId) : null) : undefined;
  const activityName = req.body.activityName !== undefined
    ? (typeof req.body.activityName === 'string' ? req.body.activityName.trim() || null : null)
    : undefined;
  const instructorUserIds = req.body.instructorUserIds !== undefined ? parseInstructorUserIds(req.body.instructorUserIds) : undefined;
  const classDate = req.body.classDate !== undefined ? parseClassDate(req.body.classDate) : undefined;

  if (req.body.classDate !== undefined && !classDate) {
    return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง (รูปแบบ YYYY-MM-DD)' });
  }
  if (startTime !== undefined || endTime !== undefined) {
    const timeError = validateTimeRange(startTime, endTime);
    if (timeError) return res.status(400).json({ error: timeError });
  }

  const prisma = await getPrisma();
  const existing = await prisma.classSchedule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'ไม่พบรายการตารางเรียนที่ต้องการแก้ไข' });

  // วิชากับกิจกรรมเลือกได้อย่างใดอย่างหนึ่ง เช็คจากค่าที่จะเป็นจริงหลังอัปเดต (ค่าใหม่ถ้าส่งมา ไม่งั้นใช้ค่าเดิม)
  const effectiveSubjectId = subjectId !== undefined ? subjectId : existing.subjectId;
  const effectiveActivityName = activityName !== undefined ? activityName : existing.activityName;
  if (effectiveSubjectId && effectiveActivityName) {
    return res.status(400).json({ error: 'เลือกได้แค่วิชาหรือชื่อกิจกรรมอย่างใดอย่างหนึ่ง' });
  }

  if (subjectId !== undefined) {
    const subjectError = await validateSubjectCourseFormat(prisma, subjectId, existing.courseFormatId);
    if (subjectError) return res.status(400).json({ error: subjectError });
  }

  await prisma.classSchedule.update({
    where: { id },
    data: {
      ...(classDate !== undefined && { classDate }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(note !== undefined && { note: note?.trim() || null }),
      ...(subjectId !== undefined && { subjectId }),
      ...(activityName !== undefined && { activityName }),
    },
  });

  if (instructorUserIds !== undefined) {
    await prisma.$transaction([
      prisma.classScheduleInstructor.deleteMany({ where: { classScheduleId: id } }),
      ...(instructorUserIds.length
        ? [prisma.classScheduleInstructor.createMany({ data: instructorUserIds.map((userId) => ({ classScheduleId: id, userId })) })]
        : []),
    ]);
  }

  const updated = await prisma.classSchedule.findUnique({ where: { id }, include: SCHEDULE_INCLUDE });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'CLASS_SCHEDULE',
    entityId: updated.id,
    summary: `แก้ไขตารางเรียนวันที่ ${updated.classDate.toISOString().slice(0, 10)} ${updated.startTime}-${updated.endTime}`,
  });

  res.json(shapeScheduleEntry(updated));
}

async function deleteClassSchedule(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.classSchedule.delete({ where: { id } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'CLASS_SCHEDULE',
      entityId: deleted.id,
      summary: `ลบตารางเรียนวันที่ ${deleted.classDate.toISOString().slice(0, 10)} ${deleted.startTime}-${deleted.endTime}`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบรายการตารางเรียนที่ต้องการลบ' });
    throw error;
  }
}

// ตารางเรียนของคอร์สตัวเอง (ฝั่งน้องค่าย)
async function getMySchedule(req, res) {
  const prisma = await getPrisma();
  const where = resolveParticipantWhere(req);
  if (!where) return res.json([]);

  const profile = await prisma.participantProfile.findUnique({
    where,
    select: { courseFormatId: true },
  });

  if (!profile || !profile.courseFormatId) return res.json([]);

  const entries = await prisma.classSchedule.findMany({
    where: { courseFormatId: profile.courseFormatId },
    include: SCHEDULE_INCLUDE,
    orderBy: ORDER_BY,
  });
  res.json(entries.map(shapeScheduleEntry));
}

module.exports = { listClassSchedules, createClassSchedule, updateClassSchedule, deleteClassSchedule, getMySchedule };
