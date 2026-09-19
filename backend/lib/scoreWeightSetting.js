// ใช้ upsert เหมือน ensureGradeBands (gradeBands.js) เพื่อให้ทำงานได้แม้ยังไม่เคยมีแถวนี้มาก่อน
async function ensureScoreWeightSetting(prisma) {
  return prisma.scoreWeightSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

module.exports = { ensureScoreWeightSetting };
