// ==========================================
// จำนวนสูงสุดของแต่ละตำแหน่งพี่ค่าย (ทั้งระบบ): ประธานค่าย 1 / รองประธานค่าย 2 / เลขานุการ 1 / หัวหน้าฝ่าย ฝ่ายละ 1
// หัวหน้าฝ่ายมีได้เฉพาะ 5 ฝ่ายงาน - ฝ่ายบริหารคือประธาน/รองประธาน/เลขานุการอยู่แล้ว ไม่มีหัวหน้าฝ่าย
// ใช้ร่วมกันระหว่างหน้าแก้ไขผู้ใช้ (userController) และฟอร์มคณะทำงานค่าย (campController)
// ==========================================
const POSITION_LIMITS = { 'ประธานค่าย': 1, 'รองประธานค่าย': 2, 'เลขานุการ': 1 };
const HEAD_DEPARTMENTS = ['ฝ่ายวิชาการ', 'ฝ่ายกิจกรรมและสันทนาการ', 'ฝ่ายปกครองบริการและอาคารสถานที่', 'ฝ่ายงานพยาบาล', 'ฝ่ายเทคโนโลยีและประชาสัมพันธ์'];

// ตรวจว่าตั้ง userId (null = บัญชีใหม่) เป็นตำแหน่ง positionId ได้ไหม คืนข้อความ error หรือ null
// currentPositionId = ตำแหน่งเดิมของคนนี้ (บันทึกซ้ำตำแหน่งเดิมได้เสมอ)
async function checkPositionLimit(prisma, { userId, positionId, currentPositionId }) {
  if (!positionId) return null;
  const position = await prisma.staffPosition.findUnique({ where: { id: Number(positionId) } });
  if (!position) return null;
  const others = userId ? { userId: { not: userId } } : {};

  const limit = POSITION_LIMITS[position.name];
  if (limit) {
    const count = await prisma.staffProfile.count({ where: { positionId: position.id, ...others } });
    if (count >= limit) return `ตำแหน่ง${position.name}มีได้ ${limit} คน ตอนนี้มีครบแล้ว`;
  }
  // พี่ค่าย 1 คนสังกัดได้หลายฝ่าย จึงระบุไม่ได้ว่าเป็นหัวหน้าฝ่ายไหนจากหน้าแก้ไขผู้ใช้ - ตั้งหัวหน้าฝ่ายได้ที่ "สร้างค่าย/แก้ไขคณะทำงาน" เท่านั้น
  // (คณะทำงานบังคับฝ่ายละ 1 คนอยู่แล้ว ดู validateCampLeadership ใน campController.js)
  if (position.name === 'หัวหน้าฝ่าย' && Number(currentPositionId) !== position.id) {
    return 'ตั้งตำแหน่งหัวหน้าฝ่ายได้ที่ "แก้ไขคณะทำงาน" ในหน้าจัดการค่ายเท่านั้น';
  }
  return null;
}

module.exports = { POSITION_LIMITS, HEAD_DEPARTMENTS, checkPositionLimit };
