/**
 * requireRole(...allowedRoles) — checks user has one of the specified roles.
 * requirePoolingStationAccess — checks that pooling_station user can only access their own station.
 */

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied: Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Middleware to restrict pooling_station users to only their own station.
 * Admins are always allowed through.
 * Expects :id param to be the pooling station ID.
 */
const requirePoolingStationAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  // Admins bypass station-level access check
  if (req.user.role === 'admin') {
    return next();
  }

  const requestedStationId = parseInt(req.params.id, 10);
  const userStationId = req.user.pooling_station_id;

  if (!userStationId || userStationId !== requestedStationId) {
    return res.status(403).json({
      error: 'Access denied: You can only access your own pooling station data',
    });
  }

  next();
};

module.exports = {
  requireRole,
  requirePoolingStationAccess,
};
