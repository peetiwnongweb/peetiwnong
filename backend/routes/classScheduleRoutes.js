const express = require('express');
const {
  listClassSchedules,
  createClassSchedule,
  updateClassSchedule,
  deleteClassSchedule,
  getMySchedule,
} = require('../controllers/classScheduleController');
const { requireRole, requireAcademicManageAccess, requireDepartmentStaff } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายต้องสังกัดฝ่ายวิชาการ (หรือเป็นผู้บริหารค่าย/SuperAdmin) - ดู requireDepartmentStaff
const requireStaffAccess = requireDepartmentStaff('ฝ่ายวิชาการ');
// SuperAdmin ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere ใน backend/lib/participantSimulation.js)
const requireParticipantOrSimulateAccess = requireRole('PARTICIPANT', 'SUPERADMIN');

router.get('/me', requireParticipantOrSimulateAccess, getMySchedule);
router.get('/', requireStaffAccess, listClassSchedules);
router.post('/', requireAcademicManageAccess, createClassSchedule);
router.put('/:id', requireAcademicManageAccess, updateClassSchedule);
router.delete('/:id', requireAcademicManageAccess, deleteClassSchedule);

module.exports = router;
