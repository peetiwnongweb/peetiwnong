const path = require('path');
const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { getActiveCampDriveFolderId } = require('../lib/campDriveFolder');
const { isDriveConfigured, ensureFolder, uploadPublicFile, deleteFile } = require('../lib/googleDrive');
const { resolveParticipantWhere } = require('../lib/participantSimulation');

const DOCUMENTS_FOLDER_NAME = 'เอกสารประกอบการเรียน';
const DOC_INCLUDE = { courseFormat: { select: { id: true, name: true } } };
const DOC_ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];

// เอกสารเก็บบน Google Drive อย่างเดียว (ไม่มีสำเนาในดิสก์) เพื่อประหยัดพื้นที่ - เปิด public link ตรง ๆ ต่างจากรูปภาพที่ผ่าน /media proxy (ดู driveImageStorage.js)
// ถ้ามีค่ายอยู่แล้ว ใส่ตรงในโฟลเดอร์ค่าย "ค่ายN/" เลย ไม่ต้องมี subfolder ซ้อน (ปนกับ snapshot.json ในนั้นได้ ไม่มีปัญหา)
// ถ้ายังไม่มีค่ายเลย ตกไปที่โฟลเดอร์ "เอกสารประกอบการเรียน" ใต้โฟลเดอร์แม่แทน (กันไฟล์หลุดไปปนกับประมวลภาพ/ทำเนียบ/ข่าว)
async function getDocumentsFolderId(prisma) {
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  const campFolderId = await getActiveCampDriveFolderId(prisma, rootFolderId);
  if (campFolderId) return campFolderId;
  return ensureFolder(DOCUMENTS_FOLDER_NAME, rootFolderId);
}

// รายการเอกสารทั้งหมด (ฝั่งพี่ค่าย เห็นทุกคอร์สรวมถึงเอกสารทั่วไป)
async function listStudyDocuments(req, res) {
  const prisma = await getPrisma();
  const documents = await prisma.studyDocument.findMany({ include: DOC_INCLUDE, orderBy: DOC_ORDER });
  res.json(documents);
}

async function createStudyDocument(req, res) {
  const { description } = req.body;
  const courseFormatId = req.body.courseFormatId ? Number(req.body.courseFormatId) : null;

  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
  if (!isDriveConfigured()) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า Google Drive สำหรับเก็บเอกสาร' });

  // ฟอร์มอัปโหลด (ลากไฟล์วาง) ไม่มีช่องกรอกชื่อแล้ว - ตั้งชื่อเอกสารจากชื่อไฟล์ต้นฉบับให้อัตโนมัติ (ตัดนามสกุลไฟล์ทิ้ง)
  // multer/busboy ถอดรหัส originalname เป็น latin1 เสมอไม่ว่า client จะส่งมาเป็น UTF-8 จริง ๆ (ปัญหารู้จักกันดี) ต้องแปลงกลับเป็น utf8 เอง ไม่งั้นชื่อไฟล์ภาษาไทยจะเพี้ยน
  const decodedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const title = req.body.title && req.body.title.trim()
    ? req.body.title.trim()
    : path.basename(decodedOriginalName, path.extname(decodedOriginalName));

  const prisma = await getPrisma();
  const folderId = await getDocumentsFolderId(prisma);
  const uploaded = await uploadPublicFile(req.file.buffer, decodedOriginalName, folderId, req.file.mimetype);

  const created = await prisma.studyDocument.create({
    data: {
      title,
      description: description?.trim() || null,
      fileUrl: uploaded.url,
      driveFileId: uploaded.fileId,
      courseFormatId,
    },
    include: DOC_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'STUDY_DOCUMENT',
    entityId: created.id,
    summary: `เพิ่มเอกสาร "${created.title}"`,
  });

  res.status(201).json(created);
}

// แก้ไขเฉพาะข้อมูล (ชื่อ/คำอธิบาย/คอร์ส) ไม่รองรับเปลี่ยนไฟล์ - ถ้าไฟล์ผิดให้ลบแล้วอัปโหลดใหม่
async function updateStudyDocument(req, res) {
  const id = Number(req.params.id);
  const { title, description } = req.body;
  const courseFormatId = req.body.courseFormatId !== undefined
    ? (req.body.courseFormatId ? Number(req.body.courseFormatId) : null)
    : undefined;

  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อเอกสาร' });
  }

  const prisma = await getPrisma();
  try {
    const updated = await prisma.studyDocument.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(courseFormatId !== undefined && { courseFormatId }),
      },
      include: DOC_INCLUDE,
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'STUDY_DOCUMENT',
      entityId: updated.id,
      summary: `แก้ไขเอกสาร "${updated.title}"`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเอกสารที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deleteStudyDocument(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.studyDocument.delete({ where: { id } });

    await deleteFile(deleted.driveFileId).catch(() => {});

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'STUDY_DOCUMENT',
      entityId: deleted.id,
      summary: `ลบเอกสาร "${deleted.title}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเอกสารที่ต้องการลบ' });
    throw error;
  }
}

// เอกสารของคอร์สตัวเอง + เอกสารทั่วไป (ฝั่งน้องค่าย)
async function getMyStudyDocuments(req, res) {
  const prisma = await getPrisma();
  const where = resolveParticipantWhere(req);
  const profile = where
    ? await prisma.participantProfile.findUnique({ where, select: { courseFormatId: true } })
    : null;

  const documents = await prisma.studyDocument.findMany({
    where: profile?.courseFormatId
      ? { OR: [{ courseFormatId: null }, { courseFormatId: profile.courseFormatId }] }
      : { courseFormatId: null },
    include: DOC_INCLUDE,
    orderBy: DOC_ORDER,
  });
  res.json(documents);
}

module.exports = {
  listStudyDocuments,
  createStudyDocument,
  updateStudyDocument,
  deleteStudyDocument,
  getMyStudyDocuments,
};
