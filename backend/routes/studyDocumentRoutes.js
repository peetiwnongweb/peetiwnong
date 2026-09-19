const express = require('express');
const {
  listStudyDocuments,
  createStudyDocument,
  updateStudyDocument,
  deleteStudyDocument,
  getMyStudyDocuments,
} = require('../controllers/studyDocumentController');
const { requireRole, requireAcademicManageAccess } = require('../middleware/requireAuth');
const { uploadStudyDocument, describeUploadError } = require('../middleware/upload');

const router = express.Router();
const requireStaffAccess = requireRole('STAFF', 'WEBMANAGER');

// WebManager ดูแทนน้องค่ายคนใดคนหนึ่งได้ผ่าน ?simulateParticipantId= (ดู resolveParticipantWhere ใน backend/lib/participantSimulation.js)
router.get('/me', requireRole('PARTICIPANT', 'WEBMANAGER'), getMyStudyDocuments);
router.get('/', requireStaffAccess, listStudyDocuments);

// ต้องอยู่ก่อน '/:id' เสมอ ไม่งั้น express จะจับคำว่า "upload" เป็นค่า :id แทน
router.post('/upload', requireAcademicManageAccess, (req, res, next) => {
  uploadStudyDocument.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: describeUploadError(err, 25) });
    next();
  });
}, createStudyDocument);

router.put('/:id', requireAcademicManageAccess, updateStudyDocument);
router.delete('/:id', requireAcademicManageAccess, deleteStudyDocument);

module.exports = router;
