const { getPrisma } = require('./prisma');

// อายุสูงสุดก่อนลบทิ้งอัตโนมัติ กันตาราง log โตไม่มีที่สิ้นสุด
// ActivityLog = ประวัติการดำเนินการของแอดมิน/พี่ค่าย (ครอบ ~2 รอบค่ายถึงจะลบ)
// CampBackupRun = แค่บันทึกสถานะสำเร็จ/ล้มเหลวของการสำรองข้อมูล ไม่ใช่ตัวไฟล์จริง (ไฟล์จริงยังอยู่ใน Drive ตลอด ไม่ผูกกับการลบ log นี้)
const ACTIVITY_LOG_RETENTION_DAYS = 180;
const CAMP_BACKUP_RUN_RETENTION_DAYS = 90;

// สถิติการใช้งานเว็บ (ดู usageTracker.js) เก็บยาวกว่าเพราะไว้เทียบข้ามค่าย (1 ค่าย/ปี) - แถวต่อวันน้อยมากอยู่แล้ว
// รายชั่วโมงเก็บ 1 ปี (24 แถว/วัน) รายวันต่อ endpoint + ผู้ใช้ต่อวัน เก็บ 3 ปี ส่วน UsageDbSnapshot (1 แถว/วัน) ไม่ลบเลย
const USAGE_HOURLY_RETENTION_DAYS = 365;
const USAGE_DAILY_RETENTION_DAYS = 3 * 365;

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ลบ log เก่าเกินอายุที่กำหนดทิ้ง เรียกจากตัวตั้งเวลาใน server.js (วันละครั้ง) คืนจำนวนแถวที่ลบไปให้ log ไว้ดูได้
async function cleanupOldLogs() {
  const prisma = await getPrisma();

  const [activityLogResult, campBackupRunResult, usageHourlyResult, usageEndpointResult, usageActiveUserResult] = await Promise.all([
    prisma.activityLog.deleteMany({ where: { createdAt: { lt: daysAgo(ACTIVITY_LOG_RETENTION_DAYS) } } }),
    prisma.campBackupRun.deleteMany({ where: { startedAt: { lt: daysAgo(CAMP_BACKUP_RUN_RETENTION_DAYS) } } }),
    prisma.usageHourlyStat.deleteMany({ where: { bucketStart: { lt: daysAgo(USAGE_HOURLY_RETENTION_DAYS) } } }),
    prisma.usageEndpointDailyStat.deleteMany({ where: { day: { lt: daysAgo(USAGE_DAILY_RETENTION_DAYS) } } }),
    prisma.usageDailyActiveUser.deleteMany({ where: { day: { lt: daysAgo(USAGE_DAILY_RETENTION_DAYS) } } }),
  ]);

  return {
    activityLogDeleted: activityLogResult.count,
    campBackupRunDeleted: campBackupRunResult.count,
    usageStatsDeleted: usageHourlyResult.count + usageEndpointResult.count + usageActiveUserResult.count,
  };
}

module.exports = { cleanupOldLogs };
