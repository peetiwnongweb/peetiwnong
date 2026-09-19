const express = require('express');
const {
  listNews, createNews, updateNews, deleteNews, uploadImage, deleteImage,
  submitNews, listMyNews, updateMyNews, deleteMyNews,
} = require('../controllers/newsController');
const { requireAdminAccess, requireRole } = require('../middleware/requireAuth');
const { uploadNewsImage, describeUploadError } = require('../middleware/upload');

const requireStaffOrWebManager = requireRole('STAFF', 'WEBMANAGER');

const router = express.Router();

router.get('/', listNews);
router.post('/', requireAdminAccess, createNews);

// พี่ค่ายทุกคน (ไม่จำกัดฝ่าย) เขียน/แก้ข่าวของตัวเองได้ - ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "mine" เป็นค่า :id แทน
router.get('/mine', requireStaffOrWebManager, listMyNews);
router.post('/submit', requireStaffOrWebManager, submitNews);
router.put('/mine/:id', requireStaffOrWebManager, updateMyNews);
router.delete('/mine/:id', requireStaffOrWebManager, deleteMyNews);

// ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "upload" เป็นค่า :id แทน
router.post('/upload', requireStaffOrWebManager, (req, res, next) => {
  uploadNewsImage.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: describeUploadError(err, 15) });
    next();
  });
}, uploadImage);
router.delete('/upload', requireStaffOrWebManager, deleteImage);

router.put('/:id', requireAdminAccess, updateNews);
router.delete('/:id', requireAdminAccess, deleteNews);

module.exports = router;
