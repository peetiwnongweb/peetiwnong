const express = require('express');
const { invalidateOnWrite } = require('../lib/responseCache');
const {
  listNews, createNews, updateNews, deleteNews, uploadImage, deleteImage,
  submitNews, listMyNews, updateMyNews, deleteMyNews,
} = require('../controllers/newsController');
const { requireAdminAccess, requireRole } = require('../middleware/requireAuth');
const { uploadNewsImage, describeUploadError } = require('../middleware/upload');

const requireStaffOrSuperAdmin = requireRole('STAFF', 'SUPERADMIN');

const router = express.Router();
// เพิ่ม/แก้/ลบสำเร็จ = ล้าง cache รายการของข้อมูลชุดนี้ทันที (ดู backend/lib/responseCache.js)
router.use(invalidateOnWrite('news'));

router.get('/', listNews);
router.post('/', requireAdminAccess, createNews);

// พี่ค่ายทุกคน (ไม่จำกัดฝ่าย) เขียน/แก้ข่าวของตัวเองได้ - ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "mine" เป็นค่า :id แทน
router.get('/mine', requireStaffOrSuperAdmin, listMyNews);
router.post('/submit', requireStaffOrSuperAdmin, submitNews);
router.put('/mine/:id', requireStaffOrSuperAdmin, updateMyNews);
router.delete('/mine/:id', requireStaffOrSuperAdmin, deleteMyNews);

// ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "upload" เป็นค่า :id แทน
router.post('/upload', requireStaffOrSuperAdmin, (req, res, next) => {
  uploadNewsImage.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: describeUploadError(err, 15) });
    next();
  });
}, uploadImage);
router.delete('/upload', requireStaffOrSuperAdmin, deleteImage);

router.put('/:id', requireAdminAccess, updateNews);
router.delete('/:id', requireAdminAccess, deleteNews);

module.exports = router;
