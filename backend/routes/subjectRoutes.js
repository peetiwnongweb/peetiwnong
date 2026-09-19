const express = require('express');
const {
  listSubjects,
  listMySubjects,
  listInstructorCandidates,
  createSubject,
  updateSubject,
  setSubjectInstructors,
  deleteSubject,
} = require('../controllers/subjectController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

router.get('/mine', requireStaffAccess, listMySubjects);
router.get('/instructor-candidates', requireAcademicManageAccess, listInstructorCandidates);
router.get('/', requireStaffAccess, listSubjects);
router.post('/', requireAcademicManageAccess, createSubject);
router.put('/:id/instructors', requireAcademicManageAccess, setSubjectInstructors);
router.put('/:id', requireStaffAccess, updateSubject); // เช็คสิทธิ์รายทรัพยากรในคอนโทรลเลอร์ (manager หรือเจ้าของวิชา)
router.delete('/:id', requireAcademicManageAccess, deleteSubject);

module.exports = router;
