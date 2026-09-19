const express = require('express');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { requireAdminAccess } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', requireAdminAccess, listUsers);
router.post('/', requireAdminAccess, createUser);
router.put('/:id', requireAdminAccess, updateUser);
router.delete('/:id', requireAdminAccess, deleteUser);

module.exports = router;
