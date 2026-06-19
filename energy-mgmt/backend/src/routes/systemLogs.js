const express = require('express');
const router = express.Router();
const systemLogsController = require('../controllers/systemLogsController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, systemLogsController.getSystemLogs);

module.exports = router;
