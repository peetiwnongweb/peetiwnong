const fs = require('fs');
const { Readable } = require('stream');
const { google } = require('googleapis');

const FOLDER_MIME = 'application/vnd.google-apps.folder';

let driveClientPromise = null;

// ตั้งค่า Drive ครบไหม (client id/secret/refresh token + โฟลเดอร์แม่) ถ้าไม่ครบระบบสำรองข้อมูลจะข้ามตัวเองแบบเงียบ ๆ
// เพื่อให้ dev/local ที่ไม่ได้ตั้งค่า Google ไว้ยังใช้งานฟีเจอร์อื่นได้ตามปกติ
function isDriveConfigured() {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID
    && process.env.GOOGLE_OAUTH_CLIENT_SECRET
    && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

// lazy singleton แบบเดียวกับ backend/lib/prisma.js - สร้าง client แค่ครั้งแรกที่เรียกใช้จริง
function getDrive() {
  if (!driveClientPromise) {
    if (!isDriveConfigured()) {
      throw new Error('ยังไม่ได้ตั้งค่า Google Drive (ต้องมี GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN และ GOOGLE_DRIVE_ROOT_FOLDER_ID ใน .env)');
    }
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    driveClientPromise = Promise.resolve(google.drive({ version: 'v3', auth: oauth2Client }));
  }
  return driveClientPromise;
}

// หาโฟลเดอร์ชื่อ name ใต้ parentId ก่อน ไม่เจอค่อยสร้างใหม่ (idempotent เรียกซ้ำได้ไม่สร้างซ้ำ)
async function ensureFolder(name, parentId) {
  const drive = await getDrive();
  const escapedName = name.replace(/'/g, "\\'");
  const listRes = await drive.files.list({
    q: `name='${escapedName}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  if (listRes.data.files && listRes.data.files.length > 0) {
    return listRes.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
  });
  return createRes.data.id;
}

// รายชื่อไฟล์ทั้งหมด (ไม่รวมโฟลเดอร์) ใต้ parentId ไว้เช็คกันอัปโหลดซ้ำ (ชื่อไฟล์อัปโหลดในระบบไม่ซ้ำกันอยู่แล้ว)
async function listChildFileNames(parentId) {
  const drive = await getDrive();
  const names = new Set();
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`,
      fields: 'nextPageToken, files(name)',
      spaces: 'drive',
      pageToken,
    });
    (res.data.files || []).forEach((f) => names.add(f.name));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return names;
}

// รายชื่อไฟล์ (id+name+createdTime+size) ทั้งหมดใต้ parentId ไม่รวมโฟลเดอร์ ใช้ตอนล้าง log/ไฟล์เก่า + รวมขนาดพื้นที่ใช้ (ต่างจาก listChildFileNames ที่คืนแค่ชื่อ)
async function listChildFiles(parentId) {
  const drive = await getDrive();
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`,
      fields: 'nextPageToken, files(id, name, createdTime, size)',
      spaces: 'drive',
      pageToken,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

// รายชื่อโฟลเดอร์ย่อย (id+name) ใต้ parentId ใช้ตอนไล่ล้างไฟล์เก่าเข้า subfolder เช่น presidents/logo/
async function listChildFolders(parentId) {
  const drive = await getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false and mimeType='${FOLDER_MIME}'`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  return res.data.files || [];
}

// ย้ายไฟล์ลงถังขยะ (ไม่ใช่ลบถาวรทันที) - Google ลบถาวรให้เองอัตโนมัติใน 30 วัน กลายเป็น grace period ในตัวโดยไม่ต้องเช็ควันเองเลย
async function trashFile(fileId) {
  const drive = await getDrive();
  try {
    await drive.files.update({ fileId, requestBody: { trashed: true } });
  } catch (error) {
    if (error.code === 404) return; // ลบ/ย้ายไปแล้วอยู่ก่อน ถือว่าจบงาน
    throw error;
  }
}

async function uploadFile(localPath, name, parentId, mimeType) {
  const drive = await getDrive();
  const stat = fs.statSync(localPath);
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: fs.createReadStream(localPath) },
    fields: 'id',
  });
  return { fileId: res.data.id, bytes: stat.size };
}

// อัปโหลด buffer แบบ private (ไม่เปิดสิทธิ์สาธารณะ) ใช้กับไฟล์สำรองข้อมูลที่ต้องเก็บเป็นความลับ (ต่างจาก uploadPublicFile)
async function uploadBuffer(buffer, name, parentId, mimeType) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from([buffer]) },
    fields: 'id',
  });
  return { fileId: res.data.id, bytes: buffer.length };
}

async function uploadJson(obj, name, parentId) {
  const drive = await getDrive();
  const jsonString = JSON.stringify(obj, null, 2);
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: 'application/json', body: Readable.from([jsonString]) },
    fields: 'id',
  });
  return { fileId: res.data.id, bytes: Buffer.byteLength(jsonString, 'utf8') };
}

// อัปโหลดไฟล์เอกสารประกอบการเรียน "และ" เปิดสิทธิ์ให้ใครก็ได้ที่มีลิงก์ดูได้ทันที (ต่างจาก uploadFile/uploadJson
// ที่ใช้สำรองข้อมูลซึ่งต้องเก็บเป็นความลับ - ห้ามเปิด public ให้ไฟล์พวกนั้นเด็ดขาด)
// คืน webViewLink ไว้เก็บเป็น fileUrl ให้น้องค่ายเปิดดูตรง ๆ ได้จากลิงก์เดียว ไม่ต้อง proxy ผ่านเซิร์ฟเวอร์เรา
async function uploadPublicFile(buffer, name, parentId, mimeType) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from([buffer]) },
    fields: 'id, webViewLink',
  });

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return { fileId: res.data.id, url: res.data.webViewLink, bytes: buffer.length };
}

// เมทาดาต้าไฟล์ (ใช้เอา mimeType/size ไปตั้ง header ตอนเสิร์ฟไฟล์ผ่าน proxy ดู backend/routes/mediaRoutes.js)
async function getFileMetadata(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({ fileId, fields: 'id, name, mimeType, size' });
  return res.data;
}

// ดึงเนื้อไฟล์จริงเป็นสตรีม (alt: 'media') ใช้เสิร์ฟรูปภาพผ่าน proxy ของเราเอง ไม่ต้องเปิด public link บน Drive เลย
// (เข้าถึงด้วยสิทธิ์ของบัญชีที่ตั้งค่าไว้เสมอ ไม่ต้องพึ่ง permission "anyone with link" ซึ่งมีปัญหาเรื่อง rate limit/หน้าเตือนไวรัสของ Drive เอง)
async function downloadFileStream(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return res.data;
}

async function deleteFile(fileId) {
  if (!fileId) return;
  const drive = await getDrive();
  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    if (error.code === 404) return; // ลบไปแล้ว/ไม่มีอยู่แล้ว ถือว่าจบงาน
    throw error;
  }
}

module.exports = {
  isDriveConfigured,
  ensureFolder,
  listChildFileNames,
  listChildFiles,
  listChildFolders,
  trashFile,
  uploadFile,
  uploadBuffer,
  uploadJson,
  uploadPublicFile,
  getFileMetadata,
  downloadFileStream,
  deleteFile,
};
