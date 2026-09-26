const { getPrisma } = require('../lib/prisma');
const { cachedValue } = require('../lib/responseCache');
const { logActivity } = require('../lib/activityLog');
const { uploadFile, deleteFile, pathFromPublicUrl, buildUniqueFilename, resizeImageForUpload } = require('../lib/driveImageStorage');

// จำกัดจำนวนรูปประมวลภาพไว้ที่ 20 รูป (ตรงกับที่หน้าแรกโชว์แค่ 20 รูปล่าสุดอยู่แล้ว ดู home.js) กันรูปสะสมเยอะเกินจำเป็น
const MAX_GALLERY_PHOTOS = 20;

async function listPhotos(req, res) {
  const prisma = await getPrisma();
  const photos = await cachedValue('gallery:all', () => prisma.galleryPhoto.findMany({ orderBy: { createdAt: 'asc' } }));
  res.json(photos);
}

// ลบไฟล์ที่เคยอัปโหลดไว้เท่านั้น (URL ภายนอกที่พิมพ์เองจะแปลง path ไม่ได้ ข้ามไปเงียบ ๆ)
async function deleteUploadedFileIfManaged(urlPath) {
  const storagePath = pathFromPublicUrl(urlPath);
  if (!storagePath || !storagePath.startsWith('gallery/')) return false;

  try {
    await deleteFile(storagePath);
    return true;
  } catch (error) {
    return false;
  }
}

// อัปโหลด = สร้างข้อมูลเลย (ไม่ต้องมีฟอร์มแนบข้อมูลเพิ่มแบบทำเนียบประธานค่าย รูปประมวลภาพเป็นแค่รูปเปล่า ๆ)
async function uploadPhoto(req, res) {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });

  const prisma = await getPrisma();
  // เช็คก่อนอัปโหลดจริง (กันเสียเวลาย่อ/อัปโหลดขึ้น Storage ไปเปล่า ๆ ถ้าจะโดนปฏิเสธอยู่ดี)
  const currentCount = await prisma.galleryPhoto.count();
  if (currentCount >= MAX_GALLERY_PHOTOS) {
    return res.status(400).json({ error: `รูปประมวลภาพครบ ${MAX_GALLERY_PHOTOS} รูปแล้ว กรุณาลบรูปเก่าก่อนถึงจะเพิ่มรูปใหม่ได้` });
  }

  const storagePath = `gallery/${buildUniqueFilename('photo.jpg')}`;
  const resizedBuffer = await resizeImageForUpload(req.file.buffer);
  const imageUrl = await uploadFile(storagePath, resizedBuffer, 'image/jpeg');
  const created = await prisma.galleryPhoto.create({ data: { imageUrl } });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'GALLERY_PHOTO',
    entityId: created.id,
    summary: 'เพิ่มรูปประมวลภาพบรรยากาศค่าย',
  });

  res.status(201).json(created);
}

async function deletePhoto(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.galleryPhoto.delete({ where: { id } });

    await deleteUploadedFileIfManaged(deleted.imageUrl).catch(() => {});

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'GALLERY_PHOTO',
      entityId: deleted.id,
      summary: 'ลบรูปประมวลภาพบรรยากาศค่าย',
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบรูปที่ต้องการลบ' });
    throw error;
  }
}

module.exports = { listPhotos, uploadPhoto, deletePhoto };
