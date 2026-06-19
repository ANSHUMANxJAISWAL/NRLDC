const express = require('express');
const router = express.Router();
const permissionsController = require('../controllers/permissionsController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All permissions administration endpoints require authentication and Admin role
router.use(authenticateToken, requireRole('admin'));

router.get('/user/:userId', permissionsController.getUserPermissions);
router.post('/', permissionsController.grantPermission);
router.put('/:id', permissionsController.updatePermission);
router.delete('/:id', permissionsController.revokePermission);

// Batch save permissions overrides
router.post('/batch', permissionsController.saveBatchPermissions);

module.exports = router;
