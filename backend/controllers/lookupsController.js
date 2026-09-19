const { getPrisma } = require('../lib/prisma');

// รายชื่อฝ่ายงาน/ตำแหน่ง/รูปแบบคอร์ส/กลุ่ม ให้หน้า "สร้างบัญชีผู้ใช้" ใช้เติม dropdown (อ่านอย่างเดียว ไม่ต้อง auth เพราะไม่ใช่ข้อมูลอ่อนไหว)
async function listDepartments(req, res) {
  const prisma = await getPrisma();
  const departments = await prisma.campDepartment.findMany({ orderBy: { name: 'asc' } });
  res.json(departments);
}

async function listPositions(req, res) {
  const prisma = await getPrisma();
  const positions = await prisma.staffPosition.findMany({ orderBy: { name: 'asc' } });
  res.json(positions);
}

async function listCourseFormats(req, res) {
  const prisma = await getPrisma();
  // เรียงตาม id (ลำดับที่สร้าง) แทนชื่อ - เรียงตามชื่อจะได้ "เตรียมสอบ" มาก่อน "ปรับพื้นฐาน" เพราะสระ "เ" นำหน้ามีรหัส Unicode มาก่อน "ป"
  // ทั้งที่ตามลำดับการเรียนจริงต้องเป็นปรับพื้นฐานก่อน
  const courseFormats = await prisma.courseFormat.findMany({ orderBy: { id: 'asc' } });
  res.json(courseFormats);
}

async function listGroups(req, res) {
  const prisma = await getPrisma();
  const groups = await prisma.group.findMany({ orderBy: { name: 'asc' } });
  res.json(groups);
}

// ครั้งที่จัดค่ายล่าสุด (ค่ายที่ generationNo สูงสุด) ใช้แสดงในหัวกระดาษรายงานคะแนน - พี่ค่ายทุกคนเรียกได้ ไม่ต้อง auth เหมือน lookup อื่นในไฟล์นี้ (ไม่ใช่ข้อมูลอ่อนไหว)
async function getCurrentGeneration(req, res) {
  const prisma = await getPrisma();
  const camp = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' }, select: { generationNo: true } });
  res.json({ generationNo: camp?.generationNo ?? 1 });
}

module.exports = { listDepartments, listPositions, listCourseFormats, listGroups, getCurrentGeneration };
