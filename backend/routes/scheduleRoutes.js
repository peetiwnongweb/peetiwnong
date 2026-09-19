const express = require('express');
const {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');
const { requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', listSchedules);
router.post('/', requireAdminAccess, createSchedule);
router.put('/:id', requireAdminAccess, updateSchedule);
router.delete('/:id', requireAdminAccess, deleteSchedule);

module.exports = router;
