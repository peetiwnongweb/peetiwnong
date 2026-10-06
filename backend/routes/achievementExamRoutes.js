const express = require('express');
const {
  listExams,
  createExam,
  updateExam,
  updateAnswerKey,
  deleteExam,
  getRoster,
  listSubmissions,
  saveSubmission,
  deleteSubmission,
  publishExam,
} = require('../controllers/achievementExamController');
const { requireDepartmentStaff, requireRole } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายฝ่ายวิชาการ/ผู้บริหารค่าย - สิทธิ์ละเอียด (หัวหน้าฝ่าย vs ผู้สอนวิชาในชุดข้อสอบ) เช็คในคอนโทรลเลอร์
// ช่วงทดสอบ (Beta) เปิดให้เฉพาะ SuperAdmin - เปิดใช้จริงให้เปลี่ยนกลับเป็น requireDepartmentStaff('ฝ่ายวิชาการ')
const BETA_SUPERADMIN_ONLY = false;
const requireStaffAccess = BETA_SUPERADMIN_ONLY ? requireRole('SUPERADMIN') : requireDepartmentStaff('ฝ่ายวิชาการ');

router.get('/', requireStaffAccess, listExams);
router.post('/', requireStaffAccess, createExam);
router.put('/:id', requireStaffAccess, updateExam);
router.delete('/:id', requireStaffAccess, deleteExam);
router.put('/:id/answer-key', requireStaffAccess, updateAnswerKey);
router.post('/:id/publish', requireStaffAccess, publishExam);
router.get('/:id/roster', requireStaffAccess, getRoster);
router.get('/:id/submissions', requireStaffAccess, listSubmissions);
router.put('/:id/submissions/:participantProfileId', requireStaffAccess, saveSubmission);
router.delete('/:id/submissions/:participantProfileId', requireStaffAccess, deleteSubmission);

module.exports = router;
