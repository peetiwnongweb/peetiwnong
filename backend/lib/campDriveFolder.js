const { ensureFolder } = require('./googleDrive');

// หา (หรือสร้าง) โฟลเดอร์ Drive ของค่ายรุ่นล่าสุด cache id ไว้ที่ Camp.driveFolderId กันค้นหาซ้ำทุกครั้ง
// คืน null ถ้ายังไม่เคยสร้างค่ายเลยในระบบ (ดู backend/lib/campBackup.js และ studyDocumentController.js ที่ใช้ร่วมกัน)
async function getActiveCampDriveFolderId(prisma, rootFolderId) {
  const latestCamp = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' } });
  if (!latestCamp) return null;
  if (latestCamp.driveFolderId) return latestCamp.driveFolderId;

  const campFolderId = await ensureFolder(`ค่าย${latestCamp.generationNo}`, rootFolderId);
  await prisma.camp.update({ where: { id: latestCamp.id }, data: { driveFolderId: campFolderId } });
  return campFolderId;
}

module.exports = { getActiveCampDriveFolderId };
