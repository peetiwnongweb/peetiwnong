const express = require('express');
const {
  getSummary, getPeople, getAcademic, getActivities, getSystem, getUsage, exportUsageCsv,
} = require('../controllers/dashboardController');
const { requireWebManagerAccess, requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

// บุคลากร/งานวิชาการ/งานกิจกรรม ให้ Admin (พี่ค่ายที่ isAdmin) เห็นได้ด้วย - เป็นข้อมูลงานที่ดูแลอยู่แล้ว ใช้ทำแดชบอร์ดหน้า /admin
router.get('/people', requireAdminAccess, getPeople);
router.get('/academic', requireAdminAccess, getAcademic);
router.get('/activities', requireAdminAccess, getActivities);

// ภาพรวมรวมข้อมูลทุกฝ่าย + สถิติระบบ/การใช้งานเว็บไซต์ เป็นของ WebManager เท่านั้น ไม่ใช่สิ่งที่แอดมินระดับพี่ค่ายควรเห็น
router.get('/summary', requireWebManagerAccess, getSummary);
router.get('/system', requireWebManagerAccess, getSystem);
router.get('/usage', requireWebManagerAccess, getUsage);
router.get('/usage/export', requireWebManagerAccess, exportUsageCsv);

module.exports = router;
