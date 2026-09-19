// WebManager (Owner) ไม่มี ParticipantProfile ของตัวเอง เข้าหน้าน้องค่ายตรง ๆ จะไม่มีข้อมูลให้ดู (คะแนน/ตารางเรียน/เอกสารว่างเปล่าหมด)
// endpoint "/me" ฝั่งน้องค่ายเลยเปิดให้ WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน query ?simulateParticipantId=<User.id ของน้องค่ายคนนั้น>
// ใช้ User.id (ไม่ใช่ ParticipantProfile.id) เพราะ /api/users?role=PARTICIPANT ที่ frontend ใช้สร้างตัวเลือกอยู่แล้วคืน user.id มาให้ตรง ๆ ไม่ต้องเพิ่ม field ใหม่
// ใช้เฉพาะ endpoint แบบอ่านอย่างเดียว (ดูคะแนน/ตารางเรียน/เอกสาร/ประวัติสอบ) ไม่ใช้กับ endpoint ที่มีผลจริง เช่น เช็คอินเข้าสอบอธิบาย (เดี๋ยวกลายเป็นสวมรอยทำธุรกรรมแทนคนอื่นจริง ๆ)
// คืน Prisma where clause ที่ใช้ค้นหา ParticipantProfile ได้ตรง ๆ - null = ไม่มีสิทธิ์ดูข้อมูลใคร (WebManager ที่ไม่ได้ระบุ simulateParticipantId มา)
function resolveParticipantWhere(req) {
  if (req.session.user.role === 'PARTICIPANT') {
    return { userId: req.session.user.id };
  }
  if (req.session.user.role === 'WEBMANAGER') {
    const simulateUserId = Number(req.query.simulateParticipantId);
    if (Number.isInteger(simulateUserId) && simulateUserId > 0) {
      return { userId: simulateUserId };
    }
  }
  return null;
}

module.exports = { resolveParticipantWhere };
