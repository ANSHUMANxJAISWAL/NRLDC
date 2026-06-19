const express = require('express');
const router = express.Router();
const controller = require('../controllers/ppcPlantsController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticateToken);

// Read routes (admin + user)
router.get('/', requireRole('admin', 'user'), controller.getAllPpcPlants);
router.get('/:id', requireRole('admin', 'user'), controller.getPpcPlantById);

// Admin-only write operations
router.post('/', requireRole('admin'), controller.createPpcPlant);
router.put('/:id', requireRole('admin'), controller.updatePpcPlant);
router.delete('/:id', requireRole('admin'), controller.deletePpcPlant);

module.exports = router;
