const { listChildFiles, trashFile } = require('./googleDrive');

const SNAPSHOT_NAME_PATTERN = /^snapshot-\d+-.+\.json$/;

// เก็บ snapshot ล่าสุดไว้แค่ keepCount อัน ย้ายอันเก่าลงถังขยะทิ้ง
// - ตอนกด "จบค่าย" (campController.js) เรียกแบบไม่ระบุ keepCount = เก็บไว้แค่อันเดียว
// - ตอนสำรองข้อมูลอัตโนมัติ/กดเองระหว่างค่ายยังดำเนินการอยู่ (campBackup.js) เรียกด้วย keepCount=50 กันสะสมไฟล์ไม่มีที่สิ้นสุดจนเปลืองพื้นที่ Drive
async function pruneOldSnapshots(campFolderId, keepCount = 1) {
  if (!campFolderId) return { trashedCount: 0 };
  const files = (await listChildFiles(campFolderId)).filter((f) => SNAPSHOT_NAME_PATTERN.test(f.name));
  if (files.length <= keepCount) return { trashedCount: 0 };

  const sorted = [...files].sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
  const toTrash = keepCount > 0 ? sorted.slice(0, -keepCount) : sorted; // ทุกอันยกเว้น keepCount อันใหม่สุด
  await Promise.all(toTrash.map((f) => trashFile(f.id)));
  return { trashedCount: toTrash.length };
}

module.exports = { pruneOldSnapshots };
