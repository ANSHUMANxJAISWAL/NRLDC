const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const main = async () => {
  console.log('====================================================');
  console.log('Running Migration: June 25th to June 29th schema changes');
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

    const sqlPath = path.join(__dirname, '../database/migrate_25_june_to_29_june.sql');
    console.log(`Reading migration SQL file from: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration statements...');
    await client.query(sql);
    console.log('✓ Migration SQL executed successfully.');

    console.log('====================================================');
    console.log('Migration completed successfully!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
};

main();
