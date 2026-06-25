const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

// Load env configuration from backend directory
require('dotenv').config();

const main = async () => {
  console.log('====================================================');
  console.log('Starting DB seeding with real-world grid dataset...');
  console.log('====================================================');
  
  // 1. Dynamic import realData.js from the workspace root folder
  const realDataPath = 'file:///' + path.join(__dirname, '../../realData.js').replace(/\\/g, '/');
  console.log('Importing real data from:', realDataPath);
  
  let powerPlants, inverterGroups;
  try {
    const data = await import(realDataPath);
    powerPlants = data.powerPlants;
    inverterGroups = data.inverterGroups;
  } catch (err) {
    console.error('Failed to import realData.js from workspace root:', err);
    process.exit(1);
  }

  // 2. Initialize pg Client
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'energy_db',
    ssl: false,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
  } catch (err) {
    console.error('Database connection failed. Check your local PostgreSQL instance and credentials in backend/.env', err);
    process.exit(1);
  }

  try {
    // 3. Reset schema
    console.log('Resetting database schema (running schema.sql)...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('Schema reset complete.');

    // 4. Seed Users
    console.log('Generating password hashes for users...');
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('Admin@123', salt);

    // Extract unique company groups
    const companyGroups = [...new Set(powerPlants.map(p => p.company_group).filter(Boolean))];
    console.log('Detected company groups:', companyGroups);

    console.log('Inserting admin profile...');
    await client.query(`
      INSERT INTO users (username, email, password_hash, role) VALUES
      ('admin', 'admin@energymgmt.com', $1, 'admin')
    `, [adminHash]);

    const usersMap = {}; // company_group -> user_id
    console.log('Inserting company operator profiles...');
    for (const company of companyGroups) {
      const username = company.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${username}@energymgmt.com`;
      const password = `${username.charAt(0).toUpperCase() + username.slice(1)}@123`;
      const userHash = await bcrypt.hash(password, salt);

      console.log(`Creating user: ${username} | Email: ${email} | Password: ${password}`);

      const userInsertResult = await client.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'user')
        RETURNING id
      `, [username, email, userHash]);

      usersMap[company] = userInsertResult.rows[0].id;
    }
    console.log('Users seeded successfully.');

    // 5. Seed Power Plants
    console.log(`Inserting ${powerPlants.length} power plants...`);
    for (const plant of powerPlants) {
      await client.query(`
        INSERT INTO power_plants (id, name, owner, company_group, pooling_station, capacity_mw, commissioned_date, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        plant.id,
        plant.name,
        plant.owner,
        plant.company_group,
        plant.pooling_station,
        plant.capacity_mw,
        plant.commissioned_date ? new Date(plant.commissioned_date) : null,
        plant.location
      ]);
    }
    console.log('Power plants seeded successfully.');

    // Adjust power_plants id sequence to start after the seeded IDs
    await client.query(`SELECT setval('power_plants_id_seq', (SELECT MAX(id) FROM power_plants))`);

    // 6. Seed Inverter Groups
    console.log(`Inserting ${inverterGroups.length} inverter groups (representing ${inverterGroups.reduce((acc, curr) => acc + curr.count, 0)} units)...`);
    for (const group of inverterGroups) {
      await client.query(`
        INSERT INTO inverters (id, plant_id, make, model, type, rating_mva, capacity_mw, count, total_capacity_mw, pooling_station, owner, efficiency_percent, last_maintenance_date, lvrt, hvrt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        group.id,
        group.plant_id,
        group.make,
        group.model,
        group.type,
        group.rating_mva,
        group.capacity_kw ? (group.capacity_kw / 1000.0) : 0,
        group.count,
        group.total_capacity_mw,
        group.pooling_station,
        group.owner,
        group.efficiency_percent,
        group.last_maintenance_date ? new Date(group.last_maintenance_date) : null,
        group.lvrt ? JSON.stringify(group.lvrt) : null,
        group.hvrt ? JSON.stringify(group.hvrt) : null
      ]);
    }
    console.log('Inverter groups seeded successfully.');

    // Adjust inverters id sequence to start after the seeded IDs
    await client.query(`SELECT setval('inverters_id_seq', (SELECT MAX(id) FROM inverters))`);

    // 7. Seed Permissions
    console.log('Distributing plant permissions among company users...');
    for (const plant of powerPlants) {
      const company = plant.company_group;
      const userId = usersMap[company];
      if (userId) {
        await client.query(`
          INSERT INTO user_plant_permissions (user_id, plant_id, can_read, can_write)
          VALUES ($1, $2, TRUE, TRUE)
        `, [userId, plant.id]);
      }
    }
    console.log('Permissions distributed successfully.');
    console.log('====================================================');
    console.log('Database seeding finished successfully!');
    console.log('====================================================');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
};

main();
