const { getPrisma } = require('../lib/prisma');

// "admin" = SUPERADMIN (Owner) และ STAFF (Admin) ซึ่งเป็นกลุ่มเดียวที่เข้าแผงจัดการเนื้อหา/ผู้ใช้ได้
// รวม 'HOST'/'ADMIN' ไว้ในกลุ่มนี้ด้วย เพราะเป็นชื่อ role เก่าก่อนปรับโครงสร้างสิทธิ์ (ยังมี log เก่าค้างอยู่ในฐานข้อมูล อยากให้ยังเห็นได้ ไม่หายไปเงียบ ๆ)
// "user" = PARTICIPANT เช่น เหตุการณ์สมัครลงทะเบียนด้วยตัวเอง
// การสมัครลงทะเบียนด้วยตัวเองของพี่ค่าย (actorRole = STAFF) ย้ายไปอยู่ฝั่ง "user" ด้วย ให้เห็นการสมัครของทั้งพี่ค่ายและน้องค่ายที่เดียวกัน
// แยกด้วยข้อความ summary ที่ขึ้นต้นว่า "สมัครลงทะเบียน" (ดู completeRegistration ใน authController.js)
const SELF_REGISTER = { summary: { startsWith: 'สมัครลงทะเบียน' } };
const SCOPE_WHERE = {
  admin: { actorRole: { in: ['SUPERADMIN', 'STAFF', 'HOST', 'ADMIN'] }, NOT: SELF_REGISTER },
  user: { OR: [{ actorRole: 'PARTICIPANT' }, SELF_REGISTER] },
};

async function listActivityLogs(req, res) {
  const prisma = await getPrisma();
  const where = SCOPE_WHERE[req.query.scope];
  const logs = await prisma.activityLog.findMany({
    ...(where && { where }),
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(req.query.limit) || 200, 1), 200),
  });
  res.json(logs);
}

module.exports = { listActivityLogs };
