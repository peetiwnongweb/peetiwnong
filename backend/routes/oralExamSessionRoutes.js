const express = require('express');
const {
  openSession,
  getActiveSession,
  getSessionHistory,
  startSession,
  evaluateAttempts,
  closeSession,
  deleteSession,
  checkIn,
  getMyExamHistory,
  cancelMyAttempt,
} = require('../controllers/oralExamSessionController');
const { requireRole } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');
const requireParticipantAccess = requireRole('PARTICIPANT');
// WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere) - เฉพาะ /me/history ที่อ่านอย่างเดียวเท่านั้น ห้ามใช้กับ /check-in เพราะเป็นการทำธุรกรรมจริง (เช็คอินเข้าคิวสอบแทนคนอื่นไม่ได้)
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'WEBMANAGER');

// route คงที่ต้องอยู่ก่อน /:sessionId/... เสมอ ไม่งั้น express จะจับคำว่า "active"/"check-in"/"me"/"history" เป็นค่า :sessionId แทน
router.get('/active', requireStaffAccess, getActiveSession);
router.get('/history', requireStaffAccess, getSessionHistory);
router.post('/check-in', requireParticipantAccess, checkIn);
router.get('/me/history', requireParticipantOrSimulateAccess, getMyExamHistory);
// ออกจากคิวสอบด้วยตัวเอง - ธุรกรรมจริง ใช้ requireParticipantAccess เข้มเหมือน check-in (ห้าม WebManager จำลองแทนคนอื่น)
router.delete('/me/attempt/:attemptId', requireParticipantAccess, cancelMyAttempt);

router.post('/', requireStaffAccess, openSession); // เช็คสิทธิ์รายวิชาในคอนโทรลเลอร์ (isAcademicManager หรือผู้สอนวิชานั้น)
router.post('/:sessionId/start', requireStaffAccess, startSession);
router.post('/:sessionId/evaluate', requireStaffAccess, evaluateAttempts);
router.post('/:sessionId/close', requireStaffAccess, closeSession);
router.delete('/:sessionId', requireStaffAccess, deleteSession); // ลบประวัติรอบสอบที่ปิดแล้ว (เช็คสิทธิ์รายวิชา + สถานะ CLOSED ในคอนโทรลเลอร์)

module.exports = router;
