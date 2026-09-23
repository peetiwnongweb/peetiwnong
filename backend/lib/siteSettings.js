const { getPrisma } = require('./prisma');

// ==========================================
// อ่านการตั้งค่าเว็บไซต์ (แถวเดียวตายตัว id=1) - ทุกหน้าเว็บเรียก /api/site-settings ตอนโหลด (ผู้เยี่ยมชมทั่วไปด้วย) จึงเป็น endpoint ที่ถูกเรียกบ่อยสุดตัวหนึ่ง
// เดิมใช้ upsert({ update: {} }) ทุกครั้งที่อ่าน ซึ่ง "เขียน" แถวจริงทุกครั้ง (updatedAt เป็น @updatedAt ถูกอัปเดตเสมอ) + ล็อกแถวเดียวกัน
// คนเปิดเว็บพร้อมกันเลยต้องรอคิวล็อกกัน เฉลี่ย ~1.5 วิ ช้าสุด ~5 วิ - ตอนนี้อ่านอย่างเดียว (สร้างแถวเฉพาะครั้งแรกที่ยังไม่มี) และ cache สั้น ๆ
// updateSiteSettings ล้าง cache ทันทีหลังบันทึก ค่าที่แก้จึงเห็นผลทันทีบนเซิร์ฟเวอร์เดียวกัน (Render รันตัวเดียว)
// ==========================================
const CACHE_TTL_MS = 30 * 1000;
let cache = { at: 0, value: null };

function invalidateSiteSettingsCache() {
  cache = { at: 0, value: null };
}

async function getSiteSettingsRow(prismaClient = null) {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const prisma = prismaClient || (await getPrisma());
  const row = (await prisma.siteSetting.findUnique({ where: { id: 1 } }))
    || (await prisma.siteSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }));
  cache = { at: Date.now(), value: row };
  return row;
}

module.exports = { getSiteSettingsRow, invalidateSiteSettingsCache };
