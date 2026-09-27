const express = require('express');
const {
  getRoster,
  saveParticipantScores,
  getMyScores,
} = require('../controllers/subjectScoreController');
const { requireRole, requireDepartmentStaff } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายต้องสังกัดฝ่ายวิชาการ (หรือเป็นผู้บริหารค่าย/SuperAdmin) - ดู requireDepartmentStaff
const requireStaffAccess = requireDepartmentStaff('ฝ่ายวิชาการ');
const requireParticipantAccess = requireRole('PARTICIPANT');
// SuperAdmin ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere ใน backend/lib/participantSimulation.js) - ใช้เฉพาะ endpoint อ่านอย่างเดียว
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'SUPERADMIN');

router.get('/roster', requireStaffAccess, getRoster);
router.get('/me', requireParticipantOrSimulateAccess, getMyScores);
router.put('/:participantProfileId', requireStaffAccess, saveParticipantScores); // เช็ค/กรองวิชาที่แก้ได้ในคอนโทรลเลอร์

module.exports = router;
