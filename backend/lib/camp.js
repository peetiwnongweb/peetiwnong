const { getPrisma } = require('./prisma');

// ครั้งที่จัดค่ายล่าสุด = ค่ามากที่สุดของ Camp.generationNo หรือ null ถ้ายังไม่เคยสร้างค่ายเลย
async function getLatestGenerationNo(prisma) {
  const latest = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' }, select: { generationNo: true } });
  return latest ? latest.generationNo : null;
}

// เหมือน getLatestGenerationNo แต่คืน fallback (ค่าเริ่มต้น 1) แทน null - ใช้ตอนต้องมีตัวเลขไปแสดงผลทันที (เช่น รหัสประจำตัวน้องค่าย) ก่อนเคยมีค่ายจริง
async function getCurrentGenerationNoOrDefault(prisma, fallback = 1) {
  return (await getLatestGenerationNo(prisma)) ?? fallback;
}

// รหัสประจำตัวน้องค่าย 6 หลักเสมอ เช่น 281001 = ครั้งที่จัดค่าย(28, เติม 0 ให้ครบ 2 หลัก) + รหัสรูปแบบคอร์ส(1=เตรียมสอบ, 0=ปรับพื้นฐาน) + เลขลำดับผู้เข้าร่วม (คีย์หลัก เติม 0 ให้ครบ 3 หลัก)
// จับคู่ชื่อคอร์สด้วยคำว่า "เตรียมสอบ" แทนการอิงลำดับ id เพราะ id ไม่ได้การันตีความหมายอะไร (ดู lookupsController.js)
function buildParticipantCode(generationNo, courseFormatName, participantId) {
  const courseDigit = courseFormatName?.includes('เตรียมสอบ') ? 1 : 0;
  return `${String(generationNo).padStart(2, '0')}${courseDigit}${String(participantId).padStart(3, '0')}`;
}

module.exports = { getLatestGenerationNo, getCurrentGenerationNoOrDefault, buildParticipantCode };
