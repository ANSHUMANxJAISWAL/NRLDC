const express = require('express');
const router = express.Router();
const controller = require('../controllers/poolingStationsController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole, requirePoolingStationAccess } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authenticateToken);

// List all (admin) or own (pooling_station)
router.get('/', requireRole('admin', 'pooling_station'), controller.getAllPoolingStations);

// Detail + plants (admin or station owner)
router.get('/:id', requireRole('admin', 'pooling_station'), requirePoolingStationAccess, controller.getPoolingStationById);

// Admin-only write operations
router.post('/', requireRole('admin'), controller.createPoolingStation);
router.put('/:id', requireRole('admin'), controller.updatePoolingStation);
router.delete('/:id', requireRole('admin'), controller.deletePoolingStation);

module.exports = router;
