const { getPrisma } = require('../lib/prisma');
const { logActivity } = require('../lib/activityLog');
const { uploadFile, deleteFile, pathFromPublicUrl, buildUniqueFilename } = require('../lib/driveImageStorage');

async function listPresidents(req, res) {
  const prisma = await getPrisma();
  const where = req.query.visibleOnly === 'true' ? { isVisible: true } : {};
  const committees = await prisma.committee.findMany({ where });
  // เรียงตามครั้งที่น้อยที่สุดของแต่ละคน (generationNos) จากน้อยไปมาก - Postgres/Prisma เรียงตาม min ของ array คอลัมน์โดยตรงไม่ได้
  committees.sort((a, b) => Math.min(...a.generationNos) - Math.min(...b.generationNos));
  res.json(committees);
}

// ตรวจสอบ generationNos ที่ส่งมา: ต้องไม่ว่าง เป็นจำนวนเต็มบวกทุกตัว ไม่ซ้ำกันเอง และไม่ไปชนกับครั้งที่ของคนอื่นที่มีอยู่แล้ว
// excludeId ใช้ตอนแก้ไข (ไม่เอาแถวของตัวเองมาเช็คชนกับตัวเอง)
async function validateGenerationNos(generationNos, excludeId, prisma) {
  if (!Array.isArray(generationNos) || generationNos.length === 0) {
    return { error: 'ต้องระบุครั้งที่อย่างน้อย 1 ครั้ง' };
  }

  const numbers = generationNos.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 1)) {
    return { error: 'ครั้งที่ต้องเป็นจำนวนเต็มบวกเท่านั้น' };
  }

  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (sorted.length !== numbers.length) {
    return { error: 'มีครั้งที่ซ้ำกันในรายการเดียวกัน' };
  }

  const others = await prisma.committee.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
  });
  for (const other of others) {
    const clash = sorted.find((n) => other.generationNos.includes(n));
    if (clash) {
      return { error: `ครั้งที่ ${clash} ถูกใช้ไปแล้วโดย ${other.fullName}` };
    }
  }

  return { sorted };
}

// อัปโหลดรูปประธานค่าย/โลโก้มหาวิทยาลัย ขึ้น Google Drive แบบ private แล้วเสิร์ฟผ่าน /media proxy (multer เก็บไฟล์เป็น buffer ในหน่วยความจำแค่ชั่วคราว)
// ?type=logo แยกเก็บใต้ presidents/logo/ ต่างหาก ไม่ปนกับรูปคน
async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
  const subfolder = req.query.type === 'logo' ? 'presidents/logo' : 'presidents';
  const storagePath = `${subfolder}/${buildUniqueFilename(req.file.originalname)}`;
  const url = await uploadFile(storagePath, req.file.buffer, req.file.mimetype);
  res.status(201).json({ url });
}

// ลบไฟล์ที่เคยอัปโหลดไว้เท่านั้น (URL ภายนอกที่พิมพ์เองจะแปลง path ไม่ได้ ข้ามไปเงียบ ๆ)
// คืน true/false ว่าลบจริงไหม ใช้ทั้งตอนแทนที่รูปเดิมด้วยรูปใหม่ และตอนลบข้อมูลประธานค่ายทั้งแถว
async function deleteUploadedFileIfManaged(urlPath) {
  const storagePath = pathFromPublicUrl(urlPath);
  if (!storagePath || !storagePath.startsWith('presidents/')) return false;

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

async function createPresident(req, res) {
  const { generationNos, fullName, nickname, imageUrl, university, universityLogoUrl, faculty, major, isVisible } = req.body;

  if (!fullName || !nickname) {
    return res.status(400).json({ error: 'ต้องระบุ fullName และ nickname' });
  }

  const prisma = await getPrisma();
  const validation = await validateGenerationNos(generationNos, null, prisma);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const created = await prisma.committee.create({
    data: {
      generationNos: validation.sorted,
      fullName,
      nickname,
      imageUrl: imageUrl || null,
      university: university || null,
      universityLogoUrl: universityLogoUrl || null,
      faculty: faculty || null,
      major: major || null,
      isVisible: isVisible === undefined ? true : Boolean(isVisible),
    },
  });

  await logActivity({
    actorEmail: req.session.user.email,
    actorRole: req.session.user.role,
    action: 'CREATE',
    entityType: 'COMMITTEE',
    entityId: created.id,
    summary: `เพิ่มประธานค่ายครั้งที่ ${created.generationNos.join(', ')} (${created.fullName})`,
  });

  res.status(201).json(created);
}

async function updatePresident(req, res) {
  const id = Number(req.params.id);
  const { generationNos, fullName, nickname, imageUrl, university, universityLogoUrl, faculty, major, isVisible } = req.body;

  const prisma = await getPrisma();

  let sortedGenerationNos;
  if (generationNos !== undefined) {
    const validation = await validateGenerationNos(generationNos, id, prisma);
    if (validation.error) return res.status(400).json({ error: validation.error });
    sortedGenerationNos = validation.sorted;
  }

  try {
    const updated = await prisma.committee.update({
      where: { id },
      data: {
        ...(sortedGenerationNos !== undefined && { generationNos: sortedGenerationNos }),
        ...(fullName !== undefined && { fullName }),
        ...(nickname !== undefined && { nickname }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(university !== undefined && { university: university || null }),
        ...(universityLogoUrl !== undefined && { universityLogoUrl: universityLogoUrl || null }),
        ...(faculty !== undefined && { faculty: faculty || null }),
        ...(major !== undefined && { major: major || null }),
        ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
      },
    });

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'UPDATE',
      entityType: 'COMMITTEE',
      entityId: updated.id,
      summary: `แก้ไขข้อมูลประธานค่ายครั้งที่ ${updated.generationNos.join(', ')} (${updated.fullName})`,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
    throw error;
  }
}

async function deletePresident(req, res) {
  const id = Number(req.params.id);
  const prisma = await getPrisma();
  try {
    const deleted = await prisma.committee.delete({ where: { id } });

    // ลบไฟล์รูป/โลโก้ที่ผูกกับแถวนี้ไปด้วย กันไฟล์ค้างเปลืองพื้นที่ (เงียบ ๆ ไม่ทำให้ทั้ง request ล้มถ้าลบไฟล์ไม่สำเร็จ)
    await Promise.all([
      deleteUploadedFileIfManaged(deleted.imageUrl).catch(() => {}),
      deleteUploadedFileIfManaged(deleted.universityLogoUrl).catch(() => {}),
    ]);

    await logActivity({
      actorEmail: req.session.user.email,
      actorRole: req.session.user.role,
      action: 'DELETE',
      entityType: 'COMMITTEE',
      entityId: deleted.id,
      summary: `ลบประธานค่ายครั้งที่ ${deleted.generationNos.join(', ')} (${deleted.fullName})`,
    });

    res.status(204).end();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการลบ' });
    throw error;
  }
}

module.exports = { listPresidents, createPresident, updatePresident, deletePresident, uploadImage, deleteImage };
