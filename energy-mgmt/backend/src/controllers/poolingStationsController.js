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
        pp.id,
        pp.plant_name,
        pp.capacity_mw,
        pp.owner,
        pp.wbes_acronym,
        pp.evacuating_line,
        pp.poi,
        pp.ppc_oem,
        pp.ppc_mode_of_control,
        pp.ppc_reference_point,
        pp.ppc_reference_voltage_kv,
        pp.ppc_voltage_deadband_pct,
        pp.ppc_voltage_droop_pct,
        pp.max_reactive_power_injection_mvar,
        pp.max_reactive_power_absorption_mvar,
        pp.ppc_comm_time_ms,
        pp.ppc_sampling_time_ms,
        pp.ppc_total_exec_time_ms,
        pp.freq_control_mode,
        pp.freq_deadband,
        pp.freq_droop_pct,
        pp.power_reduction_at_50_3hz,
        pp.power_plant_id,
        pw.name AS linked_plant_name,
        ps.name AS pooling_station_name
       FROM ppc_plants pp
       LEFT JOIN power_plants pw ON pw.id = pp.power_plant_id
       LEFT JOIN pooling_stations ps ON ps.id = pp.pooling_station_id
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
