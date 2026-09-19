const express = require('express');
const { getScoreWeightSetting, updateScoreWeightSetting } = require('../controllers/scoreWeightSettingController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

router.get('/', requireStaffAccess, getScoreWeightSetting);
router.put('/', requireAcademicManageAccess, updateScoreWeightSetting);

module.exports = router;
