const { Client } = require('pg');
require('dotenv').config();

const main = async () => {
  console.log('Running migrate-v3.js...');
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
    console.log('Connected to DB.');

    // DROP company column
    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS company;
    `);
    console.log('Successfully dropped "company" column from "users" table.');
    console.log('Migration migrate-v3 complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
};

main();
