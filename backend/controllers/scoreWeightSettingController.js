const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { ensureScoreWeightSetting } = require('../lib/scoreWeightSetting');

async function getScoreWeightSetting(req, res) {
  const prisma = await getPrisma();
  const setting = await ensureScoreWeightSetting(prisma);
  res.json(setting);
}

// คะแนนสอบต้องมีสัดส่วนอย่างน้อย 1 (บังคับ) ส่วนอธิบายเป็น 0 ได้ (ไม่บังคับ) รวมกันต้องเท่ากับ 100 พอดี - ใช้ร่วมกันทุกวิชาที่ requiresScoring
function validateWeights(explanationWeight, achievementWeight) {
  if (!Number.isInteger(explanationWeight) || explanationWeight < 0) {
    return 'สัดส่วนคะแนนอธิบายต้องเป็นจำนวนเต็มไม่ติดลบ';
  }
  if (!Number.isInteger(achievementWeight) || achievementWeight < 1) {
    return 'สัดส่วนคะแนนสอบต้องเป็นจำนวนเต็มอย่างน้อย 1 (ต้องมีเสมอ)';
  }
  if (explanationWeight + achievementWeight !== 100) {
    return 'สัดส่วนคะแนนอธิบาย + คะแนนสอบ ต้องรวมกันเท่ากับ 100';
  }
  return null;
}

async function updateScoreWeightSetting(req, res) {
  const explanationWeight = Number(req.body.explanationWeight);
  const achievementWeight = Number(req.body.achievementWeight);

  const validationError = validateWeights(explanationWeight, achievementWeight);
  if (validationError) return res.status(400).json({ error: validationError });

  const prisma = await getPrisma();
  const data = { explanationWeight, achievementWeight };
  const setting = await prisma.scoreWeightSetting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'SCORE_WEIGHT_SETTING',
    entityId: setting.id,
    summary: `แก้ไขสัดส่วนคะแนนอธิบาย:คะแนนสอบโดยรวม (${explanationWeight}:${achievementWeight})`,
  });

  res.json(setting);
}

module.exports = { getScoreWeightSetting, updateScoreWeightSetting };
