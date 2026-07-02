const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

require('dotenv').config();

const main = async () => {
  console.log('====================================================');
  console.log('Resetting database and seeding bypass users...');
  console.log('====================================================');

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
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  try {
    // 1. Reset Schema (wipes all tables and data)
    console.log('Running schema.sql to drop and recreate all tables...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('Schema reset complete (all data removed).');

    // 1b. Run Migration (applies schema changes since June 25th)
    console.log('Running migration.sql to apply database updates...');
    const migrationSql = fs.readFileSync(path.join(__dirname, '../database/migration.sql'), 'utf8');
    await client.query(migrationSql);
    console.log('Migration complete (schema is up-to-date).');

    // 2. Generate password hashes
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
    const userPasswordHash = await bcrypt.hash('User@123', salt);

    // 3. Insert Admin User
    console.log('Inserting admin bypass user...');
    await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
    `, ['admin', 'admin@energymgmt.com', adminPasswordHash]);
    console.log('Admin user inserted: username = "admin", password = "Admin@123"');

    // 4. Insert Regular User
    console.log('Inserting regular bypass user...');
    await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'user')
    `, ['user', 'user@energymgmt.com', userPasswordHash]);
    console.log('Regular user inserted: username = "user", password = "User@123"');

    console.log('====================================================');
    console.log('Database reset and seeding completed successfully!');
    console.log('====================================================');
  } catch (err) {
    console.error('Error during reset/seeding:', err);
  } finally {
    await client.end();
  }
};

main();
