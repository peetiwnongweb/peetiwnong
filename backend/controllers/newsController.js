const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { uploadFile, deleteFile, pathFromPublicUrl, buildUniqueFilename, resizeImageForUpload } = require('../lib/driveImageStorage');

const VALID_TAGS = ['ANNOUNCE', 'ACTIVITY', 'SCHOLAR', 'OTHER'];
const VALID_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// ข้อมูลผู้เขียนแบบปลอดภัย (ไม่หลุด passwordHash) - pattern เดียวกับ classScheduleController.js/subjectController.js
const AUTHOR_INCLUDE = {
  author: { select: { id: true, email: true, staffProfile: { select: { firstName: true, lastName: true, nickname: true } } } },
};

// อัปโหลดรูปภาพประกอบข่าว ขึ้น Google Drive แบบ private แล้วเสิร์ฟผ่าน /media proxy (multer เก็บไฟล์เป็น buffer ในหน่วยความจำแค่ชั่วคราว) คืน URL กลับไปใส่ในฟอร์ม
async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
  const storagePath = `news/${buildUniqueFilename('photo.jpg')}`;
  const resizedBuffer = await resizeImageForUpload(req.file.buffer);
  const url = await uploadFile(storagePath, resizedBuffer, 'image/jpeg');
  res.status(201).json({ url });
}

// ลบไฟล์ที่เคยอัปโหลดไว้เท่านั้น (URL ภายนอกที่พิมพ์เองจะแปลง path ไม่ได้ ข้ามไปเงียบ ๆ)
async function deleteUploadedFileIfManaged(urlPath) {
  const storagePath = pathFromPublicUrl(urlPath);
  if (!storagePath || !storagePath.startsWith('news/')) return false;

  try {
    await deleteFile(storagePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteImage(req, res) {
  const { path: urlPath } = req.body;
  if (!urlPath || typeof urlPath !== 'string') {
    return res.status(400).json({ error: 'ต้องระบุ path ของไฟล์ที่จะลบ' });
  }

  await deleteUploadedFileIfManaged(urlPath);
  res.status(204).end();
}

async function listNews(req, res) {
  const prisma = await getPrisma();
  // เผยแพร่จริงบนหน้าเว็บสาธารณะได้ก็ต่อเมื่อทั้งเปิดเผยแพร่ (isVisible) และผ่านการอนุมัติแล้วเท่านั้น กันข่าวที่พี่ค่ายส่งเข้ามาแต่ยังไม่ได้อนุมัติหลุดออกเว็บ
  const where = req.query.visibleOnly === 'true' ? { isVisible: true, approvalStatus: 'APPROVED' } : {};
  const news = await prisma.news.findMany({ where, orderBy: { publishedAt: 'desc' }, include: AUTHOR_INCLUDE });
  res.json(news);
}

async function createNews(req, res) {
  const { tag, title, summary, detail, imageUrl, isHot, isVisible, publishedAt } = req.body;

  // เนื้อหาข่าว (detail) ไม่บังคับ เพราะบางข่าวมีเนื้อหาอยู่ในรูปภาพประกอบทั้งหมดอยู่แล้ว
  if (!title || !summary) {
    return res.status(400).json({ error: 'ต้องระบุ title และ summary' });
  }
  if (tag && !VALID_TAGS.includes(tag)) {
    return res.status(400).json({ error: `tag ต้องเป็นหนึ่งใน ${VALID_TAGS.join(', ')}` });
  }

  const prisma = await getPrisma();
  const created = await prisma.news.create({
    data: {
      tag: tag || 'OTHER',
      title,
      summary,
      detail: detail || '',
      imageUrl: imageUrl || null,
      isHot: Boolean(isHot),
      isVisible: isVisible === undefined ? true : Boolean(isVisible),
      authorId: req.session.user.id,
      ...(publishedAt && { publishedAt: new Date(publishedAt) }),
    },
    include: AUTHOR_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'NEWS',
    entityId: created.id,
    summary: `เพิ่มข่าว "${created.title}"`,
  });

  res.status(201).json(created);
}

async function updateNews(req, res) {
  const id = Number(req.params.id);
  const { tag, title, summary, detail, imageUrl, isHot, isVisible, publishedAt, approvalStatus } = req.body;

  if (tag && !VALID_TAGS.includes(tag)) {
    return res.status(400).json({ error: `tag ต้องเป็นหนึ่งใน ${VALID_TAGS.join(', ')}` });
  }
  if (approvalStatus !== undefined && !VALID_APPROVAL_STATUSES.includes(approvalStatus)) {
    return res.status(400).json({ error: `approvalStatus ต้องเป็นหนึ่งใน ${VALID_APPROVAL_STATUSES.join(', ')}` });
  }

  const prisma = await getPrisma();
  try {
    const updated = await prisma.news.update({
      where: { id },
      data: {
        ...(tag !== undefined && { tag }),
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(detail !== undefined && { detail }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(isHot !== undefined && { isHot: Boolean(isHot) }),
        ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
        ...(publishedAt !== undefined && { publishedAt: new Date(publishedAt) }),
        ...(approvalStatus !== undefined && { approvalStatus }),
      },
      include: AUTHOR_INCLUDE,
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'NEWS',
      entityId: updated.id,
      summary: `แก้ไขข่าว "${updated.title}"`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข่าวที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deleteNews(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.news.delete({ where: { id } });

    await deleteUploadedFileIfManaged(deleted.imageUrl).catch(() => {});

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'NEWS',
      entityId: deleted.id,
      summary: `ลบข่าว "${deleted.title}"`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข่าวที่ต้องการลบ' });
    throw error;
  }
}

// ==========================================
// เขียนข่าว: พี่ค่ายทุกคนไม่ว่าฝ่ายไหนส่งข่าวเข้ามาได้ ต้องรอ WebManager/แอดมินอนุมัติก่อนถึงจะเผยแพร่จริง (ใช้ requireAdminAccess ผ่าน updateNews ด้านบนในการอนุมัติ/ปฏิเสธ)
// ==========================================

// ส่งข่าวใหม่ - บังคับ PENDING เสมอไม่ว่า client จะส่งอะไรมา และรับแค่ field เนื้อหา (ไม่ให้ตั้ง isHot/isVisible/publishedAt เองแบบแอดมิน)
async function submitNews(req, res) {
  const { tag, title, summary, detail, imageUrl } = req.body;

  // เนื้อหาข่าว (detail) ไม่บังคับ เพราะบางข่าวมีเนื้อหาอยู่ในรูปภาพประกอบทั้งหมดอยู่แล้ว
  if (!title || !summary) {
    return res.status(400).json({ error: 'ต้องระบุ title และ summary' });
  }
  if (tag && !VALID_TAGS.includes(tag)) {
    return res.status(400).json({ error: `tag ต้องเป็นหนึ่งใน ${VALID_TAGS.join(', ')}` });
  }

  const prisma = await getPrisma();
  // Owner เปิดสวิตช์ "อนุมัติประชาสัมพันธ์อัตโนมัติ" ไว้ได้ที่หน้า "การอนุมัติประชาสัมพันธ์" - เปิดไว้ = เผยแพร่ขึ้นเว็บทันทีไม่ต้องรอตรวจสอบ
  const siteSettings = await prisma.siteSetting.findUnique({ where: { id: 1 }, select: { newsAutoApprove: true } });
  const approvalStatus = siteSettings?.newsAutoApprove ? 'APPROVED' : 'PENDING';

  const created = await prisma.news.create({
    data: {
      tag: tag || 'OTHER',
      title,
      summary,
      detail: detail || '',
      imageUrl: imageUrl || null,
      isVisible: true,
      approvalStatus,
      authorId: req.session.user.id,
    },
    include: AUTHOR_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'NEWS',
    entityId: created.id,
    summary: approvalStatus === 'APPROVED'
      ? `ส่งข่าว "${created.title}" (อนุมัติอัตโนมัติ เผยแพร่ทันที)`
      : `ส่งข่าว "${created.title}" เข้าคิวรออนุมัติ`,
  });

  res.status(201).json(created);
}

// รายการข่าวที่ตัวเองส่งเข้ามาเท่านั้น - ใช้เติมแท็บ "เช็คข่าว" ของหน้าพี่ค่าย
async function listMyNews(req, res) {
  const prisma = await getPrisma();
  const news = await prisma.news.findMany({
    where: { authorId: req.session.user.id },
    orderBy: { createdAt: 'desc' },
    include: AUTHOR_INCLUDE,
  });
  res.json(news);
}

// แก้ไขข่าวของตัวเองได้เฉพาะตอนยังไม่ผ่านการอนุมัติเท่านั้น (แก้ข่าวที่ถูกปฏิเสธ = ส่งกลับเข้าคิว PENDING ใหม่โดยอัตโนมัติ)
async function updateMyNews(req, res) {
  const id = Number(req.params.id);
  const { tag, title, summary, detail, imageUrl } = req.body;

  // เนื้อหาข่าว (detail) ไม่บังคับ เพราะบางข่าวมีเนื้อหาอยู่ในรูปภาพประกอบทั้งหมดอยู่แล้ว
  if (!title || !summary) {
    return res.status(400).json({ error: 'ต้องระบุ title และ summary' });
  }
  if (tag && !VALID_TAGS.includes(tag)) {
    return res.status(400).json({ error: `tag ต้องเป็นหนึ่งใน ${VALID_TAGS.join(', ')}` });
  }

  const prisma = await getPrisma();
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'ไม่พบข่าวที่ต้องการแก้ไข' });
  if (existing.authorId !== req.session.user.id) {
    return res.status(403).json({ error: 'แก้ไขได้เฉพาะข่าวที่ตัวเองส่งเท่านั้น' });
  }
  if (existing.approvalStatus === 'APPROVED') {
    return res.status(400).json({ error: 'ข่าวนี้ผ่านการอนุมัติแล้ว ไม่สามารถแก้ไขได้ กรุณาเขียนข่าวใหม่แทน' });
  }

  const updated = await prisma.news.update({
    where: { id },
    data: {
      tag: tag || 'OTHER',
      title,
      summary,
      detail: detail || '',
      imageUrl: imageUrl || null,
      approvalStatus: 'PENDING',
    },
    include: AUTHOR_INCLUDE,
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'UPDATE',
    entityType: 'NEWS',
    entityId: updated.id,
    summary: `แก้ไขข่าว "${updated.title}" และส่งกลับเข้าคิวรออนุมัติ`,
  });

  res.json(updated);
}

// ลบข่าวของตัวเองได้ทุกสถานะ (ต่างจากแก้ไขที่ล็อกไว้หลังอนุมัติแล้ว) - เผยแพร่ไปแล้วแต่ล้าสมัย/พิมพ์ผิดร้ายแรง เจ้าของข่าวควรถอดออกเองได้โดยไม่ต้องรอ Admin
async function deleteMyNews(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();

  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'ไม่พบข่าวที่ต้องการลบ' });
  if (existing.authorId !== req.session.user.id) {
    return res.status(403).json({ error: 'ลบได้เฉพาะข่าวที่ตัวเองส่งเท่านั้น' });
  }

  await prisma.news.delete({ where: { id } });
  await deleteUploadedFileIfManaged(existing.imageUrl).catch(() => {});

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'DELETE',
    entityType: 'NEWS',
    entityId: existing.id,
    summary: `ลบข่าว "${existing.title}" ของตัวเอง`,
  });

  res.status(204).end();
}

module.exports = {
  listNews, createNews, updateNews, deleteNews, uploadImage, deleteImage,
  submitNews, listMyNews, updateMyNews, deleteMyNews,
};
