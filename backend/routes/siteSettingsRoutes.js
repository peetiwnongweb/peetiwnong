const express = require('express');
const { getSiteSettings, updateSiteSettings } = require('../controllers/siteSettingsController');
const { requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', getSiteSettings);
router.put('/', requireAdminAccess, updateSiteSettings);

module.exports = router;
