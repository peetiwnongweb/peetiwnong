const express = require('express');
const c = require('../controllers/bingoController');

// เกมบิงโกออนไลน์ - ไม่ต้องล็อกอิน (ยืนยันพิธีกร/กลุ่มด้วย token ที่ได้ตอนสร้าง/เข้าห้อง)
const router = express.Router();
router.post('/rooms', c.createRoom);
router.get('/rooms/:code/host', c.hostState);
router.post('/rooms/:code/draw', c.drawTrait);
router.post('/rooms/:code/requests/:requestId', c.decideRequest);
router.post('/rooms/:code/reset', c.resetRoom);
router.get('/rooms/:code/qr', c.roomQr);
router.post('/rooms/:code/join', c.joinRoom);
router.get('/rooms/:code/player', c.playerState);
router.post('/rooms/:code/request', c.requestMark);
router.post('/rooms/:code/bingo', c.claimBingo);

module.exports = router;
