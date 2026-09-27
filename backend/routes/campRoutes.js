const express = require('express');
const {
  listStaffOptions, listCamps, createCamp, updateCampLeadership, endCamp, deleteCamp, getWipePreview, triggerManualBackup, listCampBackups,
} = require('../controllers/campController');
const { requireSuperAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/staff-options', requireSuperAdminAccess, listStaffOptions);
router.get('/wipe-preview', requireSuperAdminAccess, getWipePreview);
router.get('/backups', requireSuperAdminAccess, listCampBackups);
router.post('/backup', requireSuperAdminAccess, triggerManualBackup);
router.get('/', requireSuperAdminAccess, listCamps);
router.post('/', requireSuperAdminAccess, createCamp);
router.post('/end', requireSuperAdminAccess, endCamp);
router.put('/:id/leadership', requireSuperAdminAccess, updateCampLeadership);
router.delete('/:id', requireSuperAdminAccess, deleteCamp);

module.exports = router;
