const db = require('../config/db');

const getSystemLogs = async (req, res) => {
  // Admin only
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin role required to view system logs' });
  }

  try {
    const result = await db.query(
      `SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100`
    );
    return res.status(200).json({ logs: result.rows });
  } catch (err) {
    console.error('Error fetching system logs:', err);
    return res.status(500).json({ error: `Internal server error fetching system logs: ${err?.message || ''}` });
  }
};

module.exports = {
  getSystemLogs,
};
