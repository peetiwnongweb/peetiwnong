const { getPrisma } = require('./prisma');
const { getStorageStats } = require('./driveImageStorage');
const { toBangkokDay } = require('../middleware/usageTracker');

// ==========================================
// ภาพถ่ายขนาดฐานข้อมูล/พื้นที่เก็บไฟล์ วันละ 1 แถว (UsageDbSnapshot) ไว้ดูอัตราการโตระยะยาว
// เรียกจากตัวตั้งเวลาใน server.js วันละครั้ง + ตอนบูต (upsert ของวันนี้ รันซ้ำวันเดียวกันได้ไม่เกิดแถวซ้ำ)
// ทุก query เป็นค่าประมาณจาก catalog ของ Postgres (pg_stat_user_tables) ไม่ COUNT(*) ตารางจริง จึงเบามาก
// ==========================================

// ขนาด/จำนวนแถว (ประมาณ) ของทุกตารางใน schema public เรียงจากใหญ่ไปเล็ก
async function readTableStats(prisma) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT relname AS "table",
           pg_total_relation_size(relid)::float8 AS bytes,
           n_live_tup::float8 AS rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
  `);
  return rows.map((r) => ({ table: r.table, bytes: Number(r.bytes) || 0, rows: Number(r.rows) || 0 }));
}

async function readDatabaseBytes(prisma) {
  const rows = await prisma.$queryRawUnsafe('SELECT pg_database_size(current_database())::float8 AS bytes');
  return Number(rows[0]?.bytes) || 0;
}

// session ที่ยังไม่หมดอายุ = จำนวนบัญชี/อุปกรณ์ที่ล็อกอินค้างอยู่ (ตาราง session ของ connect-pg-simple)
async function readActiveSessionCount(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM "session" WHERE expire > now()');
    return Number(rows[0]?.count) || 0;
  } catch {
    return 0;
  }
}

// จำนวน connection ที่ต่ออยู่กับฐานข้อมูลนี้ (ผ่าน pooler จะเห็นเฉพาะที่ pooler เปิดจริง) - บาง provider ไม่ให้สิทธิ์อ่าน pg_stat_activity คืน null แทน
async function readConnectionCount(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()');
    return Number(rows[0]?.count) || 0;
  } catch {
    return null;
  }
}

// รวมขนาดไฟล์รูปภาพทั้งหมดบน Google Drive (ไล่เข้า subfolder ด้วย) - ไม่กี่โฟลเดอร์ (gallery/presidents/news) ไม่กี่ร้อยไฟล์ ยิง list ไม่กี่ครั้ง
async function readStorageTotals() {
  return getStorageStats();
}

// ค่าสด ๆ ตอนนี้ (ไม่บันทึกลง DB) ใช้ทั้งตอนถ่าย snapshot และตอนแดชบอร์ดขอดูค่าปัจจุบัน
async function readLiveDbMetrics() {
  const prisma = await getPrisma();
  const [databaseBytes, tableStats, sessionCount, connectionCount] = await Promise.all([
    readDatabaseBytes(prisma),
    readTableStats(prisma),
    readActiveSessionCount(prisma),
    readConnectionCount(prisma),
  ]);
  const totalRows = tableStats.reduce((sum, t) => sum + t.rows, 0);
  return { databaseBytes, tableStats, totalRows, sessionCount, connectionCount };
}

async function recordDailyUsageSnapshot() {
  const prisma = await getPrisma();
  const [live, storage, latestCamp] = await Promise.all([
    readLiveDbMetrics(),
    readStorageTotals().catch((error) => {
      console.error('อ่านขนาดรูปภาพบน Google Drive ไม่สำเร็จ (ข้ามส่วนนี้ใน snapshot):', error?.message || error);
      return { fileCount: 0, bytes: 0, configured: false };
    }),
    prisma.camp.findFirst({ orderBy: { generationNo: 'desc' }, select: { generationNo: true } }),
  ]);

  const day = new Date(`${toBangkokDay(new Date())}T00:00:00.000Z`);
  const data = {
    generationNo: latestCamp?.generationNo ?? null,
    databaseBytes: live.databaseBytes,
    totalRows: live.totalRows,
    sessionCount: live.sessionCount,
    storageFileCount: storage.fileCount,
    storageBytes: storage.bytes,
    tableSizes: live.tableStats.slice(0, 10),
  };
  await prisma.usageDbSnapshot.upsert({ where: { day }, update: data, create: { day, ...data } });
  return data;
}

module.exports = { recordDailyUsageSnapshot, readLiveDbMetrics, readStorageTotals };
