const multer = require('multer');
const path = require('path');

// รูปประธานค่าย/โลโก้มหาวิทยาลัย/ประมวลภาพ/ข่าว ไม่เขียนลงดิสก์อีกต่อไป (เก็บ buffer ในหน่วยความจำแค่ชั่วคราว)
// เพราะคอนโทรลเลอร์จะอัปโหลดต่อขึ้น Google Drive เอง (ดู backend/lib/driveImageStorage.js)
const memoryStorage = multer.memoryStorage();

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น'));
  }
  cb(null, true);
}

const uploadPresidentImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB (รูปผ่านตัวครอบตัดที่ย่อขนาดลงก่อนอัปโหลดเสมอ ไม่ค่อยชนขีดจำกัดนี้)
});

const uploadGalleryImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB - รูปต้นทางจากมือถืออาจใหญ่ แต่ galleryController.js ย่อ/บีบอัดด้วย sharp ก่อนเก็บขึ้น Drive เสมอ (กันพื้นที่บาน)
});

const uploadNewsImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB - เหมือนรูปประมวลภาพ newsController.js ย่อ/บีบอัดด้วย sharp ก่อนเก็บขึ้น Drive เสมอ
});

// เอกสารประกอบการเรียนอัปโหลดตรงขึ้น Google Drive แบบ public link ตรง ๆ (ต่างจากรูปที่ต้องผ่าน /media proxy) ดู studyDocumentController.js
// ไม่ใช่แค่รูป จึงกรองด้วยนามสกุลไฟล์แทน mimetype
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.jpg', '.jpeg', '.png'];

function documentFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return cb(new Error('รองรับเฉพาะไฟล์ PDF, Word, PowerPoint, Excel, รูปภาพ หรือ ZIP เท่านั้น'));
  }
  cb(null, true);
}

const uploadStudyDocument = multer({
  storage: memoryStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB - เอกสารประกอบการเรียนอาจมีหลายหน้า/มีรูปประกอบ ใหญ่กว่ารูปทั่วไป
});

// แปล error จาก multer (เช่น "File too large" ภาษาอังกฤษ) ให้เป็นข้อความไทยที่เข้าใจง่าย
function describeUploadError(err, maxSizeMB) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return `ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน ${maxSizeMB}MB)`;
  }
  return err.message || 'อัปโหลดไฟล์ไม่สำเร็จ';
}

module.exports = { uploadPresidentImage, uploadGalleryImage, uploadNewsImage, uploadStudyDocument, describeUploadError };
