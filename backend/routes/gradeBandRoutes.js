const express = require('express');
const { getGradeBands, updateGradeBands } = require('../controllers/gradeBandController');
const { requireRole, requireAcademicManageAccess, requireDepartmentStaff } = require('../middleware/requireAuth');

const router = express.Router();
// พี่ค่ายต้องสังกัดฝ่ายวิชาการ (หรือเป็นผู้บริหารค่าย/SuperAdmin) - ดู requireDepartmentStaff
const requireStaffAccess = requireDepartmentStaff('ฝ่ายวิชาการ');

router.get('/', requireStaffAccess, getGradeBands);
router.put('/', requireAcademicManageAccess, updateGradeBands);

module.exports = router;
