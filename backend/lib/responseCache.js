// ==========================================
// cache ผลลัพธ์ของ endpoint สาธารณะที่ทุกคนได้ข้อมูลชุดเดียวกัน (ข่าว/กำหนดการ/ทำเนียบประธานค่าย/ประมวลภาพ)
// endpoint พวกนี้ถูกเรียกทุกครั้งที่มีคนเปิดหน้าแรก ถ้าดึงจากฐานข้อมูลทุกครั้งจะกิน Egress ของ Supabase แผนฟรี (5 GB/เดือน) เร็วมากช่วงค่ายที่คนใช้เยอะ
// จำไว้สั้น ๆ แล้วล้างทันทีเมื่อมีการเพิ่ม/แก้/ลบข้อมูลชุดนั้น (invalidateOnWrite ในไฟล์ route) คนแก้ข้อมูลจึงเห็นผลทันทีบนเซิร์ฟเวอร์เดียวกัน (Render รันตัวเดียว)
// ==========================================
const CACHE_TTL_MS = 60 * 1000;
const store = new Map(); // key -> { at, value }

async function cachedValue(key, loader) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await loader();
  store.set(key, { at: Date.now(), value });
  return value;
}

function invalidateCache(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(`${prefix}:`)) store.delete(key);
  }
}

// ใส่ไว้บนสุดของ router - คำขอที่ไม่ใช่ GET ที่ทำสำเร็จ (สถานะ < 400) ล้าง cache ของข้อมูลชุดนั้นทั้งหมด
function invalidateOnWrite(prefix) {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) invalidateCache(prefix);
      });
    }
    next();
  };
}

module.exports = { cachedValue, invalidateCache, invalidateOnWrite };
