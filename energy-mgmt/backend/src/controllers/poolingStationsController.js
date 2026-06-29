const db = require('../config/db');

/**
 * GET /api/pooling-stations
 * Admin & standard users → all stations.
 */
const getAllPoolingStations = async (req, res) => {
  try {
    const query = `
      SELECT
        ps.id,
        ps.name,
        ps.total_capacity_mw,
        ps.created_at,
        COUNT(pp.id)::int AS plant_count,
        COALESCE(SUM(pp.capacity_mw), 0)::numeric AS actual_capacity_mw
      FROM pooling_stations ps
      LEFT JOIN ppc_plants pp ON pp.pooling_station_id = ps.id
      GROUP BY ps.id
      ORDER BY ps.name
    `;

    const result = await db.query(query);
    return res.status(200).json({ poolingStations: result.rows });
  } catch (err) {
    console.error('Error fetching pooling stations:', err);
    return res.status(500).json({ error: `Internal server error fetching pooling stations: ${err?.message || ''}` });
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
      `SELECT id, name, total_capacity_mw, created_at FROM pooling_stations WHERE id = $1`,
      [id]
    );
    if (stationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pooling station not found' });
    }

    const plantsResult = await db.query(
      `SELECT
        pw.id,
        pw.name AS plant_name,
        pw.name,
        pw.capacity_mw,
        pw.owner,
        pw.company_group,
        pw.location,
        pw.commissioned_date,
        pw.pooling_station_id,
        pp.wbes_acronym,
        pp.evacuating_line,
        pp.ppc_oem
       FROM power_plants pw
       LEFT JOIN ppc_plants pp ON pw.id = pp.power_plant_id
       WHERE pw.pooling_station_id = $1
       ORDER BY pw.name`,
      [id]
    );

    return res.status(200).json({
      station: stationResult.rows[0],
      plants: plantsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching pooling station by id:', err);
    return res.status(500).json({ error: `Internal server error: ${err?.message || ''}` });
  }
};

/**
 * POST /api/pooling-stations  (admin only)
 */
const createPoolingStation = async (req, res) => {
  const { name, total_capacity_mw } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO pooling_stations (name, total_capacity_mw)
       VALUES ($1, $2)
       RETURNING id, name, total_capacity_mw, created_at`,
      [name, total_capacity_mw || null]
    );

    return res.status(201).json({ station: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pooling station with this name already exists' });
    }
    console.error('Error creating pooling station:', err);
    return res.status(500).json({ error: `Internal server error: ${err?.message || ''}` });
  }
};

/**
 * PUT /api/pooling-stations/:id  (admin only)
 */
const updatePoolingStation = async (req, res) => {
  const { id } = req.params;
  const { name, total_capacity_mw } = req.body;
  try {
    const result = await db.query(
      `UPDATE pooling_stations
       SET name = COALESCE($1, name),
           total_capacity_mw = COALESCE($2, total_capacity_mw)
       WHERE id = $3
       RETURNING id, name, total_capacity_mw`,
      [name || null, total_capacity_mw || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pooling station not found' });
    }
    return res.status(200).json({ station: result.rows[0] });
  } catch (err) {
    console.error('Error updating pooling station:', err);
    return res.status(500).json({ error: `Internal server error: ${err?.message || ''}` });
  }
};

/**
 * DELETE /api/pooling-stations/:id  (admin only)
 * Cascades to ppc_plants (via FK ON DELETE CASCADE).
 */
const deletePoolingStation = async (req, res) => {
  const { id } = req.params;
  try {
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
    return res.status(500).json({ error: `Internal server error: ${err?.message || ''}` });
  }
};

module.exports = {
  getAllPoolingStations,
  getPoolingStationById,
  createPoolingStation,
  updatePoolingStation,
  deletePoolingStation,
};
