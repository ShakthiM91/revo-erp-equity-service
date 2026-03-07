const { client: redisClient, isRedisEnabled } = require('../config/redis');

const routePermissions = {
  'GET /api/equity/symbols': 'equity.symbols.view',
  'POST /api/equity/symbols': 'equity.symbols.manage',
  'GET /api/equity/holdings': 'equity.holdings.view',
  'GET /api/equity/holdings/summary': 'equity.dashboard.view',
  'GET /api/equity/holdings/portfolio-history': 'equity.dashboard.view',
  'GET /api/equity/transactions': 'equity.transactions.view',
  'POST /api/equity/transactions': 'equity.transactions.create',
  'PUT /api/equity/transactions/:id': 'equity.transactions.edit',
  'DELETE /api/equity/transactions/:id': 'equity.transactions.delete'
};

function normalizePath(path) {
  return path.replace(/\/[0-9]+/g, '/:id');
}

async function requirePermissionForRoute(req, res, next) {
  const path = (req.originalUrl || req.path || '').split('?')[0];
  const normalized = normalizePath(path);
  const routeKey = `${req.method} ${normalized}`;
  const requiredPermission = routePermissions[routeKey];

  if (!requiredPermission) {
    return next();
  }

  if (req.userRole === 'super_admin' || (req.permissions && req.permissions.includes('*'))) {
    return next();
  }

  let permissions = req.permissions || [];
  if (redisClient && isRedisEnabled()) {
    try {
      const tid = req.tenantId ?? 0;
      const raw = await redisClient.get('perms:' + req.userId + ':' + tid);
      if (raw) {
        permissions = JSON.parse(raw);
      } else {
        return res.status(403).json({ error: 'Insufficient permissions', required: requiredPermission });
      }
    } catch (err) {
      return res.status(503).json({ error: 'Permission check failed' });
    }
  }

  if (permissions && permissions.includes(requiredPermission)) {
    return next();
  }

  return res.status(403).json({ error: 'Insufficient permissions', required: requiredPermission });
}

module.exports = { requirePermissionForRoute };
