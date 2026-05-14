const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

require('./config/redis');
const { requirePermissionForRoute } = require('./middleware/requirePermission');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Health check (before tenant middleware — Docker probes have no gateway headers)
app.get('/health', (req, res) => {
  res.json({ service: 'equity-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Extract tenant context middleware
app.use((req, res, next) => {
  req.tenantId = parseInt(req.headers['x-tenant-id']) || null;
  req.userId = req.headers['x-user-id'];
  req.userRole = req.headers['x-user-role'];
  try {
    req.permissions = JSON.parse(req.headers['x-permissions'] || '[]');
  } catch (e) {
    req.permissions = [];
  }
  if (!req.tenantId && req.userRole !== 'super_admin') {
    return res.status(400).json({ error: 'Tenant context required' });
  }
  next();
});

// Permission check for /api/equity
app.use('/api/equity', requirePermissionForRoute);

// Equity routes - fixed paths before parameterized
const holdingRoutes = require('./routes/holdingRoutes');
app.use('/api/equity/holdings', holdingRoutes);

const symbolRoutes = require('./routes/symbolRoutes');
app.use('/api/equity/symbols', symbolRoutes);

const transactionRoutes = require('./routes/transactionRoutes');
app.use('/api/equity/transactions', transactionRoutes);

// Error handling
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Equity Service running on port ${PORT}`);
});

module.exports = app;
