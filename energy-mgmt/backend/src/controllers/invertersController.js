const db = require('../config/db');

// Helper to verify user permissions for a plant
const verifyPlantPermission = async (userId, role, plantId, requiredPermission) => {
  if (role === 'admin') return true;
  const result = await db.query(
    `SELECT can_read, can_write FROM user_plant_permissions WHERE user_id = $1 AND plant_id = $2`,
    [userId, plantId]
  );
  if (result.rows.length === 0) return false;
  const permissions = result.rows[0];
  if (requiredPermission === 'write') return permissions.can_write;
  return permissions.can_read;
};

// GET /api/inverters - list inverters with advanced searching, filtering, sorting, pagination
const getInverters = async (req, res) => {
  const { plant_id, status, type, search, sort, order, page, limit } = req.query;

  try {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    const offset = (pageNum - 1) * limitNum;

    let selectQuery = `
      SELECT i.*, p.name as plant_name, pp.freq_control_mode
      FROM inverters i
      JOIN power_plants p ON i.plant_id = p.id
      LEFT JOIN ppc_plants pp ON p.id = pp.power_plant_id
    `;

    let countQuery = `
      SELECT COUNT(i.id)::int as total
      FROM inverters i
      JOIN power_plants p ON i.plant_id = p.id
      LEFT JOIN ppc_plants pp ON p.id = pp.power_plant_id
    `;

    const whereClauses = [];
    const queryParams = [];

    // 1. Enforce regular user scoping: they can only view inverters in plants they can read
    if (req.user.role !== 'admin') {
      queryParams.push(req.user.id);
      const permClause = `i.plant_id IN (
        SELECT plant_id 
        FROM user_plant_permissions 
        WHERE user_id = $${queryParams.length} AND can_read = TRUE
      )`;
      whereClauses.push(permClause);
    }

    // 2. Specific Plant ID Filter
    if (plant_id) {
      const pId = parseInt(plant_id, 10);
      if (!isNaN(pId)) {
        if (req.user.role !== 'admin') {
          const hasRead = await verifyPlantPermission(req.user.id, req.user.role, pId, 'read');
          if (!hasRead) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to access inverters for this plant' });
          }
        }
        queryParams.push(pId);
        whereClauses.push(`i.plant_id = $${queryParams.length}`);
      }
    }


    // 3b. Device Type Filter
    if (type && type !== '' && type !== 'All') {
      queryParams.push(type);
      whereClauses.push(`i.type = $${queryParams.length}`);
    }

    // 4. Search Keyword (make, model, type, pooling_station, owner)
    if (search) {
      queryParams.push(`%${search}%`);
      whereClauses.push(`(i.make ILIKE $${queryParams.length} OR i.model ILIKE $${queryParams.length} OR i.type ILIKE $${queryParams.length} OR i.pooling_station ILIKE $${queryParams.length} OR i.owner ILIKE $${queryParams.length})`);
    }

    // Combine WHERE clauses
    if (whereClauses.length > 0) {
      const clausesString = ' WHERE ' + whereClauses.join(' AND ');
      selectQuery += clausesString;
      countQuery += clausesString;
    }

    // 5. Sorting
    const allowedSortFields = ['capacity_mw', 'efficiency_percent', 'last_maintenance_date', 'make', 'model', 'type', 'count', 'total_capacity_mw', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'id';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    selectQuery += ` ORDER BY i.${sortField} ${sortOrder}`;

    // 6. Pagination Limit & Offset
    const pagingParams = [...queryParams];
    pagingParams.push(limitNum);
    selectQuery += ` LIMIT $${pagingParams.length}`;
    pagingParams.push(offset);
    selectQuery += ` OFFSET $${pagingParams.length}`;

    // Execute queries in parallel
    const [dataResult, countResult] = await Promise.all([
      db.query(selectQuery, pagingParams),
      db.query(countQuery, queryParams)
    ]);

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: dataResult.rows,
      total,
      page: pageNum,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching inverters:', err);
    return res.status(500).json({ error: `Internal server error fetching inverters: ${err?.message || ''}` });
  }
};

// GET /api/inverters/:id - single inverter detail
const getInverterById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT i.*, p.name as plant_name, pp.freq_control_mode
       FROM inverters i
       JOIN power_plants p ON i.plant_id = p.id
       LEFT JOIN ppc_plants pp ON p.id = pp.power_plant_id
       WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inverter not found' });
    }

    const inverter = result.rows[0];

    // Verify read access
    const hasRead = await verifyPlantPermission(req.user.id, req.user.role, inverter.plant_id, 'read');
    if (!hasRead) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this inverter' });
    }

    return res.status(200).json({ inverter });
  } catch (err) {
    console.error('Error fetching inverter detail:', err);
    return res.status(500).json({ error: `Internal server error fetching inverter details: ${err?.message || ''}` });
  }
};

// POST /api/inverters - create inverter (requires can_write=true for the target plant)
const createInverter = async (req, res) => {
  const {
    plant_id,
    make,
    model,
    type,
    rating_mva,
    capacity_mw,
    count,
    total_capacity_mw,
    pooling_station,
    owner,
    status,
    efficiency_percent,
    last_maintenance_date,
    lvrt,
    hvrt
  } = req.body;

  if (!plant_id || !make || !model || !type || capacity_mw === undefined || count === undefined || total_capacity_mw === undefined) {
    return res.status(400).json({ error: 'Required fields: plant_id, make, model, type, capacity_mw, count, total_capacity_mw' });
  }

  try {
    const plantCheck = await db.query('SELECT id FROM power_plants WHERE id = $1', [plant_id]);
    if (plantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Power plant not found' });
    }

    // Check plant permission
    const hasWrite = await verifyPlantPermission(req.user.id, req.user.role, plant_id, 'write');
    if (!hasWrite) {
      return res.status(403).json({ error: 'Access denied: You require write permission for this power plant to create inverters' });
    }

    const result = await db.query(
      `INSERT INTO inverters (plant_id, make, model, type, rating_mva, capacity_mw, count, total_capacity_mw, pooling_station, owner, efficiency_percent, last_maintenance_date, lvrt, hvrt) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING *`,
      [
        plant_id,
        make,
        model,
        type,
        rating_mva || null,
        capacity_mw,
        count,
        total_capacity_mw,
        pooling_station || null,
        owner || null,
        efficiency_percent !== undefined && efficiency_percent !== '' ? efficiency_percent : null,
        last_maintenance_date || null,
        lvrt ? JSON.stringify(lvrt) : null,
        hvrt ? JSON.stringify(hvrt) : null
      ]
    );

    // Log the creation
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        username,
        `Create Inverter Group (ID: ${result.rows[0].id})`,
        `Registered inverter group "${make} ${model}" under plant ID ${plant_id} with ${count} units (${capacity_mw} MW each).`
      ]
    );

    return res.status(201).json({
      message: 'Inverter group created successfully',
      inverter: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating inverter:', err);
    return res.status(500).json({ error: `Internal server error creating inverter: ${err?.message || ''}` });
  }
};

// PUT /api/inverters/:id - update inverter (requires can_write=true for the inverter's plant)
const updateInverter = async (req, res) => {
  const { id } = req.params;
  const {
    make,
    model,
    type,
    rating_mva,
    capacity_mw,
    count,
    total_capacity_mw,
    pooling_station,
    owner,
    efficiency_percent,
    last_maintenance_date,
    lvrt,
    hvrt,
    history
  } = req.body;

  try {
    const invResult = await db.query('SELECT * FROM inverters WHERE id = $1', [id]);
    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inverter not found' });
    }

    const inverter = invResult.rows[0];

    // Check plant permission
    const hasWrite = await verifyPlantPermission(req.user.id, req.user.role, inverter.plant_id, 'write');
    if (!hasWrite) {
      return res.status(403).json({ error: 'Access denied: You require write permission for this power plant to update inverters' });
    }

    // Compare and log changes
    const changes = [];
    const fieldsToCompare = {
      make: 'Make',
      model: 'Model',
      type: 'Type',
      rating_mva: 'Rating (MVA)',
      capacity_mw: 'Unit Capacity (MW)',
      count: 'Units Count',
      total_capacity_mw: 'Total Capacity (MW)',
      pooling_station: 'Pooling Station',
      owner: 'Owner',
      efficiency_percent: 'Efficiency %',
      last_maintenance_date: 'Last Maintenance Date'
    };

    for (const [key, label] of Object.entries(fieldsToCompare)) {
      const newVal = req.body[key];
      const oldVal = inverter[key];
      if (newVal !== undefined && String(oldVal) !== String(newVal)) {
        changes.push(`${label} changed from "${oldVal || 'None'}" to "${newVal || 'None'}"`);
      }
    }

    if (lvrt && JSON.stringify(inverter.lvrt) !== JSON.stringify(lvrt)) {
      changes.push('LVRT settings updated');
    }
    if (hvrt && JSON.stringify(inverter.hvrt) !== JSON.stringify(hvrt)) {
      changes.push('HVRT settings updated');
    }

    const result = await db.query(
      `UPDATE inverters 
       SET make = COALESCE($1, make), 
           model = COALESCE($2, model), 
           type = COALESCE($3, type), 
           rating_mva = COALESCE($4, rating_mva), 
           capacity_mw = COALESCE($5, capacity_mw), 
           count = COALESCE($6, count), 
           total_capacity_mw = COALESCE($7, total_capacity_mw), 
           pooling_station = COALESCE($8, pooling_station), 
           owner = COALESCE($9, owner), 
           efficiency_percent = COALESCE($10, efficiency_percent), 
           last_maintenance_date = COALESCE($11, last_maintenance_date),
           lvrt = COALESCE($12, lvrt),
           hvrt = COALESCE($13, hvrt),
           history = COALESCE($14, history)
       WHERE id = $15 
       RETURNING *`,
      [
        make,
        model,
        type,
        rating_mva,
        capacity_mw,
        count,
        total_capacity_mw,
        pooling_station,
        owner,
        efficiency_percent !== undefined && efficiency_percent !== '' ? efficiency_percent : null,
        last_maintenance_date,
        lvrt ? JSON.stringify(lvrt) : null,
        hvrt ? JSON.stringify(hvrt) : null,
        history ? JSON.stringify(history) : null,
        id
      ]
    );

    // Save changes into system log
    if (changes.length > 0) {
      const username = req.user.username || req.user.email;
      await db.query(
        `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
        [req.user.id, username, `Update Inverter Group (ID: ${id})`, changes.join(', ')]
      );
    }

    return res.status(200).json({
      message: 'Inverter group updated successfully',
      inverter: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating inverter:', err);
    return res.status(500).json({ error: `Internal server error updating inverter: ${err?.message || ''}` });
  }
};

// DELETE /api/inverters/:id - delete inverter (Admin only)
const deleteInverter = async (req, res) => {
  const { id } = req.params;

  try {
    const invResult = await db.query('SELECT * FROM inverters WHERE id = $1', [id]);
    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Inverter not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Deleting inverters is restricted to administrators' });
    }

    const inverter = invResult.rows[0];

    await db.query('DELETE FROM inverters WHERE id = $1', [id]);

    // Log deletion
    const username = req.user.username || req.user.email;
    await db.query(
      `INSERT INTO system_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
      [req.user.id, username, `Delete Inverter Group (ID: ${id})`, `Deleted inverter group "${inverter.make} ${inverter.model}" of plant ID ${inverter.plant_id}.`]
    );

    return res.status(200).json({ message: 'Inverter group deleted successfully' });
  } catch (err) {
    console.error('Error deleting inverter:', err);
    return res.status(500).json({ error: `Internal server error deleting inverter: ${err?.message || ''}` });
  }
};


// GET /api/inverters/export - returns CSV file
const exportInvertersCSV = async (req, res) => {
  const { plant_id } = req.query;

  try {
    let selectQuery = `
      SELECT i.*, p.name as plant_name 
      FROM inverters i
      JOIN power_plants p ON i.plant_id = p.id
    `;

    const whereClauses = [];
    const queryParams = [];

    // User scoping
    if (req.user.role !== 'admin') {
      queryParams.push(req.user.id);
      whereClauses.push(`i.plant_id IN (
        SELECT plant_id 
        FROM user_plant_permissions 
        WHERE user_id = $${queryParams.length} AND can_read = TRUE
      )`);
    }

    if (plant_id) {
      const pId = parseInt(plant_id, 10);
      if (!isNaN(pId)) {
        if (req.user.role !== 'admin') {
          const hasRead = await verifyPlantPermission(req.user.id, req.user.role, pId, 'read');
          if (!hasRead) {
            return res.status(403).json({ error: 'Access denied' });
          }
        }
        queryParams.push(pId);
        whereClauses.push(`i.plant_id = $${queryParams.length}`);
      }
    }
    if (whereClauses.length > 0) {
      selectQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    selectQuery += ' ORDER BY i.id ASC';

    const result = await db.query(selectQuery, queryParams);
    const rows = result.rows;

    let csvContent = 'Group ID,Make,Model,Type,Rating (MVA),Capacity (MW),Count,Total Capacity (MW),Pooling Station,Owner,Efficiency %,Last Maintenance\n';
    
    rows.forEach(r => {
      const lastMaintenance = r.last_maintenance_date 
        ? new Date(r.last_maintenance_date).toISOString().split('T')[0] 
        : 'N/A';
      csvContent += `"${r.id}","${r.make}","${r.model}","${r.type}",${r.rating_mva || 'N/A'},${r.capacity_mw},${r.count},${r.total_capacity_mw},"${r.pooling_station || 'N/A'}","${r.owner || 'N/A'}",${r.efficiency_percent !== null ? r.efficiency_percent : 'N/A'},"${lastMaintenance}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inverters_export.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    return res.status(500).json({ error: `Internal server error exporting CSV file: ${err?.message || ''}` });
  }
};

module.exports = {
  getInverters,
  getInverterById,
  createInverter,
  updateInverter,
  deleteInverter,
  exportInvertersCSV,
};
