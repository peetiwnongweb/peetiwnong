const crypto = require('crypto');

// ค่าเริ่มต้น (ก่อนเปลี่ยนมาเป็นตารางคะแนนตามครั้งที่กำหนดเองได้) seed ตอนยังไม่เคยมีแถวเลย
const DEFAULT_SCORE_BANDS = [
  { attemptNumber: 1, scorePercent: 100 },
  { attemptNumber: 2, scorePercent: 80 },
  { attemptNumber: 3, scorePercent: 60 },
  { attemptNumber: 4, scorePercent: 40 },
  { attemptNumber: 5, scorePercent: 20 },
];

// token ใช้ฝังใน URL ของ QR ให้น้องค่ายสแกนเช็คอิน - สุ่มไม่ซ้ำ ทายไม่ได้ (32 ไบต์ = ยาวพอกันเดา ไม่ต้องมี TTL ในตัวเอง ผูกกับ session.status แทน)
function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// ยังไม่เคยมีตารางคะแนนตามครั้งมาก่อน (ฐานข้อมูลใหม่) ให้ seed ค่าเริ่มต้นแทนการ error
async function ensureOralExamScoreBands(prisma) {
  const count = await prisma.oralExamScoreBand.count();
  if (count === 0) {
    await prisma.oralExamScoreBand.createMany({ data: DEFAULT_SCORE_BANDS });
  }
  return prisma.oralExamScoreBand.findMany({ orderBy: { attemptNumber: 'asc' } });
}

// หาสัดส่วนคะแนน (%) ของครั้งที่ N จากตารางที่เรียงจากน้อยไปมากแล้ว (bandsAsc ต้องมาจาก ensureOralExamScoreBands)
// ถ้า N เกินแถวสูงสุดที่ตั้งไว้ ให้ใช้คะแนนของแถวสูงสุดเป็นค่าปลายเปิด (เช่น ตั้งไว้ถึงครั้งที่ 5 แล้วสอบครั้งที่ 7 ก็ยังได้เท่าครั้งที่ 5)
function resolveAttemptScorePercent(attemptNumber, bandsAsc) {
  if (!bandsAsc.length) return 0;
  const exact = bandsAsc.find((b) => b.attemptNumber === attemptNumber);
  if (exact) return exact.scorePercent;
  return bandsAsc[bandsAsc.length - 1].scorePercent;
}

module.exports = { generateSessionToken, ensureOralExamScoreBands, resolveAttemptScorePercent };
