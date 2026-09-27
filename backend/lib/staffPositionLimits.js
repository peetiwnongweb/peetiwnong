// ==========================================
// จำนวนสูงสุดของแต่ละตำแหน่งพี่ค่าย (ทั้งระบบ): ประธานค่าย 1 / รองประธานค่าย 2 / เลขานุการ 1 / หัวหน้าฝ่าย ฝ่ายละ 1
// หัวหน้าฝ่ายมีได้เฉพาะ 5 ฝ่ายงาน - ฝ่ายบริหารคือประธาน/รองประธาน/เลขานุการอยู่แล้ว ไม่มีหัวหน้าฝ่าย
// ใช้ร่วมกันระหว่างหน้าแก้ไขผู้ใช้ (userController) และฟอร์มคณะทำงานค่าย (campController)
// ==========================================
const POSITION_LIMITS = { 'ประธานค่าย': 1, 'รองประธานค่าย': 2, 'เลขานุการ': 1 };
const HEAD_DEPARTMENTS = ['ฝ่ายวิชาการ', 'ฝ่ายกิจกรรมและสันทนาการ', 'ฝ่ายปกครองบริการและอาคารสถานที่', 'ฝ่ายงานพยาบาล', 'ฝ่ายเทคโนโลยีและประชาสัมพันธ์'];

// ตรวจว่าตั้ง userId (null = บัญชีใหม่) เป็นตำแหน่ง positionId ในฝ่าย departmentId ได้ไหม คืนข้อความ error หรือ null
async function checkPositionLimit(prisma, { userId, positionId, departmentId }) {
  if (!positionId) return null;
  const position = await prisma.staffPosition.findUnique({ where: { id: Number(positionId) } });
  if (!position) return null;
  const others = userId ? { userId: { not: userId } } : {};

  const limit = POSITION_LIMITS[position.name];
  if (limit) {
    const count = await prisma.staffProfile.count({ where: { positionId: position.id, ...others } });
    if (count >= limit) return `ตำแหน่ง${position.name}มีได้ ${limit} คน ตอนนี้มีครบแล้ว`;
  }
  if (position.name === 'หัวหน้าฝ่าย') {
    const department = departmentId ? await prisma.campDepartment.findUnique({ where: { id: Number(departmentId) } }) : null;
    if (!department || !HEAD_DEPARTMENTS.includes(department.name)) {
      return `หัวหน้าฝ่ายต้องอยู่ในฝ่ายใดฝ่ายหนึ่งต่อไปนี้: ${HEAD_DEPARTMENTS.join(', ')}`;
    }
    const count = await prisma.staffProfile.count({ where: { positionId: position.id, departmentId: department.id, ...others } });
    if (count >= 1) return `${department.name}มีหัวหน้าฝ่ายแล้ว (ฝ่ายละ 1 คน)`;
  }
  return null;
}

module.exports = { POSITION_LIMITS, HEAD_DEPARTMENTS, checkPositionLimit };
