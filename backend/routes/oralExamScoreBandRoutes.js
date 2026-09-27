const express = require('express');
const { getOralExamScoreBands, updateOralExamScoreBands } = require('../controllers/oralExamScoreBandController');
const { requireRole, requireAcademicManageAccess, requireDepartmentStaff } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายต้องสังกัดฝ่ายวิชาการ (หรือเป็นผู้บริหารค่าย/SuperAdmin) - ดู requireDepartmentStaff
const requireStaffAccess = requireDepartmentStaff('ฝ่ายวิชาการ');

router.get('/', requireStaffAccess, getOralExamScoreBands);
router.put('/', requireAcademicManageAccess, updateOralExamScoreBands);

module.exports = router;
