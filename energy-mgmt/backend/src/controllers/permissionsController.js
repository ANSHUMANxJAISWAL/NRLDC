const db = require('../config/db');

// GET /api/permissions/user/:userId - get all plant permissions for a user
const getUserPermissions = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      `SELECT perm.*, p.name as plant_name 
       FROM user_plant_permissions perm
       JOIN power_plants p ON perm.plant_id = p.id
       WHERE perm.user_id = $1`,
      [userId]
    );
    return res.status(200).json({ permissions: result.rows });
  } catch (err) {
    console.error('Error fetching user permissions:', err);
    return res.status(500).json({ error: `Internal server error fetching permissions: ${err?.message || ''}` });
  }
};

// POST /api/permissions - grant a permission
const grantPermission = async (req, res) => {
  const { user_id, plant_id, can_read, can_write } = req.body;

  if (!user_id || !plant_id) {
    return res.status(400).json({ error: 'Required fields: user_id, plant_id' });
  }

  try {
    // Upsert permission record
    const result = await db.query(
      `INSERT INTO user_plant_permissions (user_id, plant_id, can_read, can_write) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, plant_id) 
       DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write 
       RETURNING *`,
      [
        user_id,
        plant_id,
        can_read !== undefined ? can_read : true,
        can_write !== undefined ? can_write : false
      ]
    );

    return res.status(200).json({
      message: 'Permission mapping saved successfully',
      permission: result.rows[0]
    });
  } catch (err) {
    console.error('Error granting permission:', err);
    return res.status(500).json({ error: `Internal server error granting plant permissions: ${err?.message || ''}` });
  }
};

// PUT /api/permissions/:id - update can_read / can_write toggles
const updatePermission = async (req, res) => {
  const { id } = req.params;
  const { can_read, can_write } = req.body;

  if (can_read === undefined || can_write === undefined) {
    return res.status(400).json({ error: 'Required fields: can_read, can_write' });
  }

  try {
    const check = await db.query('SELECT id FROM user_plant_permissions WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Permission record not found' });
    }

    const result = await db.query(
      `UPDATE user_plant_permissions 
       SET can_read = $1, can_write = $2 
       WHERE id = $3 
       RETURNING *`,
      [can_read, can_write, id]
    );

    return res.status(200).json({
      message: 'Permission mapping updated successfully',
      permission: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating permission details:', err);
    return res.status(500).json({ error: `Internal server error updating permission mapping: ${err?.message || ''}` });
  }
};

// DELETE /api/permissions/:id - revoke a permission
const revokePermission = async (req, res) => {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT id FROM user_plant_permissions WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Permission mapping not found' });
    }

    await db.query('DELETE FROM user_plant_permissions WHERE id = $1', [id]);

    return res.status(200).json({ message: 'Permission mapping revoked successfully' });
  } catch (err) {
    console.error('Error revoking permission:', err);
    return res.status(500).json({ error: `Internal server error revoking plant permissions: ${err?.message || ''}` });
  }
};

// POST /api/permissions/batch - batch saving of user plant permissions (transacted)
const saveBatchPermissions = async (req, res) => {
  const { userId, permissions } = req.body; // permissions format: [{ plantId, canRead, canWrite }, ...]

  if (!userId || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Required fields: userId, permissions (array)' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    for (const perm of permissions) {
      const { plantId, canRead, canWrite } = perm;

      if (!canRead && !canWrite) {
        // If user cannot read or write, remove the mapping
        await client.query(
          'DELETE FROM user_plant_permissions WHERE user_id = $1 AND plant_id = $2',
          [userId, plantId]
        );
      } else {
        // Upsert record
        await client.query(
          `INSERT INTO user_plant_permissions (user_id, plant_id, can_read, can_write) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (user_id, plant_id) 
           DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write`,
          [userId, plantId, canRead, canWrite]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Permissions updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in batch permissions transaction:', err);
    return res.status(500).json({ error: `Failed to batch save user permissions: ${err?.message || ''}` });
  } finally {
    client.release();
  }
};

module.exports = {
  getUserPermissions,
  grantPermission,
  updatePermission,
  revokePermission,
  saveBatchPermissions,
};
