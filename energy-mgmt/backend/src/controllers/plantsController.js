const db = require('../config/db');

// GET /api/plants - list all plants with inverter count summary (scoped by read permissions)
const getAllPlants = async (req, res) => {
  const { status, search } = req.query;

  try {
    let queryText = `
      SELECT p.*, 
             MAX(pp.ppc_oem) AS ppc_oem,
             COALESCE(SUM(i.count), 0)::int as inverter_count,
             COALESCE(SUM(CASE WHEN i.status = 'online' THEN i.count ELSE 0 END), 0)::int as online_count,
             COALESCE(SUM(CASE WHEN i.status = 'fault' THEN i.count ELSE 0 END), 0)::int as fault_count,
             COALESCE(SUM(CASE WHEN i.status = 'offline' THEN i.count ELSE 0 END), 0)::int as offline_count,
             COALESCE(string_agg(DISTINCT i.make, ', ') FILTER (WHERE i.type != 'SVG' AND i.make IS NOT NULL), '—') as inverter_makes,
             COALESCE(string_agg(DISTINCT i.make, ', ') FILTER (WHERE i.type = 'SVG' AND i.make IS NOT NULL), '—') as svg_makes,
             COALESCE(SUM(i.total_capacity_mw), 0)::numeric as total_inverter_capacity
      FROM power_plants p
      LEFT JOIN inverters i ON p.id = i.plant_id
      LEFT JOIN ppc_plants pp ON p.id = pp.power_plant_id
    `;

    const whereClauses = [];
    const queryParams = [];

    // 1. Permission checks: regular users can only access permitted plants
    if (req.user.role !== 'admin') {
      queryParams.push(req.user.id);
      whereClauses.push(`p.id IN (
        SELECT plant_id 
        FROM user_plant_permissions 
        WHERE user_id = $${queryParams.length} AND can_read = TRUE
      )`);
    }

    // 2. Status filtering
    if (status) {
      queryParams.push(status);
      whereClauses.push(`p.status = $${queryParams.length}`);
    }

    // 3. Search filter
    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(p.name ILIKE $${queryParams.length} OR p.location ILIKE $${queryParams.length})`);
    }

    if (whereClauses.length > 0) {
      queryText += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryText += ' GROUP BY p.id ORDER BY p.id DESC';

    const result = await db.query(queryText, queryParams);

    // Fetch user write permissions for frontend display
    let plants = result.rows;
    if (req.user.role !== 'admin') {
      // Fetch permissions map
      const permResult = await db.query(
        'SELECT plant_id, can_write FROM user_plant_permissions WHERE user_id = $1',
        [req.user.id]
      );
      const permMap = {};
      permResult.rows.forEach(r => {
        permMap[r.plant_id] = r.can_write;
      });

      plants = plants.map(p => ({
        ...p,
        can_write: !!permMap[p.id]
      }));
    } else {
      // Admin has full write access
      plants = plants.map(p => ({
        ...p,
        can_write: true
      }));
    }

    return res.status(200).json({ plants });
  } catch (err) {
    console.error('Error fetching power plants:', err);
    return res.status(500).json({ error: 'Internal server error fetching power plants' });
  }
};

// GET /api/plants/:id - single plant with all its inverters
const getPlantById = async (req, res) => {
  const { id } = req.params;

  try {
    // Get plant details
    const plantResult = await db.query(
      `SELECT p.*, pp.ppc_oem AS ppc_oem 
       FROM power_plants p 
       LEFT JOIN ppc_plants pp ON p.id = pp.power_plant_id 
       WHERE p.id = $1`,
      [id]
    );
    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Power plant not found' });
    }

    const plant = plantResult.rows[0];

    // Scoped check for regular users
    if (req.user.role !== 'admin') {
      const permCheck = await db.query(
        'SELECT can_read, can_write FROM user_plant_permissions WHERE user_id = $1 AND plant_id = $2',
        [req.user.id, id]
      );

      if (permCheck.rows.length === 0 || !permCheck.rows[0].can_read) {
        return res.status(403).json({ error: 'Access denied: No read permissions for this power plant' });
      }
      plant.can_write = permCheck.rows[0].can_write;
    } else {
      plant.can_write = true;
    }

    // Fetch inverters for this plant
    const invertersResult = await db.query(
      'SELECT * FROM inverters WHERE plant_id = $1 ORDER BY id DESC',
      [id]
    );

    return res.status(200).json({
      plant,
      inverters: invertersResult.rows
    });
  } catch (err) {
    console.error('Error fetching plant details:', err);
    return res.status(500).json({ error: 'Internal server error fetching plant details' });
  }
};

// POST /api/plants - create plant (Admin only)
const createPlant = async (req, res) => {
  const { name, location, capacity_mw, commissioned_date, status, owner, company_group, pooling_station } = req.body;

  if (!name || !location || !capacity_mw) {
    return res.status(400).json({ error: 'Required fields: name, location, capacity_mw' });
  }

  try {
    const result = await db.query(
      `INSERT INTO power_plants (name, location, capacity_mw, commissioned_date, status, owner, company_group, pooling_station) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [name, location, capacity_mw, commissioned_date || null, status || 'active', owner || null, company_group || null, pooling_station || null]
    );

    // Log creation
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, username, `Create Plant (ID: ${result.rows[0].id})`, `Registered power plant "${name}" with capacity ${capacity_mw} MW.`
      ]
    );

    return res.status(201).json({
      message: 'Power plant created successfully',
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating plant:', err);
    return res.status(500).json({ error: 'Internal server error creating power plant' });
  }
};

// PUT /api/plants/:id - update plant (Admin only)
const updatePlant = async (req, res) => {
  const { id } = req.params;
  const { name, location, capacity_mw, commissioned_date, status, owner, company_group, pooling_station } = req.body;

  try {
    const check = await db.query('SELECT * FROM power_plants WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Power plant not found' });
    }

    const oldPlant = check.rows[0];

    // Compare and prepare log changes
    const changes = [];
    const fieldsToCompare = {
      name: 'Name',
      location: 'Location',
      capacity_mw: 'Capacity (MW)',
      commissioned_date: 'Commissioned Date',
      status: 'Status',
      owner: 'Owner',
      company_group: 'Company Group',
      pooling_station: 'Pooling Station'
    };

    for (const [key, label] of Object.entries(fieldsToCompare)) {
      const newVal = req.body[key];
      const oldVal = oldPlant[key];
      if (newVal !== undefined && String(oldVal) !== String(newVal)) {
        changes.push(`${label} changed from "${oldVal || 'None'}" to "${newVal || 'None'}"`);
      }
    }

    const result = await db.query(
      `UPDATE power_plants 
       SET name = COALESCE($1, name), 
           location = COALESCE($2, location), 
           capacity_mw = COALESCE($3, capacity_mw), 
           commissioned_date = COALESCE($4, commissioned_date), 
           status = COALESCE($5, status),
           owner = COALESCE($6, owner),
           company_group = COALESCE($7, company_group),
           pooling_station = COALESCE($8, pooling_station)
       WHERE id = $9 
       RETURNING *`,
      [name, location, capacity_mw, commissioned_date, status, owner, company_group, pooling_station, id]
    );

    // Save changes to log
    if (changes.length > 0) {
      const username = req.user.username || req.user.email;
      await db.query(
        `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
        [req.user.id, username, `Update Plant (ID: ${id})`, changes.join(', ')]
      );
    }

    return res.status(200).json({
      message: 'Power plant updated successfully',
      plant: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating plant:', err);
    return res.status(500).json({ error: 'Internal server error updating power plant' });
  }
};

// DELETE /api/plants/:id - delete plant + cascade inverters (Admin only)
const deletePlant = async (req, res) => {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT * FROM power_plants WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Power plant not found' });
    }

    const plant = check.rows[0];

    await db.query('DELETE FROM power_plants WHERE id = $1', [id]);

    // Log deletion
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, username, `Delete Plant (ID: ${id})`, `Deleted power plant "${plant.name}".`]
    );

    return res.status(200).json({ message: 'Power plant and its inverters deleted successfully' });
  } catch (err) {
    console.error('Error deleting plant:', err);
    return res.status(500).json({ error: 'Internal server error deleting power plant' });
  }
};

module.exports = {
  getAllPlants,
  getPlantById,
  createPlant,
  updatePlant,
  deletePlant,
};
