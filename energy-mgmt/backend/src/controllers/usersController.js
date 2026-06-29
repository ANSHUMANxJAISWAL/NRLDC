const bcrypt = require('bcryptjs');
const db = require('../config/db');

// GET /api/users - list all users with their plant permission counts
const getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              COUNT(p.id)::int as plant_count 
       FROM users u 
       LEFT JOIN user_plant_permissions p ON u.id = p.user_id 
       GROUP BY u.id
       ORDER BY u.id DESC`
    );
    return res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: `Internal server error fetching users list: ${err?.message || ''}` });
  }
};

// GET /api/users/:id - user profile + full permission list
const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at
       FROM users u
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const permissionsResult = await db.query(
      `SELECT perm.id, perm.plant_id, p.name as plant_name, perm.can_read, perm.can_write 
       FROM user_plant_permissions perm
       JOIN power_plants p ON perm.plant_id = p.id
       WHERE perm.user_id = $1`,
      [id]
    );

    return res.status(200).json({
      user,
      permissions: permissionsResult.rows
    });
  } catch (err) {
    console.error('Error fetching user profile details:', err);
    return res.status(500).json({ error: `Internal server error fetching user details: ${err?.message || ''}` });
  }
};

// POST /api/users - create new user account (admin sets role)
const createUser = async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Required fields: username, email, password, role' });
  }

  try {
    const duplicateCheck = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, role, created_at`,
      [username, email, passwordHash, role]
    );

    return res.status(201).json({
      message: 'User account created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating user:', err);
    return res.status(500).json({ error: `Internal server error creating user account: ${err?.message || ''}` });
  }
};

// PUT /api/users/:id - update user details (admin only)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, email, role } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: 'Required fields: username, email, role' });
  }

  try {
    const checkUser = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check duplicate username/email
    const duplicateCheck = await db.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id <> $3',
      [username, email, id]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already in use by another user' });
    }

    const result = await db.query(
      `UPDATE users 
       SET username = $1, email = $2, role = $3
       WHERE id = $4 
       RETURNING id, username, email, role, created_at`,
      [username, email, role, id]
    );

    return res.status(200).json({
      message: 'User account updated successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ error: `Internal server error updating user account: ${err?.message || ''}` });
  }
};

// DELETE /api/users/:id - delete user + their permissions
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const checkUser = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    return res.status(200).json({ message: 'User account and associated permissions deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: `Internal server error deleting user account: ${err?.message || ''}` });
  }
};

// PATCH /api/users/:id/password - admin reset of user password
const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    const checkUser = await db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );

    return res.status(200).json({ message: 'User password reset successfully' });
  } catch (err) {
    console.error('Error resetting user password:', err);
    return res.status(500).json({ error: `Internal server error resetting user password: ${err?.message || ''}` });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
};
