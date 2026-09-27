const { getPrisma } = require('../lib/prisma');

// "admin" = SUPERADMIN (Owner) และ STAFF (Admin) ซึ่งเป็นกลุ่มเดียวที่เข้าแผงจัดการเนื้อหา/ผู้ใช้ได้
// รวม 'HOST'/'ADMIN' ไว้ในกลุ่มนี้ด้วย เพราะเป็นชื่อ role เก่าก่อนปรับโครงสร้างสิทธิ์ (ยังมี log เก่าค้างอยู่ในฐานข้อมูล อยากให้ยังเห็นได้ ไม่หายไปเงียบ ๆ)
// "user" = PARTICIPANT เช่น เหตุการณ์สมัครลงทะเบียนด้วยตัวเอง
// การสมัครลงทะเบียนด้วยตัวเองของพี่ค่าย (actorRole = STAFF) ย้ายไปอยู่ฝั่ง "user" ด้วย ให้เห็นการสมัครของทั้งพี่ค่ายและน้องค่ายที่เดียวกัน
// แยกด้วยข้อความ summary ที่ขึ้นต้นว่า "สมัครลงทะเบียน" (ดู completeRegistration ใน authController.js)
const SELF_REGISTER = { summary: { startsWith: 'สมัครลงทะเบียน' } };
// "study" = ทุกอย่างของระบบการเรียน (วิชา/คะแนน/ตารางเรียน/เอกสาร/สอบอธิบาย/เกณฑ์เกรด) ไม่ว่าใครทำ แยกออกจาก 2 กลุ่มแรก
const STUDY_ENTITY_TYPES = [
  'SUBJECT', 'PARTICIPANT_SUBJECT_SCORE', 'CLASS_SCHEDULE', 'STUDY_DOCUMENT',
  'ORAL_EXAM_SESSION', 'ORAL_EXAM_ATTEMPT', 'ORAL_EXAM_SCORE_BAND', 'GRADE_BAND', 'SCORE_WEIGHT_SETTING',
];
// "activity" = ระบบกิจกรรม (กิจกรรม/คะแนนกลุ่ม/กลุ่ม) ไม่ว่าใครทำ แยกออกมาเหมือน study
const ACTIVITY_ENTITY_TYPES = ['CAMP_ACTIVITY', 'ACTIVITY_SCORE', 'GROUP'];
const NOT_SPLIT = { entityType: { notIn: [...STUDY_ENTITY_TYPES, ...ACTIVITY_ENTITY_TYPES] } };
const SCOPE_WHERE = {
  admin: { AND: [{ actorRole: { in: ['SUPERADMIN', 'STAFF', 'HOST', 'ADMIN'] } }, { NOT: SELF_REGISTER }, NOT_SPLIT] },
  user: { AND: [{ OR: [{ actorRole: 'PARTICIPANT' }, SELF_REGISTER] }, NOT_SPLIT] },
  study: { entityType: { in: STUDY_ENTITY_TYPES } },
  activity: { entityType: { in: ACTIVITY_ENTITY_TYPES } },
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
