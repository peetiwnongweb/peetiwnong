const { getPrisma } = require('./prisma');
const { logActivity } = require('./activityLog');
const { getActiveCampDriveFolderId } = require('./campDriveFolder');
const { isDriveConfigured, uploadJson } = require('./googleDrive');
const { pruneOldSnapshots } = require('./driveRetention');

// เก็บ snapshot อัตโนมัติ/กดเองไว้แค่ 50 ไฟล์ล่าสุดต่อค่าย (ปกติสำรองทุก 12 ชม. ถ้าไม่จำกัดจะสะสมไฟล์ไม่มีที่สิ้นสุดจนเปลืองพื้นที่ Drive)
const AUTO_BACKUP_KEEP_COUNT = 50;

// รูปประธานค่าย/ประมวลภาพ/ข่าว อยู่บน Google Drive โดยตรงอยู่แล้ว (ดู backend/lib/driveImageStorage.js) เหมือนเอกสารประกอบการเรียน
// จึงไม่ต้องสำรองซ้ำอีกชั้นที่นี่ (ต่างจากสมัยที่ไฟล์จริงอยู่บน Supabase/R2 แล้วต้องดาวน์โหลดมาอัปขึ้น Drive ซ้ำ) เหลือแค่สำรอง snapshot ข้อมูลค่ายเป็น JSON

// Google API บางครั้งตอบ 502/503 เป็นหน้า HTML ดิบ (ไม่ใช่ JSON) ตอน gateway ล่ม - error.message ที่โยนมาจาก googleapis/gaxios
// เลยกลายเป็น HTML ทั้งหน้ารวม <style>/<meta> ถ้าเก็บดิบ ๆ ลง summary แล้วหน้าเว็บ render เป็น innerHTML (ไม่ escape) tag พวกนี้จะหลุดไปกระทบ layout ทั้งหน้า (<style> มีผลข้ามที่ที่มันอยู่ใน DOM เสมอ)
// ตัด tag ออกก่อนเก็บเสมอ กันปัญหานี้ตั้งแต่ต้นทาง ไม่ต้องพึ่งฝั่งแสดงผล escape ให้ถูกทุกจุด
function truncateError(message) {
  let str = String(message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
  if (/<[a-z][\s\S]*>/i.test(str)) {
    str = str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'เกิดข้อผิดพลาด (ปลายทางตอบกลับเป็น HTML แทน JSON)';
  }
  return str.length > 500 ? `${str.slice(0, 500)}…` : str;
}

// ตัดข้อมูลอ่อนไหวออกก่อนแนบเข้า snapshot - รหัสผ่าน/OTP ต้องไม่หลุดขึ้น Drive
function sanitizeUser(user) {
  const { passwordHash, otpCode, otpExpiresAt, ...safe } = user;
  return safe;
}

// รวมข้อมูลค่ายรุ่นปัจจุบันทั้งหมดเป็น JSON ก้อนเดียว (เฉพาะข้อมูลที่จะถูกล้างทิ้งตอนสร้างค่ายใหม่ ดู backend/lib/campWipe.js)
// เก็บ roster ตำแหน่งพี่ค่าย ณ ตอนนี้ไว้ด้วยเผื่ออ้างอิงย้อนหลัง แม้ตำแหน่งจริงจะถูกรีเซ็ตทีหลังตอนกด "จบค่าย" ก็ตาม (ไม่ได้ถูกลบ แค่รีเซ็ต)
async function buildSnapshot(prisma, generationNo) {
  const [
    camps, participants, participantProfiles, groups, campActivities, activityScores,
    subjects, subjectInstructors, participantSubjectScores, classSchedules, classScheduleInstructors,
    studyDocuments, courseFormats, gradeBands, scoreWeightSetting, campDepartments, staffPositions, staffRoster,
  ] = await Promise.all([
    prisma.camp.findMany({ include: { vicePresidents: true, departmentHeads: true }, orderBy: { generationNo: 'desc' } }),
    prisma.user.findMany({ where: { role: 'PARTICIPANT' } }),
    prisma.participantProfile.findMany(),
    prisma.group.findMany(),
    prisma.campActivity.findMany(),
    prisma.activityScore.findMany(),
    prisma.subject.findMany(),
    prisma.subjectInstructor.findMany(),
    prisma.participantSubjectScore.findMany(),
    prisma.classSchedule.findMany(),
    prisma.classScheduleInstructor.findMany(),
    prisma.studyDocument.findMany(),
    prisma.courseFormat.findMany(),
    prisma.gradeBand.findMany(),
    prisma.scoreWeightSetting.findUnique({ where: { id: 1 } }),
    prisma.campDepartment.findMany(),
    prisma.staffPosition.findMany(),
    prisma.staffProfile.findMany({ include: { user: { select: { id: true, email: true } }, position: true, department: true } }),
  ]);

  const sanitizedParticipants = participants.map(sanitizeUser);

  return {
    schemaVersion: 1,
    generationNo,
    exportedAt: new Date().toISOString(),
    counts: {
      participants: sanitizedParticipants.length,
      groups: groups.length,
      campActivities: campActivities.length,
      subjects: subjects.length,
      studyDocuments: studyDocuments.length,
    },
    data: {
      camps,
      participants: sanitizedParticipants,
      participantProfiles,
      groups,
      campActivities,
      activityScores,
      subjects,
      subjectInstructors,
      participantSubjectScores,
      classSchedules,
      classScheduleInstructors,
      studyDocuments,
      courseFormats,
      gradeBands,
      scoreWeightSetting,
      campDepartments,
      staffPositions,
      staffRoster,
    },
  };
}

// กันสำรองข้อมูลพร้อมกันหลายรอบ (ปุ่มกดเอง/ตัวตั้งเวลา/ก่อนสร้างค่ายใหม่ อาจถูกเรียกใกล้ ๆ กันได้)
// ถ้าไม่กันไว้ 2 รอบที่รันพร้อมกันจะเห็นรายชื่อไฟล์ใน Drive เหมือนกัน (เช็คก่อนอัปโหลด) แล้วอัปโหลดไฟล์เดิมซ้ำซ้อนกันทั้งคู่
let backupInProgress = false;

// จุดเข้าหลักของระบบสำรองข้อมูล: เรียกจากปุ่มกดเอง, ตัวตั้งเวลาอัตโนมัติ, และก่อนสร้างค่ายใหม่ (ดู campController.js)
// คืน {skipped:true} ถ้ายังไม่ได้ตั้งค่า Google Drive หรือมีอีกรอบกำลังสำรองอยู่แล้ว (ปล่อยผ่าน ไม่ถือว่าเป็นความล้มเหลว)
async function runBackup({ trigger, actorEmail }) {
  if (!isDriveConfigured()) return { skipped: true };
  if (backupInProgress) return { skipped: true, alreadyRunning: true };
  backupInProgress = true;

  try {
    return await runBackupInternal({ trigger, actorEmail });
  } finally {
    backupInProgress = false;
  }
}

async function runBackupInternal({ trigger, actorEmail }) {
  const prisma = await getPrisma();
  const latestCamp = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' } });

  const run = await prisma.campBackupRun.create({
    data: {
      campId: latestCamp?.id ?? null,
      generationNo: latestCamp?.generationNo ?? null,
      trigger,
      status: 'PENDING',
    },
  });

  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  try {
    // เอกสารประกอบการเรียนอัปโหลดตรงขึ้นโฟลเดอร์ของค่ายตั้งแต่ตอนอัปโหลดแล้ว (ดู studyDocumentController.js)
    // ไม่มีสำเนาที่ไหนอีกให้ backup ที่นี่ แค่เรียกใช้ helper เดียวกันเพื่อให้แน่ใจว่ามีโฟลเดอร์ค่าย + cache driveFolderId ไว้
    const campFolderId = await getActiveCampDriveFolderId(prisma, rootFolderId);

    let fileCount = 0;
    let totalBytes = 0;
    let snapshotFileId = null;
    let snapshotFileName = null;

    if (latestCamp && campFolderId) {
      const snapshot = await buildSnapshot(prisma, latestCamp.generationNo);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      snapshotFileName = `snapshot-${latestCamp.generationNo}-${timestamp}.json`;
      const snapshotResult = await uploadJson(snapshot, snapshotFileName, campFolderId);
      snapshotFileId = snapshotResult.fileId;
      fileCount += 1;
      totalBytes += snapshotResult.bytes;

      // ล้างไฟล์เก่าเกิน 50 อันทิ้งแบบไม่บล็อก - ทำพลาด/ช้าไม่กระทบผลของการสำรองรอบนี้ (ไฟล์ที่เพิ่งอัปโหลดสำเร็จแล้ว)
      pruneOldSnapshots(campFolderId, AUTO_BACKUP_KEEP_COUNT).catch((error) => console.error('ล้าง snapshot เก่าไม่สำเร็จ:', error));
    }

    const finished = await prisma.campBackupRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        driveFolderId: campFolderId || rootFolderId,
        snapshotFileId,
        snapshotFileName,
        fileCount,
        totalBytes,
        finishedAt: new Date(),
      },
    });

    await logActivity({
      actorEmail: actorEmail || 'system',
      actorRole: actorEmail ? 'WEBMANAGER' : 'SYSTEM',
      action: 'CREATE',
      entityType: 'CAMP_BACKUP',
      entityId: run.id,
      summary: `สำรองข้อมูล${latestCamp ? `ค่ายครั้งที่ ${latestCamp.generationNo}` : 'เว็บไซต์'}ขึ้น Google Drive สำเร็จ (${fileCount} ไฟล์)`,
    });

    return { skipped: false, success: true, run: finished };
  } catch (error) {
    console.error('สำรองข้อมูลขึ้น Google Drive ไม่สำเร็จ:', error);
    const errorMessage = truncateError(error.message);

    await prisma.campBackupRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', errorMessage, finishedAt: new Date() },
    });
    await logActivity({
      actorEmail: actorEmail || 'system',
      actorRole: actorEmail ? 'WEBMANAGER' : 'SYSTEM',
      action: 'CREATE',
      entityType: 'CAMP_BACKUP',
      entityId: run.id,
      summary: `สำรองข้อมูลขึ้น Google Drive ล้มเหลว: ${errorMessage}`,
    });

    return { skipped: false, success: false, errorMessage };
  }
}

module.exports = { runBackup };
