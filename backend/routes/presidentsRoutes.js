const express = require('express');
const { invalidateOnWrite } = require('../lib/responseCache');
const {
  listPresidents,
  createPresident,
  updatePresident,
  deletePresident,
  uploadImage,
  deleteImage,
} = require('../controllers/presidentsController');
const { requireWebManagerAccess } = require('../middleware/requireAuth');
const { uploadPresidentImage, describeUploadError } = require('../middleware/upload');

const router = express.Router();
// เพิ่ม/แก้/ลบสำเร็จ = ล้าง cache รายการของข้อมูลชุดนี้ทันที (ดู backend/lib/responseCache.js)
router.use(invalidateOnWrite('presidents'));

router.get('/', listPresidents);
// ทำเนียบประธานค่ายเป็นของ WebManager เท่านั้น (Admin ในหน้า /admin ไม่มีสิทธิ์แก้ไข ดูได้แค่ที่แสดงบนเว็บหลักผ่าน GET ด้านบน)
router.post('/', requireWebManagerAccess, createPresident);

// ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "upload" เป็นค่า :id แทน (เจอบั๊กนี้มาแล้ว)
// แยก error handler เฉพาะจุดนี้ เพื่อส่งข้อความ error จริงของ multer กลับไป (เช่น "อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น") แทนข้อความ error ทั่วไป
router.post('/upload', requireWebManagerAccess, (req, res, next) => {
  uploadPresidentImage.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: describeUploadError(err, 5) });
    next();
  });
}, uploadImage);
router.delete('/upload', requireWebManagerAccess, deleteImage);

router.put('/:id', requireWebManagerAccess, updatePresident);
router.delete('/:id', requireWebManagerAccess, deletePresident);

module.exports = router;
