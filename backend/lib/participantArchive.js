const { isDriveConfigured, uploadJson } = require('./googleDrive');
const { getActiveCampDriveFolderId } = require('./campDriveFolder');

// ตัดข้อมูลอ่อนไหวออกก่อนแนบเข้าไฟล์เก็บถาวร - รหัสผ่าน/OTP ต้องไม่หลุดขึ้น Drive (เหมือน sanitizeUser ใน campBackup.js)
function sanitizeUser(user) {
  const { passwordHash, otpCode, otpExpiresAt, ...safe } = user;
  return safe;
}

// รวมข้อมูลน้องค่ายทั้งหมดของค่ายที่กำลังจบเป็น JSON ก้อนเดียว - แนบตารางอ้างอิง (กลุ่ม/วิชา/คอร์ส) ไว้ด้วย
// เพราะ Group/Subject/CourseFormat จะถูกล้างทิ้งตอนสร้างค่ายรุ่นถัดไป (ดู campWipe.js) เก็บชื่อไว้ในไฟล์นี้กันไฟล์อ่านไม่รู้เรื่องภายหลัง (เหลือแต่ id ดิบ ๆ)
async function buildParticipantArchiveSnapshot(prisma, generationNo) {
  const [users, profiles, subjectScores, oralExamAttempts, groups, subjects, courseFormats] = await Promise.all([
    prisma.user.findMany({ where: { role: 'PARTICIPANT' } }),
    prisma.participantProfile.findMany(),
    prisma.participantSubjectScore.findMany(),
    prisma.oralExamAttempt.findMany(),
    prisma.group.findMany(),
    prisma.subject.findMany(),
    prisma.courseFormat.findMany(),
  ]);

  return {
    schemaVersion: 1,
    archiveType: 'camp_end_participants',
    generationNo,
    archivedAt: new Date().toISOString(),
    counts: {
      participants: users.length,
      participantSubjectScores: subjectScores.length,
      oralExamAttempts: oralExamAttempts.length,
    },
    // ตารางอ้างอิง ณ เวลาที่จบค่าย - เอาไว้แปล id ในข้อมูลด้านล่างเป็นชื่อที่อ่านออกได้ แม้ตัวแถวจริงจะถูกล้างทิ้งไปแล้วตอนสร้างค่ายรุ่นถัดไป
    reference: {
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, explanationMaxScore: s.explanationMaxScore, achievementMaxScore: s.achievementMaxScore })),
      courseFormats: courseFormats.map((c) => ({ id: c.id, name: c.name })),
    },
    data: {
      users: users.map(sanitizeUser),
      participantProfiles: profiles,
      participantSubjectScores: subjectScores,
      oralExamAttempts,
    },
  };
}

// เก็บข้อมูลน้องค่ายทั้งหมดของค่ายปัจจุบันเป็นไฟล์ขึ้น Google Drive (โฟลเดอร์ของค่ายนั้น ๆ เดียวกับที่ใช้เก็บ snapshot/เอกสาร) ก่อนถูกลบออกจากฐานข้อมูลถาวรตอนกด "จบค่าย"
// บันทึกผลเป็นแถว CampBackupRun (trigger CAMP_END) ให้เห็นในประวัติสำรองข้อมูล/แดชบอร์ดเหมือนการสำรองข้อมูลปกติ
// ถ้ายังไม่ได้ตั้งค่า Google Drive หรืออัปโหลดไม่สำเร็จ จะ throw ออกไปเสมอ (ไม่มีทางลบข้อมูลน้องค่ายทิ้งได้โดยไม่มีไฟล์เก็บไว้ก่อน) - ผู้เรียกต้องจับ error แล้วไม่ไปต่อขั้นลบข้อมูล
// ไม่มีน้องค่ายเลย (participantCount = 0) ถือว่าไม่มีอะไรต้องเก็บ ข้ามขั้นนี้ไปเฉย ๆ ไม่ต้องมี Google Drive ก็ได้
async function archiveCampParticipants({ prisma, camp }) {
  const participantCount = await prisma.user.count({ where: { role: 'PARTICIPANT' } });
  if (participantCount === 0) {
    return { archived: false, participantCount: 0 };
  }

  if (!isDriveConfigured()) {
    const error = new Error('ยังไม่ได้ตั้งค่า Google Drive ระบบต้องเก็บไฟล์ข้อมูลน้องค่ายไว้ก่อนเสมอถึงจะลบออกจากฐานข้อมูลได้ กรุณาตั้งค่า Google Drive ก่อนจบค่าย');
    error.code = 'DRIVE_NOT_CONFIGURED';
    throw error;
  }

  const run = await prisma.campBackupRun.create({
    data: { campId: camp.id, generationNo: camp.generationNo, trigger: 'CAMP_END', status: 'PENDING' },
  });

  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const campFolderId = await getActiveCampDriveFolderId(prisma, rootFolderId);
    const snapshot = await buildParticipantArchiveSnapshot(prisma, camp.generationNo);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `participants-archive-${camp.generationNo}-${timestamp}.json`;
    const { fileId, bytes } = await uploadJson(snapshot, fileName, campFolderId);

    await prisma.campBackupRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        driveFolderId: campFolderId,
        snapshotFileId: fileId,
        snapshotFileName: fileName,
        fileCount: 1,
        totalBytes: bytes,
        finishedAt: new Date(),
      },
    });

    return { archived: true, participantCount, fileName, fileId, bytes };
  } catch (error) {
    await prisma.campBackupRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', errorMessage: String(error.message || error).slice(0, 500), finishedAt: new Date() },
    }).catch(() => {});
    throw error;
  }
}

module.exports = { archiveCampParticipants, buildParticipantArchiveSnapshot };
