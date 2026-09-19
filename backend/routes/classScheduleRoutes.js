const express = require('express');
const {
  listClassSchedules,
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getMySchedule,
} = require('../controllers/classScheduleController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');
// WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere ใน backend/lib/participantSimulation.js)
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'WEBMANAGER');

router.get('/me', requireParticipantOrSimulateAccess, getMySchedule);
router.get('/', requireStaffAccess, listClassSchedules);
router.post('/', requireAcademicManageAccess, createClassSchedule);
router.put('/:id', requireAcademicManageAccess, updateClassSchedule);
router.delete('/:id', requireAcademicManageAccess, deleteClassSchedule);

module.exports = router;
