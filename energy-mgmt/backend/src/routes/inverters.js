const express = require('express');
const router = express.Router();
const invertersController = require('../controllers/invertersController');
const authenticateToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All inverter endpoints require authentication
router.use(authenticateToken);

// Export CSV endpoint (must be declared BEFORE /:id path)
router.get('/export', invertersController.exportInvertersCSV);

// List, Filter, Search and Detail endpoints
router.get('/', invertersController.getInverters);
router.get('/:id', invertersController.getInverterById);

// Create, Update, Delete endpoints
router.post('/', invertersController.createInverter);
router.put('/:id', invertersController.updateInverter);
router.delete('/:id', requireRole('admin'), invertersController.deleteInverter); // Delete is Admin only

module.exports = router;
