const { listChildFiles, trashFile } = require('./googleDrive');

const SNAPSHOT_NAME_PATTERN = /^snapshot-\d+-.+\.json$/;

// เก็บ snapshot ล่าสุดของค่ายที่จบแล้วไว้แค่อันเดียว ย้ายอันเก่าลงถังขยะทิ้ง เรียกตอนกด "จบค่าย" (ดู campController.js)
async function pruneOldSnapshots(campFolderId) {
  if (!campFolderId) return { trashedCount: 0 };
  const files = (await listChildFiles(campFolderId)).filter((f) => SNAPSHOT_NAME_PATTERN.test(f.name));
  if (files.length <= 1) return { trashedCount: 0 };

  const sorted = [...files].sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
  const toTrash = sorted.slice(0, -1); // ทุกอันยกเว้นอันใหม่สุด
  await Promise.all(toTrash.map((f) => trashFile(f.id)));
  return { trashedCount: toTrash.length };
}

module.exports = { pruneOldSnapshots };
