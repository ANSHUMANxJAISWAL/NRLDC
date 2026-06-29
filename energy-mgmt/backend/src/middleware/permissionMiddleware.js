const db = require('../config/db');

/**
 * Middleware factory to check user permissions for a power plant.
 * @param {string} permissionType - 'read' or 'write'
 */
const requirePlantPermission = (permissionType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // Admins bypass plant-specific permission checks
    if (req.user.role === 'admin') {
      return next();
    }

    // Resolve plant ID from params, body, or query
    const plantIdVal = req.params.plantId || req.params.id || req.body.plant_id || req.query.plant_id || req.query.plantId;
    const plantId = parseInt(plantIdVal, 10);

    if (isNaN(plantId)) {
      return res.status(400).json({ error: 'Invalid or missing power plant ID' });
    }

    try {
      const result = await db.query(
        'SELECT can_read, can_write FROM user_plant_permissions WHERE user_id = $1 AND plant_id = $2',
        [req.user.id, plantId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied: You do not have permissions for this power plant' });
      }

      const permissions = result.rows[0];

      if (permissionType === 'read' && !permissions.can_read) {
        return res.status(403).json({ error: 'Access denied: Read permission required for this plant' });
      }

      if (permissionType === 'write' && !permissions.can_write) {
        return res.status(403).json({ error: 'Access denied: Write permission required for this plant' });
      }

      next();
    } catch (err) {
      console.error('Error in permission middleware:', err);
      return res.status(500).json({ error: `Internal server error checking plant permissions: ${err?.message || ''}` });
    }
  };
};

module.exports = {
  requirePlantPermission,
};
