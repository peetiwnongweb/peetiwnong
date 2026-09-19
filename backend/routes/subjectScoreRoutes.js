const express = require('express');
const {
  getRoster,
  saveParticipantScores,
  getMyScores,
} = require('../controllers/subjectScoreController');
const { requireRole } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');
const requireParticipantAccess = requireRole('PARTICIPANT');
// WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere ใน backend/lib/participantSimulation.js) - ใช้เฉพาะ endpoint อ่านอย่างเดียว
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'WEBMANAGER');

router.get('/roster', requireStaffAccess, getRoster);
router.get('/me', requireParticipantOrSimulateAccess, getMyScores);
router.put('/:participantProfileId', requireStaffAccess, saveParticipantScores); // เช็ค/กรองวิชาที่แก้ได้ในคอนโทรลเลอร์

module.exports = router;
