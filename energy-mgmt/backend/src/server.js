const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const plantRoutes = require('./routes/plants');
const inverterRoutes = require('./routes/inverters');
const userRoutes = require('./routes/users');
const permissionRoutes = require('./routes/permissions');
const poolingStationRoutes = require('./routes/poolingStations');
const ppcPlantRoutes = require('./routes/ppcPlants');
const uploadRoutes = require('./routes/upload');
const systemLogRoutes = require('./routes/systemLogs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for local dev environment
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Register Api Routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/inverters', inverterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/pooling-stations', poolingStationRoutes);
app.use('/api/ppc-plants', ppcPlantRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/system-logs', systemLogRoutes);

// Serve uploads folder as static
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Base route to verify service availability
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Energy Management API',
    status: 'Running',
    timestamp: new Date().toISOString()
  });
});

// 404 Route handler for unregistered routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    status
  });
});

// Start listening for connections
const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`Energy Management Server running on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
