const { getPrisma } = require('./prisma');

// ==========================================
// สถานะค่ายปัจจุบัน - ตัวกำหนดว่าระบบวิชาการ/กิจกรรมเปิดใช้งานได้หรือยัง
// ค่าย "กำลังดำเนินการ" = มีแถว Camp ล่าสุดที่ยังไม่กด "จบค่าย" (การสร้างค่ายบังคับแค่ประธานค่าย ตำแหน่งอื่นเพิ่มทีหลังได้ ดู createCamp/updateCampLeadership)
// ก่อนสร้างค่าย: พี่ค่ายทุกคนเป็น "ทีมงานค่าย" ไม่มีตำแหน่ง และยังไม่มีน้องค่าย (สมัครได้เฉพาะตอนมีค่าย) ระบบทั้งสองจึงไม่มีอะไรให้ทำ ต้องล็อกไว้
// หลังจบค่าย: ตำแหน่งถูกรีเซ็ตหมดแล้ว ล็อกเหมือนกันจนกว่าจะสร้างค่ายครั้งถัดไป
// cache ไว้สั้น ๆ เพราะ middleware requireActiveCamp ถูกเรียกทุกคำขอของระบบวิชาการ/กิจกรรม ไม่ควรยิง DB ซ้ำทุกครั้ง - campController ล้าง cache ทันทีตอนสร้าง/จบ/ลบค่าย
// ==========================================
const CACHE_TTL_MS = 15 * 1000;
let cache = { at: 0, value: null };

function invalidateCampStateCache() {
  cache = { at: 0, value: null };
}

async function getCampState(prismaClient = null) {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const prisma = prismaClient || (await getPrisma());
  const latest = await prisma.camp.findFirst({
    orderBy: { generationNo: 'desc' },
    select: { generationNo: true, isEnded: true, createdAt: true },
  });
  const value = {
    hasCamp: !!latest,
    generationNo: latest ? latest.generationNo : null,
    isEnded: latest ? latest.isEnded : false,
    isActive: !!latest && !latest.isEnded,
    createdAt: latest ? latest.createdAt : null,
  };
  cache = { at: Date.now(), value };
  return value;
}

// ข้อความอธิบายว่าทำไมระบบถึงล็อก ใช้ตรงกันทั้ง API (409) และหน้าเว็บ
function describeLockedReason(state) {
  if (!state.hasCamp) {
    return 'ยังไม่มีค่ายที่กำลังดำเนินการ ระบบจะเปิดใช้งานเมื่อ WebManager สร้างค่ายและกำหนดประธานค่ายแล้ว';
  }
  return `ค่ายครั้งที่ ${state.generationNo} จบแล้ว ระบบปิดใช้งานจนกว่า WebManager จะสร้างค่ายครั้งถัดไป`;
}

module.exports = { getCampState, invalidateCampStateCache, describeLockedReason };
