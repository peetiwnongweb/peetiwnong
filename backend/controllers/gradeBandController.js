const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { ensureGradeBands, HEX_COLOR_PATTERN, DEFAULT_COLOR } = require('../lib/gradeBands');

async function getGradeBands(req, res) {
  const prisma = await getPrisma();
  const bands = await ensureGradeBands(prisma);
  res.json(bands);
}

// รับรายการช่วงคะแนนทั้งหมด (แทนที่ทั้งชุดเสมอ ไม่ใช่แก้ทีละช่วง) เรียงลำดับก่อนไหนหลังไหนก็ได้ ระบบจะเรียงคะแนนสูง-ต่ำเองตอนตรวจสอบ
// ต้องครอบคลุม 0-100 พอดี ไม่เว้นช่วง/ไม่ทับกัน เพื่อให้ทุกคะแนนมีผลการประเมินเสมอ (resolveGrade ใน gradeBands.js พึ่งพาข้อนี้)
function validateBands(bandsInput) {
  if (!Array.isArray(bandsInput) || bandsInput.length === 0) {
    return { error: 'ต้องมีอย่างน้อย 1 ช่วงคะแนน' };
  }

  const cleaned = [];
  for (const raw of bandsInput) {
    const minScore = Number(raw?.minScore);
    const maxScore = Number(raw?.maxScore);
    const label = (raw?.label || '').trim();
    const colorKey = HEX_COLOR_PATTERN.test(raw?.colorKey) ? raw.colorKey : DEFAULT_COLOR;
    if (!label) return { error: 'ต้องระบุผลการประเมินของทุกช่วงคะแนน' };
    if (!Number.isInteger(minScore) || !Number.isInteger(maxScore) || minScore < 0 || maxScore > 100 || minScore > maxScore) {
      return { error: `ช่วงคะแนนของ "${label}" ไม่ถูกต้อง (ต้องเป็นจำนวนเต็ม 0-100 และคะแนนต่ำสุด ≤ คะแนนสูงสุด)` };
    }
    cleaned.push({ minScore, maxScore, label, colorKey });
  }

  cleaned.sort((a, b) => b.minScore - a.minScore);

  if (cleaned[0].maxScore !== 100) return { error: 'ต้องมีช่วงคะแนนที่คลุมถึง 100 คะแนน (ช่วงบนสุด)' };
  if (cleaned[cleaned.length - 1].minScore !== 0) return { error: 'ต้องมีช่วงคะแนนที่คลุมถึง 0 คะแนน (ช่วงล่างสุด)' };
  for (let i = 0; i < cleaned.length - 1; i++) {
    if (cleaned[i].minScore !== cleaned[i + 1].maxScore + 1) {
      return { error: `ช่วงคะแนนต้องต่อกันครบ ไม่เว้นช่วงหรือทับกัน (ระหว่าง "${cleaned[i].label}" กับ "${cleaned[i + 1].label}")` };
    }
  }

  return { bands: cleaned };
}

async function updateGradeBands(req, res) {
  const result = validateBands(req.body.bands);
  if (result.error) return res.status(400).json({ error: result.error });

  const prisma = await getPrisma();
  await prisma.$transaction([
    prisma.gradeBand.deleteMany({}),
    prisma.gradeBand.createMany({
      data: result.bands.map((band, index) => ({ ...band, sortOrder: index })),
    }),
  ]);
  const bands = await prisma.gradeBand.findMany({ orderBy: { sortOrder: 'asc' } });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'GRADE_BAND',
    entityId: null,
    summary: `แก้ไขเกณฑ์ผลการประเมิน (${result.bands.length} ช่วง: ${result.bands.map((b) => b.label).join(', ')})`,
  });

  res.json(bands);
}

module.exports = { getGradeBands, updateGradeBands };
