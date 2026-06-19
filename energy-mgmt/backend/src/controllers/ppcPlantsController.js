const db = require('../config/db');

/**
 * GET /api/ppc-plants?pooling_station_id=X&search=Y&status=Z
 */
const getAllPpcPlants = async (req, res) => {
  const { pooling_station_id, power_plant_id, search, status } = req.query;

  // If pooling_station role, enforce they can only see their own station
  let stationId = pooling_station_id;
  if (req.user.role === 'pooling_station') {
    stationId = req.user.pooling_station_id;
  }

  try {
    let conditions = [];
    let params = [];
    let idx = 1;

    if (stationId) {
      conditions.push(`pp.pooling_station_id = $${idx++}`);
      params.push(stationId);
    }
    if (power_plant_id) {
      conditions.push(`pp.power_plant_id = $${idx++}`);
      params.push(power_plant_id);
    }
    if (search) {
      conditions.push(`(pp.plant_name ILIKE $${idx} OR pp.owner ILIKE $${idx} OR pp.wbes_acronym ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`pp.status = $${idx++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT
        pp.*,
        ps.name AS pooling_station_name,
        pw.name AS linked_plant_name
       FROM ppc_plants pp
       LEFT JOIN pooling_stations ps ON ps.id = pp.pooling_station_id
       LEFT JOIN power_plants pw ON pw.id = pp.power_plant_id
       ${whereClause}
       ORDER BY pp.plant_name`,
      params
    );
    return res.status(200).json({ ppcPlants: result.rows });
  } catch (err) {
    console.error('Error fetching PPC plants:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/ppc-plants/:id
 */
const getPpcPlantById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT
        pp.*,
        ps.name AS pooling_station_name,
        pw.name AS linked_plant_name
       FROM ppc_plants pp
       LEFT JOIN pooling_stations ps ON ps.id = pp.pooling_station_id
       LEFT JOIN power_plants pw ON pw.id = pp.power_plant_id
       WHERE pp.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PPC plant not found' });
    }

    // Pooling station users can only see plants in their station
    if (req.user.role === 'pooling_station') {
      if (result.rows[0].pooling_station_id !== req.user.pooling_station_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    return res.status(200).json({ plant: result.rows[0] });
  } catch (err) {
    console.error('Error fetching PPC plant:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/ppc-plants  (admin only)
 */
const createPpcPlant = async (req, res) => {
  const {
    pooling_station_id, power_plant_id, plant_name, wbes_acronym, capacity_mw,
    evacuating_line, poi, owner,
    ppc_oem, ppc_mode_of_control, ppc_reference_point, ppc_reference_voltage_kv,
    ppc_voltage_deadband_pct, ppc_voltage_droop_pct,
    max_reactive_power_injection_mvar, max_reactive_power_absorption_mvar,
    ppc_comm_time_ms, ppc_sampling_time_ms, ppc_total_exec_time_ms,
    freq_control_mode, freq_deadband, freq_droop_pct, power_reduction_at_50_3hz,
    status,
  } = req.body;

  if (!pooling_station_id || !plant_name) {
    return res.status(400).json({ error: 'pooling_station_id and plant_name are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO ppc_plants (
        pooling_station_id, power_plant_id, plant_name, wbes_acronym, capacity_mw,
        evacuating_line, poi, owner,
        ppc_oem, ppc_mode_of_control, ppc_reference_point, ppc_reference_voltage_kv,
        ppc_voltage_deadband_pct, ppc_voltage_droop_pct,
        max_reactive_power_injection_mvar, max_reactive_power_absorption_mvar,
        ppc_comm_time_ms, ppc_sampling_time_ms, ppc_total_exec_time_ms,
        freq_control_mode, freq_deadband, freq_droop_pct, power_reduction_at_50_3hz,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24
      ) RETURNING *`,
      [
        pooling_station_id, power_plant_id || null, plant_name, wbes_acronym || null,
        capacity_mw || null, evacuating_line || null, poi || null, owner || null,
        ppc_oem || null, ppc_mode_of_control || null, ppc_reference_point || null,
        ppc_reference_voltage_kv || null, ppc_voltage_deadband_pct || null,
        ppc_voltage_droop_pct || null, max_reactive_power_injection_mvar || null,
        max_reactive_power_absorption_mvar || null, ppc_comm_time_ms || null,
        ppc_sampling_time_ms || null, ppc_total_exec_time_ms || null,
        freq_control_mode || null, freq_deadband || null, freq_droop_pct || null,
        power_reduction_at_50_3hz || null, status || 'active',
      ]
    );

    // Log creation
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, username, `Create PPC Plant (ID: ${result.rows[0].id})`, `Registered PPC plant "${plant_name}" under pooling station ID ${pooling_station_id}.`]
    );

    return res.status(201).json({ plant: result.rows[0] });
  } catch (err) {
    console.error('Error creating PPC plant:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/ppc-plants/:id  (admin or pooling station user)
 */
const updatePpcPlant = async (req, res) => {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT * FROM ppc_plants WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'PPC plant not found' });
    }

    const oldPpc = check.rows[0];

    // Enforce pooling station role boundaries
    if (req.user.role === 'pooling_station') {
      if (oldPpc.pooling_station_id !== req.user.pooling_station_id) {
        return res.status(403).json({ error: 'Access denied: You cannot edit plants in another pooling station' });
      }
    }

    // Compare and prepare log changes
    const changes = [];
    const fieldsToCompare = {
      plant_name: 'PPC Plant Name',
      wbes_acronym: 'WBES Acronym',
      capacity_mw: 'Capacity (MW)',
      evacuating_line: 'Evacuating Line',
      poi: 'Point of Interconnection',
      owner: 'Owner',
      ppc_oem: 'PPC OEM',
      ppc_mode_of_control: 'PPC Mode of Control',
      ppc_reference_point: 'PPC Reference Point',
      ppc_reference_voltage_kv: 'Reference Voltage (kV)',
      ppc_voltage_deadband_pct: 'Voltage Deadband %',
      ppc_voltage_droop_pct: 'Voltage Droop %',
      max_reactive_power_injection_mvar: 'Max Q Injection (MVAr)',
      max_reactive_power_absorption_mvar: 'Max Q Absorption (MVAr)',
      ppc_comm_time_ms: 'Communication Time (ms)',
      ppc_sampling_time_ms: 'Sampling Time (ms)',
      ppc_total_exec_time_ms: 'Total Exec Time (ms)',
      freq_control_mode: 'Frequency Control Mode',
      freq_deadband: 'Frequency Deadband',
      freq_droop_pct: 'Frequency Droop %',
      power_reduction_at_50_3hz: 'Power Reduction @ 50.3Hz',
      status: 'Status',
      pooling_station_id: 'Pooling Station ID',
      power_plant_id: 'Power Plant ID'
    };

    for (const [key, label] of Object.entries(fieldsToCompare)) {
      const newVal = req.body[key];
      const oldVal = oldPpc[key];
      if (newVal !== undefined && String(oldVal) !== String(newVal)) {
        changes.push(`${label} changed from "${oldVal || 'None'}" to "${newVal || 'None'}"`);
      }
    }

    if (req.body.history && JSON.stringify(oldPpc.history) !== JSON.stringify(req.body.history)) {
      changes.push('Settings file / audit history snapshot saved');
    }

    const fields = [
      'plant_name', 'wbes_acronym', 'capacity_mw', 'evacuating_line', 'poi', 'owner',
      'ppc_oem', 'ppc_mode_of_control', 'ppc_reference_point', 'ppc_reference_voltage_kv',
      'ppc_voltage_deadband_pct', 'ppc_voltage_droop_pct',
      'max_reactive_power_injection_mvar', 'max_reactive_power_absorption_mvar',
      'ppc_comm_time_ms', 'ppc_sampling_time_ms', 'ppc_total_exec_time_ms',
      'freq_control_mode', 'freq_deadband', 'freq_droop_pct', 'power_reduction_at_50_3hz',
      'status', 'pooling_station_id', 'power_plant_id', 'history'
    ];

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        if (field === 'history') {
          values.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
        } else {
          values.push(req.body[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE ppc_plants SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Save changes into system log
    if (changes.length > 0) {
      const username = req.user.username || req.user.email;
      await db.query(
        `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
        [req.user.id, username, `Update PPC Plant (ID: ${id})`, changes.join(', ')]
      );
    }

    return res.status(200).json({ plant: result.rows[0] });
  } catch (err) {
    console.error('Error updating PPC plant:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/ppc-plants/:id  (admin only)
 */
const deletePpcPlant = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM ppc_plants WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'PPC plant not found' });
    }

    const ppc = check.rows[0];

    await db.query(`DELETE FROM ppc_plants WHERE id = $1`, [id]);

    // Log deletion
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, username, `Delete PPC Plant (ID: ${id})`, `Deleted PPC plant "${ppc.plant_name}".`]
    );

    return res.status(200).json({ message: 'PPC plant deleted successfully' });
  } catch (err) {
    console.error('Error deleting PPC plant:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllPpcPlants,
  getPpcPlantById,
  createPpcPlant,
  updatePpcPlant,
  deletePpcPlant,
};
