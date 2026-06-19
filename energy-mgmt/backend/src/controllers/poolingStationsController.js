const db = require('../config/db');

/**
 * GET /api/pooling-stations
 * Admin → all stations. pooling_station role → only their own station.
 */
const getAllPoolingStations = async (req, res) => {
  try {
    let query;
    let params = [];

    if (req.user.role === 'admin') {
      query = `
        SELECT
          ps.id,
          ps.name,
          ps.login_id,
          ps.total_capacity_mw,
          ps.created_at,
          COUNT(pp.id)::int AS plant_count,
          COALESCE(SUM(pp.capacity_mw), 0)::numeric AS actual_capacity_mw
        FROM pooling_stations ps
        LEFT JOIN ppc_plants pp ON pp.pooling_station_id = ps.id
        GROUP BY ps.id
        ORDER BY ps.name
      `;
    } else {
      // pooling_station role — return only own station
      query = `
        SELECT
          ps.id,
          ps.name,
          ps.login_id,
          ps.total_capacity_mw,
          ps.created_at,
          COUNT(pp.id)::int AS plant_count,
          COALESCE(SUM(pp.capacity_mw), 0)::numeric AS actual_capacity_mw
        FROM pooling_stations ps
        LEFT JOIN ppc_plants pp ON pp.pooling_station_id = ps.id
        WHERE ps.id = $1
        GROUP BY ps.id
        ORDER BY ps.name
      `;
      params = [req.user.pooling_station_id];
    }

    const result = await db.query(query, params);
    return res.status(200).json({ poolingStations: result.rows });
  } catch (err) {
    console.error('Error fetching pooling stations:', err);
    return res.status(500).json({ error: 'Internal server error fetching pooling stations' });
  }
};

/**
 * GET /api/pooling-stations/:id
 * Returns station detail + all PPC plants under it.
 */
const getPoolingStationById = async (req, res) => {
  const { id } = req.params;
  try {
    const stationResult = await db.query(
      `SELECT id, name, login_id, total_capacity_mw, created_at FROM pooling_stations WHERE id = $1`,
      [id]
    );
    if (stationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pooling station not found' });
    }

    const plantsResult = await db.query(
      `SELECT
        pp.*,
        pw.name AS linked_plant_name
       FROM ppc_plants pp
       LEFT JOIN power_plants pw ON pw.id = pp.power_plant_id
       WHERE pp.pooling_station_id = $1
       ORDER BY pp.plant_name`,
      [id]
    );

    return res.status(200).json({
      station: stationResult.rows[0],
      plants: plantsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching pooling station by id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/pooling-stations  (admin only)
 */
const createPoolingStation = async (req, res) => {
  const { name, login_id, password, total_capacity_mw } = req.body;
  if (!name || !login_id || !password) {
    return res.status(400).json({ error: 'name, login_id, and password are required' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO pooling_stations (name, login_id, password_hash, total_capacity_mw)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, login_id, total_capacity_mw, created_at`,
      [name, login_id, passwordHash, total_capacity_mw || null]
    );



    return res.status(201).json({ station: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pooling station with this name or login_id already exists' });
    }
    console.error('Error creating pooling station:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/pooling-stations/:id  (admin only)
 */
const updatePoolingStation = async (req, res) => {
  const { id } = req.params;
  const { name, login_id, total_capacity_mw } = req.body;
  try {
    const result = await db.query(
      `UPDATE pooling_stations
       SET name = COALESCE($1, name),
           login_id = COALESCE($2, login_id),
           total_capacity_mw = COALESCE($3, total_capacity_mw)
       WHERE id = $4
       RETURNING id, name, login_id, total_capacity_mw`,
      [name || null, login_id || null, total_capacity_mw || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pooling station not found' });
    }
    return res.status(200).json({ station: result.rows[0] });
  } catch (err) {
    console.error('Error updating pooling station:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/pooling-stations/:id  (admin only)
 * Cascades to ppc_plants (via FK ON DELETE CASCADE).
 */
const deletePoolingStation = async (req, res) => {
  const { id } = req.params;
  try {
    // Null out user references first (users.pooling_station_id SET NULL on cascade)
    const result = await db.query(
      `DELETE FROM pooling_stations WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pooling station not found' });
    }
    return res.status(200).json({ message: 'Pooling station deleted successfully' });
  } catch (err) {
    console.error('Error deleting pooling station:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllPoolingStations,
  getPoolingStationById,
  createPoolingStation,
  updatePoolingStation,
  deletePoolingStation,
};
