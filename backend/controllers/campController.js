const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { getWipePreviewCounts, wipeCampData, collectStudyDocumentDriveFileIds, deleteWipedDocumentFiles } = require('../lib/campWipe');
const { runBackup } = require('../lib/campBackup');
const { pruneOldSnapshots } = require('../lib/driveRetention');
const { invalidateCampStateCache } = require('../lib/campState');
const { archiveCampParticipants } = require('../lib/participantArchive');

function toFullName(profile) {
  const prefixedFirstName = `${profile?.prefix || ''}${profile?.firstName || ''}`;
  return [prefixedFirstName, profile?.lastName].filter(Boolean).join(' ') || '-';
}

// รายชื่อพี่ค่ายทั้งหมด (role=STAFF) ให้ตัวเลือกค้นหาในฟอร์มสร้างค่าย (ประธาน/รองประธาน/เลขา/หัวหน้าฝ่าย)
async function listStaffOptions(req, res) {
  const prisma = await getPrisma();
  const users = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: { id: true, staffProfile: { select: { prefix: true, firstName: true, lastName: true, nickname: true } } },
    orderBy: { id: 'asc' },
  });
  res.json(users
    .filter((u) => u.staffProfile)
    .map((u) => ({ userId: u.id, fullName: toFullName(u.staffProfile), nickname: u.staffProfile.nickname || null })));
}

const CAMP_STAFF_SELECT = { select: { prefix: true, firstName: true, lastName: true, nickname: true } };
const CAMP_LIST_INCLUDE = {
  president: { select: { id: true, staffProfile: CAMP_STAFF_SELECT } },
  secretary: { select: { id: true, staffProfile: CAMP_STAFF_SELECT } },
  vicePresidents: { include: { user: { select: { id: true, staffProfile: CAMP_STAFF_SELECT } } } },
  departmentHeads: {
    include: {
      department: { select: { id: true, name: true } },
      user: { select: { id: true, staffProfile: CAMP_STAFF_SELECT } },
    },
  },
};

function serializeCamp(camp) {
  return {
    id: camp.id,
    generationNo: camp.generationNo,
    isEnded: camp.isEnded,
    createdAt: camp.createdAt,
    president: camp.president ? { userId: camp.president.id, fullName: toFullName(camp.president.staffProfile) } : null,
    secretary: camp.secretary ? { userId: camp.secretary.id, fullName: toFullName(camp.secretary.staffProfile) } : null,
    vicePresidents: camp.vicePresidents.map((vp) => ({ userId: vp.user.id, fullName: toFullName(vp.user.staffProfile) })),
    departmentHeads: camp.departmentHeads.map((dh) => ({
      departmentId: dh.department.id,
      departmentName: dh.department.name,
      userId: dh.user.id,
      fullName: toFullName(dh.user.staffProfile),
    })),
  };
}

// ประวัติค่ายทั้งหมด เรียงครั้งที่ล่าสุดก่อน
async function listCamps(req, res) {
  const prisma = await getPrisma();
  const camps = await prisma.camp.findMany({ orderBy: { generationNo: 'desc' }, include: CAMP_LIST_INCLUDE });
  res.json(camps.map(serializeCamp));
}

// ตรวจสอบข้อมูลฟอร์มสร้างค่าย คืน { error } หรือค่าที่ผ่านการตรวจสอบแล้วพร้อมใช้งาน
async function validateCreateCampBody(body, prisma) {
  const generationNo = Number(body.generationNo);
  if (!Number.isInteger(generationNo) || generationNo < 1) {
    return { error: 'ครั้งที่ต้องเป็นจำนวนเต็มบวก' };
  }
  const existing = await prisma.camp.findUnique({ where: { generationNo } });
  if (existing) return { error: `ครั้งที่ ${generationNo} ถูกใช้ไปแล้ว` };

  const presidentUserId = Number(body.presidentUserId);
  const secretaryUserId = Number(body.secretaryUserId);
  if (!presidentUserId) return { error: 'ต้องระบุประธานค่าย' };
  if (!secretaryUserId) return { error: 'ต้องระบุเลขานุการ' };

  const vicePresidentUserIds = Array.isArray(body.vicePresidentUserIds)
    ? [...new Set(body.vicePresidentUserIds.map(Number).filter(Boolean))]
    : [];

  const departmentHeadsInput = Array.isArray(body.departmentHeads) ? body.departmentHeads : [];
  const departmentHeads = departmentHeadsInput
    .map((d) => ({ departmentId: Number(d.departmentId), userId: Number(d.userId) }))
    .filter((d) => d.departmentId && d.userId);

  // ทุกฝ่ายที่มีอยู่จริงต้องมีหัวหน้าฝ่ายครบ ไม่ขาด/ไม่เกิน/ไม่ซ้ำฝ่าย
  const departments = await prisma.campDepartment.findMany({ select: { id: true } });
  const departmentIds = departments.map((d) => d.id);
  const suppliedIds = departmentHeads.map((d) => d.departmentId);
  const missing = departmentIds.filter((id) => !suppliedIds.includes(id));
  if (missing.length) return { error: 'กรุณาเลือกหัวหน้าฝ่ายให้ครบทุกฝ่าย' };
  if (suppliedIds.some((id) => !departmentIds.includes(id))) return { error: 'พบฝ่ายที่ไม่มีอยู่จริงในระบบ' };
  if (new Set(suppliedIds).size !== suppliedIds.length) return { error: 'มีฝ่ายซ้ำกันในรายการหัวหน้าฝ่าย' };

  // กันคนเดียวถือหลายตำแหน่งพร้อมกันในค่ายเดียวกัน (ป้องกันความกำกวมว่า StaffProfile.positionId สุดท้ายควรเป็นตำแหน่งไหน)
  const allAssigned = [presidentUserId, secretaryUserId, ...vicePresidentUserIds, ...departmentHeads.map((d) => d.userId)];
  if (new Set(allAssigned).size !== allAssigned.length) {
    return { error: 'พี่ค่าย 1 คนไม่สามารถได้รับมอบหมายมากกว่า 1 ตำแหน่งในค่ายเดียวกันได้' };
  }

  // ทุก id ที่อ้างถึงต้องเป็นบัญชี STAFF จริง
  const staffUsers = await prisma.user.findMany({ where: { id: { in: allAssigned }, role: 'STAFF' }, select: { id: true } });
  if (staffUsers.length !== new Set(allAssigned).size) {
    return { error: 'พบผู้ใช้ที่ไม่ใช่บัญชีพี่ค่าย (STAFF) หรือไม่พบในระบบ' };
  }

  return { generationNo, presidentUserId, secretaryUserId, vicePresidentUserIds, departmentHeads };
}

// สร้างค่ายใหม่: มอบตำแหน่ง/ฝ่ายให้ผู้ถูกเลือกจริง + ลบน้องค่ายทั้งหมดอย่างถาวร (ทำในทรานแซกชันเดียวกัน)
async function createCamp(req, res) {
  const prisma = await getPrisma();
  const result = await validateCreateCampBody(req.body, prisma);
  if (result.error) return res.status(400).json({ error: result.error });
  const { generationNo, presidentUserId, secretaryUserId, vicePresidentUserIds, departmentHeads } = result;

  const [posPresident, posVice, posSecretary, posHead] = await Promise.all([
    prisma.staffPosition.findFirst({ where: { name: 'ประธานค่าย' } }),
    prisma.staffPosition.findFirst({ where: { name: 'รองประธานค่าย' } }),
    prisma.staffPosition.findFirst({ where: { name: 'เลขานุการ' } }),
    prisma.staffPosition.findFirst({ where: { name: 'หัวหน้าฝ่าย' } }),
  ]);
  if (!posPresident || !posVice || !posSecretary || !posHead) {
    return res.status(500).json({ error: 'ไม่พบตำแหน่งมาตรฐานในระบบ (ประธานค่าย/รองประธานค่าย/เลขานุการ/หัวหน้าฝ่าย) กรุณารัน seed ก่อน' });
  }

  // สำรองข้อมูลค่ายปัจจุบัน (ถ้ามี) ขึ้น Google Drive ก่อนแตะข้อมูลใด ๆ - ถ้าตั้งค่า Drive ไว้แล้วแต่สำรองไม่สำเร็จ (เช่น Drive API ล่ม)
  // ให้บล็อกการสร้างค่ายทั้งหมดไว้ก่อน ไม่ลบ/ไม่สร้างอะไรเลย จนกว่าจะลองสำรองใหม่สำเร็จ (ถ้ายังไม่ได้ตั้งค่า Drive เลยจะข้ามขั้นนี้ไปเฉย ๆ ไม่บล็อก)
  const backupResult = await runBackup({ trigger: 'CAMP_CREATE', actorEmail: req.session.user.email });
  if (!backupResult.skipped && !backupResult.success) {
    return res.status(503).json({ error: `สำรองข้อมูลค่ายเดิมขึ้น Google Drive ไม่สำเร็จ จึงยังไม่สร้างค่ายใหม่ให้: ${backupResult.errorMessage}` });
  }

  const participantCountBefore = await prisma.user.count({ where: { role: 'PARTICIPANT' } });
  // อ่านรายชื่อไฟล์ Drive ของเอกสารที่จะถูกลบไว้ "ก่อน" เข้า transaction เพราะแถวในฐานข้อมูลจะหายไปหลัง commit (ดู backend/lib/campWipe.js)
  const documentDriveFileIdsToDelete = await collectStudyDocumentDriveFileIds(prisma);

  const camp = await prisma.$transaction(async (tx) => {
    // ล้างข้อมูลเฉพาะรุ่นค่ายเดิมทั้งหมด (น้องค่าย/กลุ่ม/กิจกรรม/วิชา/ตารางเรียน/เอกสาร) เก็บเฉพาะหลักสูตร/ค่าคงที่ที่ใช้ซ้ำทุกค่ายไว้
    await wipeCampData(tx);

    const created = await tx.camp.create({
      data: {
        generationNo,
        presidentUserId,
        secretaryUserId,
        vicePresidents: { create: vicePresidentUserIds.map((userId) => ({ userId })) },
        departmentHeads: { create: departmentHeads.map((d) => ({ departmentId: d.departmentId, userId: d.userId })) },
      },
    });

    await tx.staffProfile.update({ where: { userId: presidentUserId }, data: { positionId: posPresident.id } });
    await tx.staffProfile.update({ where: { userId: secretaryUserId }, data: { positionId: posSecretary.id } });
    for (const userId of vicePresidentUserIds) {
      await tx.staffProfile.update({ where: { userId }, data: { positionId: posVice.id } });
    }
    for (const d of departmentHeads) {
      await tx.staffProfile.update({ where: { userId: d.userId }, data: { positionId: posHead.id, departmentId: d.departmentId } });
    }

    return created;
  }, { maxWait: 15000, timeout: 120000 });

  invalidateCampStateCache();

  // ลบไฟล์เอกสารบน Google Drive "หลัง" transaction สำเร็จ กันไฟล์หายก่อนข้อมูลที่อ้างอิงถูกลบจริง
  await deleteWipedDocumentFiles(documentDriveFileIdsToDelete);

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'CAMP',
    entityId: camp.id,
    summary: `สร้างค่ายครั้งที่ ${generationNo} และล้างข้อมูลค่ายเดิมทั้งหมด (น้องค่าย ${participantCountBefore} คน รวมถึงกลุ่ม/กิจกรรม/วิชา/เอกสาร) อย่างถาวร`,
  });

  const full = await prisma.camp.findUnique({ where: { id: camp.id }, include: CAMP_LIST_INCLUDE });
  res.status(201).json(serializeCamp(full));
}

// จบค่าย: (1) เก็บข้อมูลน้องค่ายทั้งหมดเป็นไฟล์ขึ้น Google Drive (2) ลบน้องค่ายทั้งหมดออกจากฐานข้อมูลถาวร (3) รีเซ็ตตำแหน่ง/ฝ่ายของ "ทุก" พี่ค่ายกลับเป็นทีมงานค่าย + ไม่มีฝ่าย แล้ว mark ค่ายล่าสุด (ที่ยังไม่จบ) เป็น isEnded
// ขั้น (1) ต้องสำเร็จก่อนเสมอถึงจะไปขั้น (2) ต่อได้ - ไม่มีทางลบข้อมูลน้องค่ายทิ้งโดยไม่มีไฟล์เก็บไว้ก่อน (ดู backend/lib/participantArchive.js)
async function endCamp(req, res) {
  const prisma = await getPrisma();
  const latestCamp = await prisma.camp.findFirst({ orderBy: { generationNo: 'desc' } });
  if (!latestCamp) return res.status(400).json({ error: 'ยังไม่มีค่ายในระบบ' });
  if (latestCamp.isEnded) return res.status(400).json({ error: `ค่ายครั้งที่ ${latestCamp.generationNo} จบไปแล้ว` });

  const posTeam = await prisma.staffPosition.findFirst({ where: { name: 'ทีมงานค่าย' } });
  if (!posTeam) return res.status(500).json({ error: 'ไม่พบตำแหน่ง "ทีมงานค่าย" ในระบบ กรุณารัน seed ก่อน' });

  let archiveResult;
  try {
    archiveResult = await archiveCampParticipants({ prisma, camp: latestCamp });
  } catch (error) {
    console.error('เก็บไฟล์น้องค่ายก่อนจบค่ายไม่สำเร็จ:', error);
    const status = error.code === 'DRIVE_NOT_CONFIGURED' ? 503 : 502;
    return res.status(status).json({ error: error.message || 'เก็บไฟล์น้องค่ายไม่สำเร็จ จึงยังไม่จบค่ายให้' });
  }

  const [staffResult] = await prisma.$transaction([
    prisma.staffProfile.updateMany({ data: { positionId: posTeam.id, departmentId: null } }),
    prisma.user.deleteMany({ where: { role: 'PARTICIPANT' } }),
    prisma.camp.update({ where: { id: latestCamp.id }, data: { isEnded: true } }),
  ], { maxWait: 15000, timeout: 120000 });
  invalidateCampStateCache();

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'CAMP',
    entityId: latestCamp.id,
    summary: archiveResult.archived
      ? `จบค่ายครั้งที่ ${latestCamp.generationNo}: รีเซ็ตตำแหน่งพี่ค่ายทั้งหมด (${staffResult.count} คน) กลับเป็น "ทีมงานค่าย", เก็บไฟล์น้องค่าย ${archiveResult.participantCount} คน (${archiveResult.fileName}) ขึ้น Google Drive แล้วลบออกจากฐานข้อมูลถาวร`
      : `จบค่ายครั้งที่ ${latestCamp.generationNo}: รีเซ็ตตำแหน่งพี่ค่ายทั้งหมด (${staffResult.count} คน) กลับเป็น "ทีมงานค่าย" (ไม่มีน้องค่ายในระบบให้เก็บไฟล์)`,
  });

  // ค่ายจบแล้วไม่ต้องเก็บ snapshot ทุกรอบ 12 ชม. อีกต่อไป เก็บไว้แค่อันล่าสุดพอ (เงียบ ๆ ไม่ทำให้ทั้ง request ล้มถ้าล้างไม่สำเร็จ) - ไฟล์เก็บข้อมูลน้องค่าย (participants-archive-*.json) ไม่โดนล้างไปด้วย (คนละ pattern ชื่อไฟล์ ดู driveRetention.js)
  pruneOldSnapshots(latestCamp.driveFolderId).catch((error) => console.error('ล้าง snapshot เก่าไม่สำเร็จ:', error));

  res.json({ generationNo: latestCamp.generationNo, staffResetCount: staffResult.count, participantArchive: archiveResult });
}

// ลบประวัติค่าย 1 รุ่นทิ้ง - ลบแค่แถว Camp + ผู้ดำรงตำแหน่งของรุ่นนั้น (CampVicePresident/CampDepartmentHead cascade ตาม schema)
// ไม่กระทบข้อมูลน้องค่าย/กลุ่ม/กิจกรรม/วิชา/ตารางเรียนเลย เพราะฝั่งนั้นผูกกับรุ่นค่ายด้วย campGenerationNo แบบ snapshot ตัวเลขเฉย ๆ ไม่ใช่ foreign key มาที่ตาราง Camp
async function deleteCamp(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.camp.delete({ where: { id } });
    invalidateCampStateCache();

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'CAMP',
      entityId: deleted.id,
      summary: `ลบประวัติค่ายครั้งที่ ${deleted.generationNo}`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบค่ายที่ต้องการลบ' });
    throw error;
  }
}

// จำนวนแถวที่จะถูกลบถ้ากด "สร้างค่ายใหม่" ตอนนี้ ให้ modal ยืนยันแสดงก่อนกดจริง (ไม่ลบอะไรจริง)
async function getWipePreview(req, res) {
  const prisma = await getPrisma();
  const counts = await getWipePreviewCounts(prisma);
  res.json(counts);
}

// กดสำรองข้อมูลขึ้น Google Drive เอง (นอกเหนือจากรอบอัตโนมัติ) ดู backend/lib/campBackup.js
async function triggerManualBackup(req, res) {
  const result = await runBackup({ trigger: 'MANUAL', actorEmail: req.session.user.email });
  if (result.skipped) return res.json({ skipped: true });
  if (!result.success) return res.status(502).json({ error: `สำรองข้อมูลไม่สำเร็จ: ${result.errorMessage}` });
  res.json({ skipped: false, run: result.run });
}

// ประวัติการสำรองข้อมูลทั้งหมด (ล่าสุดก่อน) ให้แท็บ "สำรองข้อมูล" แสดง
async function listCampBackups(req, res) {
  const prisma = await getPrisma();
  const runs = await prisma.campBackupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
  res.json(runs);
}

module.exports = {
  listStaffOptions, listCamps, createCamp, endCamp, deleteCamp, getWipePreview, triggerManualBackup, listCampBackups,
};
