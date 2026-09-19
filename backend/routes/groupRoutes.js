const express = require('express');
const {
  listGroups,
  listUnassignedParticipants,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
} = require('../controllers/groupController');
const { requireRole, requireGroupManagementAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

// รายชื่อกลุ่ม (แค่ดู) ใช้ร่วมกับแท็บ "บันทึกคะแนน" ด้วย พี่ค่ายฝ่ายกิจกรรมทั่วไปเข้าถึงได้
router.get('/', requireStaffAccess, listGroups);

// ส่วนที่เหลือคือการ "จัดการกลุ่ม" จริง ๆ (สร้าง/ลบกลุ่ม, ย้ายสมาชิก) จำกัดเฉพาะหัวหน้าฝ่ายกิจกรรมฯ หรือผู้บริหารค่าย
router.get('/unassigned-participants', requireGroupManagementAccess, listUnassignedParticipants);
router.post('/', requireGroupManagementAccess, createGroup);
router.put('/:id', requireGroupManagementAccess, updateGroup);
router.delete('/:id', requireGroupManagementAccess, deleteGroup);
router.post('/:id/members', requireGroupManagementAccess, addMember);
router.delete('/:id/members/:participantId', requireGroupManagementAccess, removeMember);

module.exports = router;
