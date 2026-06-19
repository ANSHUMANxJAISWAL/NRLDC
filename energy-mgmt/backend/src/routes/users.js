const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All user administration endpoints require authentication and Admin role
router.use(authenticateToken, requireRole('admin'));

router.get('/', usersController.getAllUsers);
router.post('/', usersController.createUser);

router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);
router.patch('/:id/password', usersController.resetPassword);

module.exports = router;
