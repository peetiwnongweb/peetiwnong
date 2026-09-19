const express = require('express');
const { listDepartments, listPositions, listCourseFormats, listGroups, getCurrentGeneration } = require('../controllers/lookupsController');

const router = express.Router();

router.get('/departments', listDepartments);
router.get('/positions', listPositions);
router.get('/course-formats', listCourseFormats);
router.get('/groups', listGroups);
router.get('/current-generation', getCurrentGeneration);

module.exports = router;
