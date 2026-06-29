const express = require('express');
const router = express.Router();
const controller = require('../controllers/poolingStationsController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticateToken);

// List all (admin and standard users)
router.get('/', requireRole('admin', 'user'), controller.getAllPoolingStations);

// Detail + plants (admin only preview)
router.get('/:id', requireRole('admin'), controller.getPoolingStationById);

// Admin-only write operations
router.post('/', requireRole('admin'), controller.createPoolingStation);
router.put('/:id', requireRole('admin'), controller.updatePoolingStation);
router.delete('/:id', requireRole('admin'), controller.deletePoolingStation);

module.exports = router;
