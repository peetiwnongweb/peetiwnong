// ค่าเริ่มต้น (ก่อนเปลี่ยนมาเป็นช่วงคะแนนที่กำหนดเองได้) seed ตอนยังไม่เคยมีช่วงคะแนนเลย เรียงจากคะแนนสูงไปต่ำ
// colorKey เป็นรหัสสี hex ตรง ๆ (ผู้ใช้เลือกเองได้อิสระผ่านวงล้อสีในฟอร์ม ไม่ได้จำกัดเป็นชุดสีตายตัวอีกต่อไป) ค่าเริ่มต้นนี้แค่ให้หน้าตาเหมือนพาเลตต์เดิมตอนยังไม่เคยตั้งค่าเอง
const DEFAULT_BANDS = [
  { minScore: 80, maxScore: 100, label: 'ดีเยี่ยม', colorKey: '#b45309', sortOrder: 0 },
  { minScore: 70, maxScore: 79, label: 'ดีมาก', colorKey: '#1d4ed8', sortOrder: 1 },
  { minScore: 60, maxScore: 69, label: 'ดี', colorKey: '#059669', sortOrder: 2 },
  { minScore: 1, maxScore: 59, label: 'เข้าร่วม', colorKey: '#64748b', sortOrder: 3 },
  { minScore: 0, maxScore: 0, label: 'ไม่ผ่าน', colorKey: '#be123c', sortOrder: 4 },
];

// รูปแบบสีที่ยอมรับ: hex 6 หลัก (ตามที่ input type="color" ของเบราว์เซอร์ส่งมาเสมอ) - ใช้ตรวจสอบค่าที่ผู้ใช้ส่งมาว่าถูกต้องไหมก่อนบันทึก
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = '#64748b';

// ยังไม่เคยมีช่วงคะแนนมาก่อน (ฐานข้อมูลใหม่) ให้ seed ค่าเริ่มต้นแทนการ error
async function ensureGradeBands(prisma) {
  const count = await prisma.gradeBand.count();
  if (count === 0) {
    await prisma.gradeBand.createMany({ data: DEFAULT_BANDS });
  }
  return prisma.gradeBand.findMany({ orderBy: { sortOrder: 'asc' } });
}

// คะแนนรวม (0-100) -> ผลการประเมิน + สีป้าย ตามช่วงที่ครอบคลุมคะแนนนั้น (bands ต้องมี colorKey ติดมาอยู่แล้ว เป็นฟิลด์จริงในตาราง)
// เช็คแค่ minScore (ไม่เช็ค maxScore) โดย bands ต้องเรียงจากคะแนนสูงไปต่ำเสมอ (ตามลำดับ sortOrder ที่บันทึกไว้) แล้วจับช่วงแรกที่ grandTotal >= minScore
// เหตุผล: minScore/maxScore เป็นจำนวนเต็มเสมอ (validateBands บังคับ) แต่ grandTotal เป็นทศนิยมได้ (เช่น 59.22) ถ้าเช็ค maxScore ด้วยจะมีช่องว่างระหว่างช่วง (59.22 ไม่ <= 59 และไม่ >= 60) ทำให้หาช่วงไม่เจอ (grade: null)
function resolveGrade(grandTotal, bands) {
  const band = bands.find((b) => grandTotal >= b.minScore);
  return band ? { grade: band.label, gradeColorKey: band.colorKey } : { grade: null, gradeColorKey: DEFAULT_COLOR };
}

module.exports = { ensureGradeBands, resolveGrade, HEX_COLOR_PATTERN, DEFAULT_COLOR };
