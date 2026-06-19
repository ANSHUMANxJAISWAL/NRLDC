const express = require('express');
const router = express.Router();
const plantsController = require('../controllers/plantsController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { requirePlantPermission } = require('../middleware/permissionMiddleware');

// All routes require authentication
router.use(authenticateToken);

// GET all plants (internally scoped for regular users, and supports status & search filters)
router.get('/', plantsController.getAllPlants);

// GET plant details (requires read permission)
router.get('/:id', requirePlantPermission('read'), plantsController.getPlantById);

// Admin-only endpoints for create/delete, but write-permitted operator for edit
router.post('/', requireRole('admin'), plantsController.createPlant);
router.put('/:id', requirePlantPermission('write'), plantsController.updatePlant);
router.delete('/:id', requireRole('admin'), plantsController.deletePlant);

module.exports = router;
