const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');

const PARTICIPANT_SELECT = { id: true, prefix: true, firstName: true, lastName: true, nickname: true };

function toFullName(profile) {
  const prefixedFirstName = `${profile.prefix || ''}${profile.firstName || ''}`;
  return [prefixedFirstName, profile.lastName].filter(Boolean).join(' ') || '-';
}

function serializeGroup(group) {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
    members: group.participantProfiles.map((p) => ({
      id: p.id,
      fullName: toFullName(p),
      nickname: p.nickname,
    })),
  };
}

// รายชื่อกลุ่มทั้งหมดพร้อมสมาชิก (ไม่รวมอีเมล/เบอร์โทร เพราะพี่ค่ายฝ่ายกิจกรรมทั่วไป (ไม่ใช่ isAdmin) ก็เข้าหน้านี้ได้)
async function listGroups(req, res) {
  const prisma = await getPrisma();
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: { participantProfiles: { select: PARTICIPANT_SELECT, orderBy: { firstName: 'asc' } } },
  });
  res.json(groups.map(serializeGroup));
}

// น้องค่ายที่ยังไม่มีกลุ่ม ให้แท็บ "จัดการกลุ่ม" ใช้เติม dropdown เพิ่มสมาชิก
async function listUnassignedParticipants(req, res) {
  const prisma = await getPrisma();
  const profiles = await prisma.participantProfile.findMany({
    where: { groupId: null },
    select: PARTICIPANT_SELECT,
    orderBy: { firstName: 'asc' },
  });
  res.json(profiles.map((p) => ({ id: p.id, fullName: toFullName(p), nickname: p.nickname })));
}

async function createGroup(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อกลุ่ม' });
  }

  const prisma = await getPrisma();
  const created = await prisma.group.create({ data: { name: name.trim() } });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'GROUP',
    entityId: created.id,
    summary: `เพิ่มกลุ่ม "${created.name}"`,
  });

  res.status(201).json(serializeGroup({ ...created, participantProfiles: [] }));
}

async function updateGroup(req, res) {
  const id = Number(req.params.id);
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อกลุ่ม' });
  }

  const prisma = await getPrisma();
  try {
    const updated = await prisma.group.update({ where: { id }, data: { name: name.trim() } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: updated.id,
      summary: `แก้ไขชื่อกลุ่มเป็น "${updated.name}"`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกลุ่มที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deleteGroup(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.group.delete({ where: { id } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'GROUP',
      entityId: deleted.id,
      summary: `ลบกลุ่ม "${deleted.name}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกลุ่มที่ต้องการลบ' });
    throw error;
  }
}

// ย้ายน้องค่ายเข้ากลุ่มนี้ (ถ้ามีกลุ่มเดิมอยู่แล้วจะถูกย้ายออกจากกลุ่มเดิมโดยอัตโนมัติ)
async function addMember(req, res) {
  const groupId = Number(req.params.id);
  const participantId = Number(req.body.participantId);
  if (!participantId) {
    return res.status(400).json({ error: 'ต้องระบุ participantId' });
  }

  const prisma = await getPrisma();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'ไม่พบกลุ่มที่ต้องการเพิ่มสมาชิก' });

  try {
    const profile = await prisma.participantProfile.update({
      where: { id: participantId },
      data: { groupId },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: groupId,
      summary: `เพิ่ม "${toFullName(profile)}" เข้ากลุ่ม "${group.name}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบน้องค่ายที่ต้องการเพิ่ม' });
    throw error;
  }
}

async function removeMember(req, res) {
  const groupId = Number(req.params.id);
  const participantId = Number(req.params.participantId);

  const prisma = await getPrisma();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'ไม่พบกลุ่มที่ต้องการลบสมาชิก' });

  try {
    const profile = await prisma.participantProfile.update({
      where: { id: participantId, groupId },
      data: { groupId: null },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: groupId,
      summary: `นำ "${toFullName(profile)}" ออกจากกลุ่ม "${group.name}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบน้องค่ายในกลุ่มนี้' });
    throw error;
  }
}

module.exports = {
  listGroups,
  listUnassignedParticipants,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
};
