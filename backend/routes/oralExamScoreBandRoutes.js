const express = require('express');
const { getOralExamScoreBands, updateOralExamScoreBands } = require('../controllers/oralExamScoreBandController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

router.get('/', requireStaffAccess, getOralExamScoreBands);
router.put('/', requireAcademicManageAccess, updateOralExamScoreBands);

module.exports = router;
