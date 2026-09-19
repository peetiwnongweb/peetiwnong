const express = require('express');
const {
  listCampActivities,
  createCampActivity,
  updateCampActivity,
  deleteCampActivity,
  listActivityScores,
  upsertActivityScore,
  deleteActivityScore,
  listScoreHistory,
  getScoreSummary,
  getMyGroupScores,
} = require('../controllers/campActivityController');
const { requireAuth, requireRole } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');
const requireParticipantAccess = requireRole('PARTICIPANT');

// อันดับคะแนนรวมทุกกลุ่ม เป็นข้อมูลไม่อ่อนไหว (ชื่อกลุ่ม + คะแนนรวม) จึงเปิดให้ผู้ใช้ที่ล็อกอินแล้วทุก role ดูได้ ไม่เฉพาะฝ่ายจัดการ
router.get('/scores/summary', requireAuth, getScoreSummary);
router.get('/scores/history', requireStaffAccess, listScoreHistory);
router.get('/my-group-scores', requireParticipantAccess, getMyGroupScores);
router.get('/', requireStaffAccess, listCampActivities);
// สร้าง/แก้ไข/ลบกิจกรรม เปิดให้พี่ค่ายทุกคนทำได้ (ไม่จำกัดแค่หัวหน้าฝ่ายกิจกรรมฯ) ต่างจาก /api/groups ที่ยังใช้ requireGroupManagementAccess จำกัดเฉพาะหัวหน้าฝ่าย/ผู้บริหารค่ายเหมือนเดิม
router.post('/', requireStaffAccess, createCampActivity);
router.put('/:id', requireStaffAccess, updateCampActivity);
router.delete('/:id', requireStaffAccess, deleteCampActivity);
router.get('/:id/scores', requireStaffAccess, listActivityScores);
router.put('/:id/scores/:groupId', requireStaffAccess, upsertActivityScore);
router.delete('/:id/scores/:groupId', requireStaffAccess, deleteActivityScore);

module.exports = router;
