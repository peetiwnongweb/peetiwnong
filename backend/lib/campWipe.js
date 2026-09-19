const { deleteFile } = require('./googleDrive');

// ตารางที่ถูกล้างตอนสร้างค่ายใหม่ (ข้อมูลเฉพาะรุ่นค่าย ไม่ใช่หลักสูตร/ค่าคงที่ที่ใช้ซ้ำทุกค่าย)
// เรียงลำดับให้ปลอดภัยกับ FK: ลบตารางลูกก่อนตารางแม่เสมอ โดยเฉพาะ 2 จุดที่เป็น onDelete: SetNull (ไม่ cascade ให้อัตโนมัติ)
// - ClassSchedule.subjectId เป็น SetNull จึงลบ subject ก่อนไม่ได้ ต้องลบ classSchedule ก่อน
// - ParticipantProfile.groupId เป็น SetNull จึงลบ participantProfile ก่อน group เสมอ
async function wipeCampData(tx) {
  const counts = {};
  counts.participantSubjectScore = (await tx.participantSubjectScore.deleteMany({})).count;
  counts.activityScore = (await tx.activityScore.deleteMany({})).count;
  counts.classScheduleInstructor = (await tx.classScheduleInstructor.deleteMany({})).count;
  counts.classSchedule = (await tx.classSchedule.deleteMany({})).count;
  counts.subjectInstructor = (await tx.subjectInstructor.deleteMany({})).count;
  counts.subject = (await tx.subject.deleteMany({})).count;
  counts.studyDocument = (await tx.studyDocument.deleteMany({})).count;
  counts.campActivity = (await tx.campActivity.deleteMany({})).count;
  counts.participantProfile = (await tx.participantProfile.deleteMany({})).count;
  counts.group = (await tx.group.deleteMany({})).count;
  counts.participant = (await tx.user.deleteMany({ where: { role: 'PARTICIPANT' } })).count;
  return counts;
}

// อ่านรายชื่อไฟล์ Google Drive ของเอกสารที่กำลังจะถูกลบ "ก่อน" เข้า transaction เพราะแถวในฐานข้อมูลจะหายไปหลัง commit
// แล้วค่อยลบไฟล์จริงบน Drive "หลัง" transaction สำเร็จ กันไฟล์หายก่อนข้อมูลที่อ้างอิงถูกลบจริง
// (เอกสารเก็บบน Drive อย่างเดียว ไม่มีสำเนาในดิสก์แล้ว - ดู studyDocumentController.js)
async function collectStudyDocumentDriveFileIds(prisma) {
  const documents = await prisma.studyDocument.findMany({ select: { driveFileId: true } });
  return documents.map((d) => d.driveFileId).filter(Boolean);
}

async function deleteWipedDocumentFiles(driveFileIds) {
  await Promise.all(driveFileIds.map((fileId) => deleteFile(fileId).catch(() => {})));
}

// นับจำนวนแถวที่จะถูกลบ ให้หน้า "สร้างค่ายใหม่" แสดงตัวเลขยืนยันก่อนกดจริง (ไม่ลบอะไรจริง)
async function getWipePreviewCounts(prisma) {
  const [
    participant,
    participantProfile,
    participantSubjectScore,
    group,
    campActivity,
    activityScore,
    subject,
    subjectInstructor,
    classSchedule,
    classScheduleInstructor,
    studyDocument,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'PARTICIPANT' } }),
    prisma.participantProfile.count(),
    prisma.participantSubjectScore.count(),
    prisma.group.count(),
    prisma.campActivity.count(),
    prisma.activityScore.count(),
    prisma.subject.count(),
    prisma.subjectInstructor.count(),
    prisma.classSchedule.count(),
    prisma.classScheduleInstructor.count(),
    prisma.studyDocument.count(),
  ]);

  return {
    participant,
    participantProfile,
    participantSubjectScore,
    group,
    campActivity,
    activityScore,
    subject,
    subjectInstructor,
    classSchedule,
    classScheduleInstructor,
    studyDocument,
  };
}

module.exports = { wipeCampData, collectStudyDocumentDriveFileIds, deleteWipedDocumentFiles, getWipePreviewCounts };
