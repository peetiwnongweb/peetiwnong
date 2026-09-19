const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { ensureOralExamScoreBands } = require('../lib/oralExam');

async function getOralExamScoreBands(req, res) {
  const prisma = await getPrisma();
  const bands = await ensureOralExamScoreBands(prisma);
  res.json(bands);
}

// รับตารางคะแนนตามครั้งที่สอบทั้งชุด (แทนที่ทั้งชุดเสมอ ไม่ใช่แก้ทีละแถว) เรียงตามลำดับที่ส่งมา
// attemptNumber มาจากตำแหน่งแถว (index+1) เสมอ ไม่รับค่าจาก client ตรง ๆ กันช่องว่าง/ซ้ำในลำดับ
function validateBands(bandsInput) {
  if (!Array.isArray(bandsInput) || bandsInput.length === 0) {
    return { error: 'ต้องมีอย่างน้อย 1 ลำดับครั้งที่สอบ' };
  }

  const cleaned = [];
  for (const raw of bandsInput) {
    const scorePercent = Number(raw?.scorePercent);
    if (!Number.isInteger(scorePercent) || scorePercent < 0 || scorePercent > 100) {
      return { error: 'คะแนน (%) ของแต่ละครั้งต้องเป็นจำนวนเต็ม 0-100' };
    }
    cleaned.push({ scorePercent });
  }

  return { bands: cleaned };
}

async function updateOralExamScoreBands(req, res) {
  const result = validateBands(req.body.bands);
  if (result.error) return res.status(400).json({ error: result.error });

  const prisma = await getPrisma();
  await prisma.$transaction([
    prisma.oralExamScoreBand.deleteMany({}),
    prisma.oralExamScoreBand.createMany({
      data: result.bands.map((band, index) => ({ attemptNumber: index + 1, scorePercent: band.scorePercent })),
    }),
  ]);
  const bands = await prisma.oralExamScoreBand.findMany({ orderBy: { attemptNumber: 'asc' } });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'ORAL_EXAM_SCORE_BAND',
    entityId: null,
    summary: `แก้ไขตารางคะแนนตามครั้งที่สอบอธิบาย (${result.bands.length} ครั้ง: ${result.bands.map((b) => `${b.scorePercent}%`).join(', ')})`,
  });

  res.json(bands);
}

module.exports = { getOralExamScoreBands, updateOralExamScoreBands };
