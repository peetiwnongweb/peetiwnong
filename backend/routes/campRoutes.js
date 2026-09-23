const express = require('express');
const {
  listStaffOptions, listCamps, createCamp, updateCampLeadership, endCamp, deleteCamp, getWipePreview, triggerManualBackup, listCampBackups,
} = require('../controllers/campController');
const { requireWebManagerAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/staff-options', requireWebManagerAccess, listStaffOptions);
router.get('/wipe-preview', requireWebManagerAccess, getWipePreview);
router.get('/backups', requireWebManagerAccess, listCampBackups);
router.post('/backup', requireWebManagerAccess, triggerManualBackup);
router.get('/', requireWebManagerAccess, listCamps);
router.post('/', requireWebManagerAccess, createCamp);
router.post('/end', requireWebManagerAccess, endCamp);
router.put('/:id/leadership', requireWebManagerAccess, updateCampLeadership);
router.delete('/:id', requireWebManagerAccess, deleteCamp);

module.exports = router;
