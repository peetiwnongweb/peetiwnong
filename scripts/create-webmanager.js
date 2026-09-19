// สคริปต์สร้างบัญชี WEBMANAGER จริง (รันเองด้วยมือ ไม่ใช่ส่วนหนึ่งของแอปที่รันตลอด)
// ใช้ตอนต้องการมีบัญชีเจ้าของระบบจริง แยกจากบัญชีทดสอบ webmanager.demo@peetiwnong.camp
//
// วิธีรัน: node scripts/create-webmanager.js
// รหัสผ่านจะพิมพ์เห็นในหน้าจอ terminal ของคุณเอง (ไม่ได้ส่งออกไปไหน) - เลือกที่ที่ไม่มีคนมองข้ามไหล่

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function main() {
  const { getPrisma } = require('../backend/lib/prisma');
  const prisma = await getPrisma();

  const email = await ask('อีเมลสำหรับบัญชี WebManager จริง: ');
  if (!email || !email.includes('@')) {
    console.error('อีเมลไม่ถูกต้อง');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`มีบัญชีอีเมล ${email} อยู่แล้วในระบบ (role: ${existing.role})`);
    process.exit(1);
  }

  const password = await ask('รหัสผ่าน (อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข): ');
  if (!PASSWORD_PATTERN.test(password)) {
    console.error('รหัสผ่านไม่ผ่านเงื่อนไข ต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลขอย่างละ 1 ตัวขึ้นไป');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { email, passwordHash, role: 'WEBMANAGER', approvalStatus: 'APPROVED' },
  });

  console.log(`\nสร้างบัญชี WebManager สำเร็จ: ${created.email} (id ${created.id})`);
  console.log('ลองล็อกอินที่ /webmanager/login.html ด้วยอีเมล/รหัสผ่านนี้เพื่อยืนยันก่อนลบบัญชีทดสอบเดิม\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('สร้างบัญชีไม่สำเร็จ:', error.message);
  process.exit(1);
});
