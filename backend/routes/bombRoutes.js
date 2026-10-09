const express = require('express');
const c = require('../controllers/bombController');

// เกมบอมโค้ด - ไม่ต้องล็อกอิน (ยืนยันพิธีกร/กลุ่มด้วย token ที่ได้ตอนสร้าง/เข้าห้อง)
const router = express.Router();
router.post('/rooms', c.createRoom);
router.get('/rooms/:code/host', c.hostState);
router.post('/rooms/:code/images', express.raw({ type: 'image/*', limit: '3mb' }), c.uploadImage);
router.get('/rooms/:code/images/:imageId', c.getImage);
router.post('/rooms/:code/start', c.startRound);
router.post('/rooms/:code/end', c.endRound);
router.post('/rooms/:code/time', c.addTime);
router.post('/rooms/:code/players/:playerId/adjust', c.adjustScore);
router.delete('/rooms/:code/players/:playerId', c.removePlayer);
router.post('/rooms/:code/reset', c.resetRoom);
router.get('/rooms/:code/qr', c.roomQr);
router.post('/rooms/:code/join', c.joinRoom);
router.get('/rooms/:code/player', c.playerState);
router.post('/rooms/:code/guess', c.guess);

module.exports = router;
