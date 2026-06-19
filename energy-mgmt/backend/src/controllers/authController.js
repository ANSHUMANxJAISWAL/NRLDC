const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendEmail } = require('../utils/mailer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const JWT_EXPIRES_IN = '8h';

// Login endpoint (handles admin, user, and pooling_station roles with 2FA)
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.role, u.pooling_station_id,
              ps.name AS station_name
       FROM users u
       LEFT JOIN pooling_stations ps ON ps.id = u.pooling_station_id
       WHERE u.email = $1 OR u.username = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Bypass 2FA for testing and specific admin accounts
    const isBypassUser = 
      (user.username && (user.username.toLowerCase() === 'azure' || user.username.toLowerCase() === 'admin')) ||
      (user.email && user.email.toLowerCase() === 'admin@energymgmt.com');

    if (isBypassUser) {
      const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      if (user.role === 'pooling_station' && user.pooling_station_id) {
        tokenPayload.pooling_station_id = user.pooling_station_id;
        tokenPayload.station_name = user.station_name;
      }

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      const responseUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      if (user.role === 'pooling_station' && user.pooling_station_id) {
        responseUser.pooling_station_id = user.pooling_station_id;
        responseUser.station_name = user.station_name;
      }

      return res.status(200).json({
        message: 'Login successful',
        token,
        user: responseUser,
      });
    }

    // Generate 6-digit 2FA code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.query(
      'UPDATE users SET two_factor_code = $1, two_factor_expires = $2 WHERE id = $3',
      [code, expires, user.id]
    );

    // Send 2FA email
    await sendEmail(
      user.email,
      '2FA Verification Code',
      `Your 2-Factor Authentication verification code is: ${code}\nThis code will expire in 5 minutes.`
    );

    return res.status(200).json({
      status: '2fa_required',
      userId: user.id,
      message: '2-Factor Authentication code has been sent to your email.'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

// Verify 2FA code and issue token
const verify2FA = async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ error: 'User ID and 2FA code are required' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.pooling_station_id, u.two_factor_code, u.two_factor_expires,
              ps.name AS station_name
       FROM users u
       LEFT JOIN pooling_stations ps ON ps.id = u.pooling_station_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.two_factor_code || user.two_factor_code !== code) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    if (new Date() > new Date(user.two_factor_expires)) {
      return res.status(401).json({ error: 'Verification code has expired' });
    }

    // Clear 2FA code from database
    await db.query(
      'UPDATE users SET two_factor_code = NULL, two_factor_expires = NULL WHERE id = $1',
      [userId]
    );

    // Build JWT payload
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    if (user.role === 'pooling_station' && user.pooling_station_id) {
      tokenPayload.pooling_station_id = user.pooling_station_id;
      tokenPayload.station_name = user.station_name;
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const responseUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    if (user.role === 'pooling_station' && user.pooling_station_id) {
      responseUser.pooling_station_id = user.pooling_station_id;
      responseUser.station_name = user.station_name;
    }

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: responseUser,
    });
  } catch (err) {
    console.error('Verify 2FA error:', err);
    return res.status(500).json({ error: 'Internal server error during 2FA verification' });
  }
};

// Forgot Password endpoint
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await db.query('SELECT id, username, email FROM users WHERE email = $1 OR username = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user account found with this email' });
    }

    const user = result.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.query(
      'UPDATE users SET reset_code = $1, reset_expires = $2 WHERE id = $3',
      [code, expires, user.id]
    );

    // Send reset code email
    await sendEmail(
      user.email,
      'Password Reset Code',
      `Hello ${user.username},\n\nYour code to reset your password is: ${code}\nThis code will expire in 15 minutes.`
    );

    return res.status(200).json({ message: 'Password reset code has been sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset Password endpoint
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required' });
  }

  try {
    const result = await db.query(
      'SELECT id, reset_code, reset_expires FROM users WHERE email = $1 OR username = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.reset_code || user.reset_code !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }

    if (new Date() > new Date(user.reset_expires)) {
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    return res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get profile + plant permissions of logged in user
const getMe = async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, u.pooling_station_id,
              ps.name AS station_name
       FROM users u
       LEFT JOIN pooling_stations ps ON ps.id = u.pooling_station_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Fetch user plant permissions (varies by role)
    let permissions = [];
    if (user.role === 'admin') {
      // Admin automatically gets read/write for all plants
      const plantsResult = await db.query('SELECT id, name FROM power_plants');
      permissions = plantsResult.rows.map(p => ({
        plant_id: p.id,
        plant_name: p.name,
        can_read: true,
        can_write: true,
      }));
    } else if (user.role === 'pooling_station') {
      // Pooling station users see all ppc_plants in their station
      const ppcResult = await db.query(
        `SELECT id AS plant_id, plant_name, capacity_mw, status
         FROM ppc_plants
         WHERE pooling_station_id = $1
         ORDER BY plant_name`,
        [user.pooling_station_id]
      );
      permissions = ppcResult.rows;
    } else {
      const permResult = await db.query(
        `SELECT perm.plant_id, p.name as plant_name, perm.can_read, perm.can_write
         FROM user_plant_permissions perm
         JOIN power_plants p ON perm.plant_id = p.id
         WHERE perm.user_id = $1`,
        [user.id]
      );
      permissions = permResult.rows;
    }

    return res.status(200).json({
      user,
      permissions,
    });
  } catch (err) {
    console.error('Error fetching profile me:', err);
    return res.status(500).json({ error: 'Internal server error fetching user details' });
  }
};

// Logout endpoint (client deletes token; backend acknowledges and returns success)
const logout = async (req, res) => {
  return res.status(200).json({ message: 'Logout successful. Token invalidated client-side.' });
};

// Change own password (from User Dashboard / Profile tab)
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  try {
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error changing password' });
  }
};

module.exports = {
  login,
  getMe,
  logout,
  changePassword,
  verify2FA,
  forgotPassword,
  resetPassword,
};
