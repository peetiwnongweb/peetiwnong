const express = require('express');
const { serveMedia } = require('../controllers/mediaController');

const router = express.Router();

// :category ไม่ได้ใช้ค้นหาไฟล์ (fileId ตัวเดียวก็พอ) แค่ให้ URL อ่านง่ายและ endpoint นี้อยู่รูปแบบเดียวกับ path ที่เก็บใน DB ("/media/<category>/<fileId>")
router.get('/:category/:fileId', serveMedia);

module.exports = router;
