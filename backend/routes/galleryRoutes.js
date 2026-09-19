const express = require('express');
const { listPhotos, uploadPhoto, deletePhoto } = require('../controllers/galleryController');
const { requireAdminAccess } = require('../middleware/requireAuth');
const { uploadGalleryImage, describeUploadError } = require('../middleware/upload');

const router = express.Router();

router.get('/', listPhotos);

// ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "upload" เป็นค่า :id แทน (เจอบั๊กนี้มาแล้วกับ presidentsRoutes)
router.post('/upload', requireAdminAccess, (req, res, next) => {
  uploadGalleryImage.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: describeUploadError(err, 15) });
    next();
  });
}, uploadPhoto);

router.delete('/:id', requireAdminAccess, deletePhoto);

module.exports = router;
