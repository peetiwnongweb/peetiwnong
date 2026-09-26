const express = require('express');
const { invalidateOnWrite } = require('../lib/responseCache');
const {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');
const { requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();
// เพิ่ม/แก้/ลบสำเร็จ = ล้าง cache รายการของข้อมูลชุดนี้ทันที (ดู backend/lib/responseCache.js)
router.use(invalidateOnWrite('schedules'));

router.get('/', listSchedules);
router.post('/', requireAdminAccess, createSchedule);
router.put('/:id', requireAdminAccess, updateSchedule);
router.delete('/:id', requireAdminAccess, deleteSchedule);

module.exports = router;
