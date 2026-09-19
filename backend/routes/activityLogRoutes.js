const express = require('express');
const { listActivityLogs } = require('../controllers/activityLogController');
const { requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAdminAccess, listActivityLogs);

module.exports = router;
