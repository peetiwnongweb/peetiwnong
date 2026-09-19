const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');

async function listCampActivities(req, res) {
  const prisma = await getPrisma();
  const activities = await prisma.campActivity.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(activities);
}

async function createCampActivity(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อกิจกรรม' });
  }

  const prisma = await getPrisma();
  const created = await prisma.campActivity.create({
    data: { name: name.trim(), description: description || null },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'CAMP_ACTIVITY',
    entityId: created.id,
    summary: `เพิ่มกิจกรรม "${created.name}"`,
  });

  res.status(201).json(created);
}

async function updateCampActivity(req, res) {
  const id = Number(req.params.id);
  const { name, description } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อกิจกรรม' });
  }

  const prisma = await getPrisma();
  try {
    const updated = await prisma.campActivity.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
      },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'CAMP_ACTIVITY',
      entityId: updated.id,
      summary: `แก้ไขกิจกรรม "${updated.name}"`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกิจกรรมที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deleteCampActivity(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.campActivity.delete({ where: { id } });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'CAMP_ACTIVITY',
      entityId: deleted.id,
      summary: `ลบกิจกรรม "${deleted.name}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบกิจกรรมที่ต้องการลบ' });
    throw error;
  }
}

// คะแนนทุกกลุ่มของกิจกรรมนี้ (กลุ่มที่ยังไม่เคยบันทึกคะแนนจะไม่มีในผลลัพธ์ ฝั่งหน้าเว็บ join กับ /api/groups เอาเองเพื่อโชว์ครบทุกกลุ่ม)
async function listActivityScores(req, res) {
  const activityId = Number(req.params.id);
  const prisma = await getPrisma();

  const activity = await prisma.campActivity.findUnique({ where: { id: activityId } });
  if (!activity) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });

  const scores = await prisma.activityScore.findMany({ where: { activityId } });
  res.json(scores.map((s) => ({ groupId: s.groupId, score: s.score })));
}

// บันทึก/แก้ไขคะแนนของกลุ่มหนึ่งในกิจกรรมนี้ (upsert)
async function upsertActivityScore(req, res) {
  const activityId = Number(req.params.id);
  const groupId = Number(req.params.groupId);
  const score = Number(req.body.score);

  if (!Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'คะแนนต้องเป็นจำนวนเต็มไม่ติดลบ' });
  }

  const prisma = await getPrisma();
  const [activity, group] = await Promise.all([
    prisma.campActivity.findUnique({ where: { id: activityId } }),
    prisma.group.findUnique({ where: { id: groupId } }),
  ]);
  if (!activity) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  if (!group) return res.status(404).json({ error: 'ไม่พบกลุ่ม' });

  const saved = await prisma.activityScore.upsert({
    where: { activityId_groupId: { activityId, groupId } },
    create: { activityId, groupId, score },
    update: { score },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'ACTIVITY_SCORE',
    entityId: saved.id,
    summary: `บันทึกคะแนนกลุ่ม "${group.name}" ในกิจกรรม "${activity.name}" เป็น ${score} คะแนน`,
  });

  res.json({ groupId: saved.groupId, score: saved.score });
}

// ลบคะแนนที่บันทึกผิดทิ้ง (กลับไปเป็นยังไม่มีคะแนน ไม่ใช่ตั้งเป็น 0 เพราะ 0 ก็เป็นคะแนนที่ถูกต้องได้เหมือนกัน)
async function deleteActivityScore(req, res) {
  const activityId = Number(req.params.id);
  const groupId = Number(req.params.groupId);

  const prisma = await getPrisma();
  try {
    const deleted = await prisma.activityScore.delete({
      where: { activityId_groupId: { activityId, groupId } },
      include: { activity: { select: { name: true } }, group: { select: { name: true } } },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'ACTIVITY_SCORE',
      entityId: deleted.id,
      summary: `ลบคะแนนกลุ่ม "${deleted.group.name}" ในกิจกรรม "${deleted.activity.name}" (${deleted.score} คะแนน)`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบคะแนนที่ต้องการลบ' });
    throw error;
  }
}

// ประวัติการบันทึกคะแนนทั้งหมด เรียงล่าสุดก่อน ใช้ให้พี่ค่ายตรวจสอบ/ลบรายการที่บันทึกผิด
async function listScoreHistory(req, res) {
  const prisma = await getPrisma();
  const scores = await prisma.activityScore.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { activity: { select: { name: true } }, group: { select: { name: true } } },
  });

  res.json(scores.map((s) => ({
    activityId: s.activityId,
    activityName: s.activity.name,
    groupId: s.groupId,
    groupName: s.group.name,
    score: s.score,
    updatedAt: s.updatedAt,
  })));
}

// สรุปคะแนนรวมทุกกิจกรรมของแต่ละกลุ่ม เรียงมาก -> น้อย ใช้ทำ leaderboard
async function getScoreSummary(req, res) {
  const prisma = await getPrisma();
  const [groups, totals] = await Promise.all([
    prisma.group.findMany({ orderBy: { name: 'asc' } }),
    prisma.activityScore.groupBy({ by: ['groupId'], _sum: { score: true } }),
  ]);

  const totalByGroupId = new Map(totals.map((t) => [t.groupId, t._sum.score || 0]));
  const summary = groups
    .map((g) => ({ groupId: g.id, groupName: g.name, totalScore: totalByGroupId.get(g.id) || 0 }))
    .sort((a, b) => b.totalScore - a.totalScore);

  res.json(summary);
}

// คะแนนของกลุ่มตัวเอง แยกตามกิจกรรม (เรียงเก่า -> ใหม่ ให้อ่านเป็น "ประวัติคะแนน") ใช้เฉพาะฝั่งน้องค่าย
async function getMyGroupScores(req, res) {
  const prisma = await getPrisma();
  const profile = await prisma.participantProfile.findUnique({
    where: { userId: req.session.user.id },
    select: { groupId: true, group: { select: { id: true, name: true } } },
  });

  if (!profile || !profile.groupId) {
    return res.json({ group: null, totalScore: 0, history: [] });
  }

  const [activities, scores] = await Promise.all([
    prisma.campActivity.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.activityScore.findMany({ where: { groupId: profile.groupId } }),
  ]);

  const scoreByActivityId = new Map(scores.map((s) => [s.activityId, s.score]));
  const history = activities.map((a) => ({
    activityId: a.id,
    activityName: a.name,
    score: scoreByActivityId.get(a.id) || 0,
    scored: scoreByActivityId.has(a.id),
  }));
  const totalScore = history.reduce((sum, h) => sum + h.score, 0);

  res.json({ group: profile.group, totalScore, history });
}

module.exports = {
  listCampActivities,
  createCampActivity,
  updateCampActivity,
  deleteCampActivity,
  listActivityScores,
  upsertActivityScore,
  deleteActivityScore,
  listScoreHistory,
  getScoreSummary,
  getMyGroupScores,
};
