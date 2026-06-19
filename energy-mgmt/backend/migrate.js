/**
 * migrate.js — Non-destructive migration to add PPC tables to an existing DB.
 *
 * Safe to run on a live DB — uses IF NOT EXISTS and DO blocks.
 * Run ONCE before ppcSeed.js:
 *   node migrate.js
 */

const { Client } = require('pg');
require('dotenv').config();

const main = async () => {
  console.log('==============================================');
  console.log('Running PPC Migration (non-destructive)...');
  console.log('==============================================');

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
    console.log('Connected to PostgreSQL successfully.\n');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  try {

    // Step 2: Create pooling_stations table
    console.log("Step 2: Creating pooling_stations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS pooling_stations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        login_id VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        total_capacity_mw NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("  ✓ pooling_stations table ready.\n");

    // Step 3: Add pooling_station_id column to users table if it doesn't exist
    console.log("Step 3: Adding pooling_station_id to users table...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='pooling_station_id'
        ) THEN
          ALTER TABLE users
            ADD COLUMN pooling_station_id INT REFERENCES pooling_stations(id) ON DELETE SET NULL;
          RAISE NOTICE 'Added pooling_station_id column to users.';
        ELSE
          RAISE NOTICE 'pooling_station_id column already exists on users, skipping.';
        END IF;
      END$$;
    `);
    console.log("  ✓ users.pooling_station_id column ready.\n");

    // Step 4: Create ppc_plants table
    console.log("Step 4: Creating ppc_plants table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ppc_plants (
        id SERIAL PRIMARY KEY,
        pooling_station_id INT REFERENCES pooling_stations(id) ON DELETE CASCADE,
        power_plant_id INT REFERENCES power_plants(id) ON DELETE SET NULL,
        plant_name VARCHAR(200) NOT NULL,
        wbes_acronym VARCHAR(50),
        capacity_mw NUMERIC,
        evacuating_line TEXT,
        poi TEXT,
        owner VARCHAR(100),
        ppc_oem VARCHAR(100),
        ppc_mode_of_control VARCHAR(50),
        ppc_reference_point TEXT,
        ppc_reference_voltage_kv VARCHAR(20),
        ppc_voltage_deadband_pct VARCHAR(20),
        ppc_voltage_droop_pct VARCHAR(20),
        max_reactive_power_injection_mvar VARCHAR(30),
        max_reactive_power_absorption_mvar VARCHAR(30),
        ppc_comm_time_ms NUMERIC,
        ppc_sampling_time_ms NUMERIC,
        ppc_total_exec_time_ms VARCHAR(50),
        freq_control_mode VARCHAR(50),
        freq_deadband VARCHAR(30),
        freq_droop_pct VARCHAR(20),
        power_reduction_at_50_3hz TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("  ✓ ppc_plants table ready.\n");

    console.log('==============================================');
    console.log('Migration completed successfully!');
    console.log('You can now run: node ppcSeed.js');
    console.log('==============================================\n');

  } catch (err) {
    console.error('Migration error:', err.message);
    console.error(err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
};

main();
