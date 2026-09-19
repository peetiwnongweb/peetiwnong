const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');

const VALID_COLORS = ['EMERALD', 'ROSE', 'BRAND', 'INDIGO'];

async function listSchedules(req, res) {
  const prisma = await getPrisma();
  const where = req.query.visibleOnly === 'true' ? { isVisible: true } : {};
  const schedules = await prisma.schedule.findMany({ where, orderBy: { eventDate: 'asc' } });
  res.json(schedules);
}

async function createSchedule(req, res) {
  const { eventDate, dateText, mobileDate, badgeLabel, badgeColor, title, description, isVisible } = req.body;

  if (!eventDate || !dateText || !title || !description) {
    return res.status(400).json({ error: 'ต้องระบุ eventDate, dateText, title และ description' });
  }
  if (badgeColor && !VALID_COLORS.includes(badgeColor)) {
    return res.status(400).json({ error: `badgeColor ต้องเป็นหนึ่งใน ${VALID_COLORS.join(', ')}` });
  }

  const prisma = await getPrisma();
  const created = await prisma.schedule.create({
    data: {
      eventDate: new Date(eventDate),
      dateText,
      mobileDate: mobileDate || dateText,
      badgeLabel: badgeLabel || '',
      badgeColor: badgeColor || 'BRAND',
      title,
      description,
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
        ...(description !== undefined && { description }),
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
