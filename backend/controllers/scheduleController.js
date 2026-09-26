const { getPrisma } = require('../lib/prisma');
const { cachedValue } = require('../lib/responseCache');
const { logActivity } = require('../lib/activityLog');

const VALID_COLORS = ['EMERALD', 'ROSE', 'BRAND', 'INDIGO'];

async function listSchedules(req, res) {
  const prisma = await getPrisma();
  const visibleOnly = req.query.visibleOnly === 'true';
  const where = visibleOnly ? { isVisible: true } : {};
  const schedules = await cachedValue(`schedules:${visibleOnly}`, () => prisma.schedule.findMany({ where, orderBy: { eventDate: 'asc' } }));
  res.json(schedules);
}

const REQUIRED_SCHEDULE_FIELDS = {
  eventDate: 'วันที่เริ่ม',
  dateText: 'วันที่แสดงผล (แบบสั้น)',
  mobileDate: 'วันที่แสดงผล (แบบเต็ม)',
  badgeLabel: 'ข้อความป้ายกำกับ',
  title: 'หัวข้อ',
};

// คืนชื่อช่องแรกที่ว่าง (null = ครบ) - onlyProvided: ตอนแก้ไขเช็คเฉพาะช่องที่ส่งมา (เช่นสลับแสดงผลส่งมาแค่ isVisible)
function findMissingScheduleFields(fields, { onlyProvided = false } = {}) {
  for (const [key, label] of Object.entries(REQUIRED_SCHEDULE_FIELDS)) {
    const value = fields[key];
    if (onlyProvided && value === undefined) continue;
    if (value === undefined || value === null || String(value).trim() === '') return label;
  }
  return null;
}

async function createSchedule(req, res) {
  const { eventDate, dateText, mobileDate, badgeLabel, badgeColor, title, description, isVisible } = req.body;

  // บังคับทุกช่อง ยกเว้นรายละเอียด (description) - วันที่สิ้นสุดไม่มีคอลัมน์เก็บอยู่แล้ว (ใช้แค่คำนวณข้อความวันที่ฝั่งฟอร์ม)
  const missing = findMissingScheduleFields({ eventDate, dateText, mobileDate, badgeLabel, title });
  if (missing) return res.status(400).json({ error: `กรุณากรอก${missing}` });
  if (badgeColor && !VALID_COLORS.includes(badgeColor)) {
    return res.status(400).json({ error: `badgeColor ต้องเป็นหนึ่งใน ${VALID_COLORS.join(', ')}` });
  }

  const prisma = await getPrisma();
  const created = await prisma.schedule.create({
    data: {
      eventDate: new Date(eventDate),
      dateText,
      mobileDate: mobileDate.trim(),
      badgeLabel: badgeLabel.trim(),
      badgeColor: badgeColor || 'BRAND',
      title: title.trim(),
      description: description || '',
      isVisible: isVisible === undefined ? true : Boolean(isVisible),
    },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'SCHEDULE',
    entityId: created.id,
    summary: `เพิ่มกำหนดการ "${created.title}"`,
  });

  res.status(201).json(created);
}

async function updateSchedule(req, res) {
  const id = Number(req.params.id);
  const { eventDate, dateText, mobileDate, badgeLabel, badgeColor, title, description, isVisible } = req.body;

  const missing = findMissingScheduleFields({ eventDate, dateText, mobileDate, badgeLabel, title }, { onlyProvided: true });
  if (missing) return res.status(400).json({ error: `กรุณากรอก${missing}` });

  if (badgeColor && !VALID_COLORS.includes(badgeColor)) {
    return res.status(400).json({ error: `badgeColor ต้องเป็นหนึ่งใน ${VALID_COLORS.join(', ')}` });
  }

  const prisma = await getPrisma();
  try {
    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(dateText !== undefined && { dateText }),
        ...(mobileDate !== undefined && { mobileDate }),
        ...(badgeLabel !== undefined && { badgeLabel }),
        ...(badgeColor !== undefined && { badgeColor }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || '' }),
        ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
      },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'SCHEDULE',
      entityId: updated.id,
      summary: `แก้ไขกำหนดการ "${updated.title}"`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกำหนดการที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deleteSchedule(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.schedule.delete({ where: { id } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'SCHEDULE',
      entityId: deleted.id,
      summary: `ลบกำหนดการ "${deleted.title}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกำหนดการที่ต้องการลบ' });
    throw error;
  }
}

module.exports = { listSchedules, createSchedule, updateSchedule, deleteSchedule };
