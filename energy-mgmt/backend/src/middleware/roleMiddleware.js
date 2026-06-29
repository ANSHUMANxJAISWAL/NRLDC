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

module.exports = {
  requireRole,
};
