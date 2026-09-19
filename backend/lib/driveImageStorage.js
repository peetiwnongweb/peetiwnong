const sharp = require('sharp');
const {
  isDriveConfigured, ensureFolder, uploadBuffer, deleteFile: driveDeleteFile, listChildFiles, listChildFolders,
} = require('./googleDrive');

// ==========================================
// รูปประธานค่าย/โลโก้มหาวิทยาลัย/ประมวลภาพ/ข่าว เก็บบน Google Drive (บัญชีเดียวกับที่ใช้สำรองข้อมูล/เอกสารอยู่แล้ว - ฟรี ไม่ต้องผูกบัตร)
// อัปโหลดแบบ private เสมอ (ไม่เปิด "anyone with link") แล้วเสิร์ฟผ่าน proxy ของเราเอง (ดู backend/routes/mediaRoutes.js)
// เพราะลิงก์ public ตรงของ Drive ใช้แสดงรูปใน <img> ไม่ได้ดี (เจอหน้าเตือนไวรัส/โดน rate limit) - proxy คุม cache header เองได้ด้วย ลดจำนวนครั้งที่ต้องดึงจาก Drive ซ้ำ
// URL ที่คืนออกไปเก็บใน DB มีรูปแบบ "/media/<หมวด>/<driveFileId>" - ส่วน "หมวด" (gallery/presidents/news) ใช้แค่ตรวจสอบสิทธิ์ตอนลบเท่านั้น ไม่ใช่ path จริงบน Drive
// ==========================================

function isConfigured() {
  return isDriveConfigured();
}

async function resizeImageForUpload(buffer, maxWidth = 1600) {
  return sharp(buffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

const IMAGES_ROOT_FOLDER_NAME = 'รูปภาพเว็บไซต์';
const folderIdCache = new Map(); // key: "gallery" | "presidents" | "presidents/logo" | "news" -> Drive folder id

// หา (หรือสร้าง) โฟลเดอร์ตาม path ที่ระบุ ไล่ทีละระดับใต้โฟลเดอร์รูปภาพเว็บไซต์ (แคชไว้ในหน่วยความจำกันค้นหาซ้ำทุกครั้งที่อัปโหลด)
async function resolveFolderId(folderPath) {
  if (folderIdCache.has(folderPath)) return folderIdCache.get(folderPath);

  const rootFolderId = await ensureFolder(IMAGES_ROOT_FOLDER_NAME, process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  let currentId = rootFolderId;
  let currentPath = '';
  for (const segment of folderPath.split('/')) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    if (folderIdCache.has(currentPath)) {
      currentId = folderIdCache.get(currentPath);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- ไล่ทีละระดับตั้งใจ (โฟลเดอร์ลูกต้องรู้ id โฟลเดอร์แม่ก่อนเสมอ)
    currentId = await ensureFolder(segment, currentId);
    folderIdCache.set(currentPath, currentId);
  }
  return currentId;
}

// storagePath เช่น "gallery/168xxxx.jpg" หรือ "presidents/logo/168xxxx.jpg" - แยกโฟลเดอร์ปลายทาง + หมวดสำหรับฝัง URL
function splitStoragePath(storagePath) {
  const parts = storagePath.split('/');
  const filename = parts.pop();
  return { folderPath: parts.join('/'), category: parts[0], filename };
}

async function uploadFile(storagePath, buffer, contentType) {
  const { folderPath, category, filename } = splitStoragePath(storagePath);
  const folderId = await resolveFolderId(folderPath);
  const { fileId } = await uploadBuffer(buffer, filename, folderId, contentType);
  return `/media/${category}/${fileId}`;
}

// path ที่ใช้เก็บใน DB/ส่งให้ controller คือ "<หมวด>/<driveFileId>" (ไม่ใช่ URL เต็ม) ให้ตรงกับ pathFromPublicUrl ด้านล่าง
async function deleteFile(storagePath) {
  const fileId = storagePath.split('/').pop();
  await driveDeleteFile(fileId);
}

// แปลง URL ที่เก็บใน DB ("/media/gallery/<fileId>") กลับเป็น "gallery/<fileId>" ไว้เช็คหมวด + เอาไปลบ คืน null ถ้าไม่ใช่ URL ของ proxy นี้
function pathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const match = publicUrl.match(/^\/media\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

function buildUniqueFilename(originalname) {
  const ext = originalname && originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

// รวมจำนวนไฟล์ + ขนาดทั้งหมดใต้โฟลเดอร์รูปภาพเว็บไซต์ (ไล่ทุก subfolder) ให้แดชบอร์ด "การใช้งานเว็บไซต์" ดู (ดู backend/lib/usageSnapshot.js)
async function getStorageStats() {
  if (!isConfigured()) return { fileCount: 0, bytes: 0, configured: false };

  const rootFolderId = await ensureFolder(IMAGES_ROOT_FOLDER_NAME, process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
  let fileCount = 0;
  let bytes = 0;
  async function walk(folderId, depth) {
    if (depth > 4) return;
    const [files, folders] = await Promise.all([listChildFiles(folderId), listChildFolders(folderId)]);
    fileCount += files.length;
    bytes += files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
    for (const folder of folders) {
      // eslint-disable-next-line no-await-in-loop -- ไล่ทีละโฟลเดอร์ตั้งใจ กันยิง Drive API พร้อมกันเยอะเกินจนโดน rate limit
      await walk(folder.id, depth + 1);
    }
  }
  await walk(rootFolderId, 0);
  return { fileCount, bytes, configured: true };
}

module.exports = {
  isConfigured,
  resizeImageForUpload,
  uploadFile,
  deleteFile,
  pathFromPublicUrl,
  buildUniqueFilename,
  getStorageStats,
};
