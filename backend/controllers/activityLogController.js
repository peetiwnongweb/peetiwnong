const { getPrisma } = require('../lib/prisma');

// "admin" = WEBMANAGER (Owner) และ STAFF (Admin) ซึ่งเป็นกลุ่มเดียวที่เข้าแผงจัดการเนื้อหา/ผู้ใช้ได้
// รวม 'HOST'/'ADMIN' ไว้ในกลุ่มนี้ด้วย เพราะเป็นชื่อ role เก่าก่อนปรับโครงสร้างสิทธิ์ (ยังมี log เก่าค้างอยู่ในฐานข้อมูล อยากให้ยังเห็นได้ ไม่หายไปเงียบ ๆ)
// "user" = PARTICIPANT เช่น เหตุการณ์สมัครลงทะเบียนด้วยตัวเอง
const SCOPE_ROLES = {
  admin: ['WEBMANAGER', 'STAFF', 'HOST', 'ADMIN'],
  user: ['PARTICIPANT'],
};

async function listActivityLogs(req, res) {
  const prisma = await getPrisma();
  const roles = SCOPE_ROLES[req.query.scope];
  const logs = await prisma.activityLog.findMany({
    ...(roles && { where: { actorRole: { in: roles } } }),
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
}

module.exports = { listActivityLogs };
