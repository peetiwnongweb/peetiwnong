const { Pool } = require('pg');

// ==========================================
// pool เชื่อมต่อ Postgres "ตัวเดียว" ใช้ร่วมกันทั้ง Prisma และ session store (connect-pg-simple ใน server.js)
// Supabase pooler แบบ session mode (พอร์ต 5432) จำกัด 15 client ต่อโปรเจกต์ - ถ้าแต่ละฝั่งเปิด pool ของตัวเอง (ค่าเริ่มต้นฝั่งละ 10)
// หน้า WebManager ที่ยิง fetch ~20 เส้นพร้อมกันตอนเปิดจะเปิด connection เกิน 15 แล้วล้มด้วย EMAXCONNSESSION ทั้งหน้า
// จึงรวมเป็น pool เดียว จำกัดสูงสุด DB_POOL_MAX (ค่าเริ่มต้น 8) เหลือที่ให้ prisma migrate/สคริปต์อื่นต่อพร้อมกันได้ - คิวรีที่เกินจะรอคิวใน pool แทนที่จะพัง
// ==========================================
const DB_POOL_MAX = Number(process.env.DB_POOL_MAX) || 8;

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
