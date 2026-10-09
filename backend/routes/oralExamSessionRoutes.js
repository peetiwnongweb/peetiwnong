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
  removeAttempt,
  updateAttemptResult,
  getManualRoster,
  recordManualResults,
  listSheetParticipants,
  getParticipantSheet,
  saveParticipantSheet,
  clearParticipantSheetSubject,
} = require('../controllers/oralExamSessionController');
const { requireRole, requireDepartmentStaff } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายต้องสังกัดฝ่ายวิชาการ (หรือเป็นผู้บริหารค่าย/SuperAdmin) - ดู requireDepartmentStaff
const requireStaffAccess = requireDepartmentStaff('ฝ่ายวิชาการ');
const requireParticipantAccess = requireRole('PARTICIPANT');
// SuperAdmin ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere) - เฉพาะ /me/history ที่อ่านอย่างเดียวเท่านั้น ห้ามใช้กับ /check-in เพราะเป็นการทำธุรกรรมจริง (เช็คอินเข้าคิวสอบแทนคนอื่นไม่ได้)
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'SUPERADMIN');

// route คงที่ต้องอยู่ก่อน /:sessionId/... เสมอ ไม่งั้น express จะจับคำว่า "active"/"check-in"/"me"/"history" เป็นค่า :sessionId แทน
router.get('/active', requireStaffAccess, getActiveSession);
router.get('/history', requireStaffAccess, getSessionHistory);
router.post('/check-in', requireParticipantAccess, checkIn);
// บันทึกผลจากกระดาษ (กรณีระบบ QR ใช้งานไม่ได้) - เช็ค isAcademicManager ในคอนโทรลเลอร์
router.get('/manual/roster', requireStaffAccess, getManualRoster);
router.post('/manual', requireStaffAccess, recordManualResults);
// บันทึกตามเอกสารการสอบอธิบายรายคน (ใบที่แจกน้อง) - เช็ค isAcademicManager ในคอนโทรลเลอร์
router.get('/sheet/participants', requireStaffAccess, listSheetParticipants);
router.get('/sheet/:participantProfileId', requireStaffAccess, getParticipantSheet);
router.post('/sheet/:participantProfileId', requireStaffAccess, saveParticipantSheet);
router.delete('/sheet/:participantProfileId/subjects/:subjectId', requireStaffAccess, clearParticipantSheetSubject);
router.get('/me/history', requireParticipantOrSimulateAccess, getMyExamHistory);

router.post('/', requireStaffAccess, openSession); // เช็คสิทธิ์รายวิชาในคอนโทรลเลอร์ (isAcademicManager หรือผู้สอนวิชานั้น)
router.post('/:sessionId/start', requireStaffAccess, startSession);
router.post('/:sessionId/evaluate', requireStaffAccess, evaluateAttempts);
router.post('/:sessionId/close', requireStaffAccess, closeSession);
router.delete('/:sessionId/attempts/:attemptId', requireStaffAccess, removeAttempt); // ลบได้ทั้งคนที่รอประเมิน (นำออกจากคิว) และครั้งที่ประเมินแล้ว (ลบจากประวัติ เผื่อบันทึกผิด)
router.patch('/:sessionId/attempts/:attemptId', requireStaffAccess, updateAttemptResult); // แก้ผลผ่าน/ไม่ผ่านที่ประเมินไปแล้ว
router.delete('/:sessionId', requireStaffAccess, deleteSession); // ลบประวัติรอบสอบที่ปิดแล้ว (เช็คสิทธิ์รายวิชา + สถานะ CLOSED ในคอนโทรลเลอร์)

module.exports = router;
