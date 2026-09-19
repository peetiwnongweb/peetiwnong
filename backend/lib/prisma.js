const { Pool } = require('pg');

// ==========================================
// pool เชื่อมต่อ Postgres "ตัวเดียว" ใช้ร่วมกันทั้ง Prisma และ session store (connect-pg-simple ใน server.js)
// 2026-09-20: DATABASE_URL เปลี่ยนจาก session pooler มาเป็น transaction pooler แล้ว (ดูคอมเมนต์ใน .env)
// Supabase free tier รับ client เชื่อมเข้า transaction pooler พร้อมกันได้ถึง 200 ต่อโปรเจกต์ (ต่างจาก session mode เดิมที่จำกัดแค่ 15)
// เพราะ transaction mode คืน connection กลับให้ pool ทันทีที่ query/transaction จบ ไม่ถือค้างไว้ทั้ง request เหมือน session mode
// ปรับ DB_POOL_MAX ขึ้นจาก 8 เป็น 20 (ค่าเริ่มต้น) รองรับคนใช้เว็บพร้อมกันได้มากขึ้นมาก โดยยังเหลือระยะห่างจากเพดาน 200 ไว้เยอะ กันกรณีรันหลาย instance/สคริปต์พร้อมกัน
// ==========================================
const DB_POOL_MAX = Number(process.env.DB_POOL_MAX) || 20;

let pool = null;
let prismaPromise = null;

function getDbPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: DB_POOL_MAX });
    // idle client หลุด (เช่น pooler ตัด connection ที่ว่างนาน) ต้องดักไว้ ไม่งั้น pg โยนเป็น uncaught error ทำ process ดับ
    pool.on('error', (error) => console.error('Postgres pool มีปัญหา:', error.message));
  }
  return pool;
}

// generated/prisma เป็น TypeScript/ESM (Prisma 7) จึงต้อง dynamic import()
// จาก backend ที่เหลือซึ่งเป็น CommonJS แทนการ require() ตรง ๆ
function getPrisma() {
  if (!prismaPromise) {
    prismaPromise = Promise.all([
      import('../../generated/prisma/client.ts'),
      import('@prisma/adapter-pg'),
    ]).then(([{ PrismaClient }, { PrismaPg }]) => {
      const adapter = new PrismaPg(getDbPool());
      return new PrismaClient({ adapter });
    });
  }
  return prismaPromise;
}

module.exports = { getPrisma, getDbPool };
