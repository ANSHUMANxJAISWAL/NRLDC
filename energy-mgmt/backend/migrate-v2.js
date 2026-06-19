const { Client } = require('pg');
require('dotenv').config();

const main = async () => {
  console.log('Running migrate-v2.js...');
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

    // RENAME column and convert values
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='inverters' AND column_name='capacity_kw'
        ) THEN
          ALTER TABLE inverters RENAME COLUMN capacity_kw TO capacity_mw;
          ALTER TABLE inverters ALTER COLUMN capacity_mw TYPE NUMERIC(10, 4);
          UPDATE inverters SET capacity_mw = capacity_mw / 1000.0 WHERE capacity_mw > 50;
          RAISE NOTICE 'Updated inverters capacity_kw to capacity_mw.';
        ELSE
          RAISE NOTICE 'capacity_kw column already converted or missing.';
        END IF;
      END$$;
    `);

    // Add 2FA and password reset columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_code VARCHAR(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_expires TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP WITH TIME ZONE;
    `);
    console.log('Users table columns updated.');

    // Create system_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('system_logs table ready.');

    console.log('Migration migrate-v2 complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
};

main();
