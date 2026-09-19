const express = require('express');
const { getGradeBands, updateGradeBands } = require('../controllers/gradeBandController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

router.get('/', requireStaffAccess, getGradeBands);
router.put('/', requireAcademicManageAccess, updateGradeBands);

module.exports = router;
