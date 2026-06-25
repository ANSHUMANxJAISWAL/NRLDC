/**
 * ppcSeed.js — Seeds pooling_stations, ppc_plants, and pooling_station users.
 * Run AFTER seedRealData.js (which resets the schema and seeds power_plants).
 *
 * Usage: node ppcSeed.js
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { poolingStations, ppcPlants } = require('./ppcData');

require('dotenv').config();

const main = async () => {
  console.log('====================================================');
  console.log('Starting PPC seed (Pooling Stations + PPC Plants)...');
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
    // --- 1. Build station name → id map ---
    const stationIdMap = {};

    console.log(`\nInserting ${poolingStations.length} pooling stations...`);
    const salt = await bcrypt.genSalt(10);

    for (const station of poolingStations) {
      const passwordHash = await bcrypt.hash(station.password, salt);

      // Insert pooling station
      const stationResult = await client.query(
        `INSERT INTO pooling_stations (name, login_id, password_hash, total_capacity_mw)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET total_capacity_mw = EXCLUDED.total_capacity_mw
         RETURNING id`,
        [station.name, station.login_id, passwordHash, station.total_capacity_mw]
      );
      const stationId = stationResult.rows[0].id;
      stationIdMap[station.name] = stationId;

      console.log(`  ✓ Pooling Station: "${station.name}" → id=${stationId}`);


    }

    console.log('\nPooling stations and users seeded successfully.');

    // --- 2. Seed PPC Plants ---
    console.log(`\nInserting ${ppcPlants.length} PPC plants...`);
    let matched = 0;
    let unmatched = 0;

    for (const plant of ppcPlants) {
      const stationId = stationIdMap[plant.pooling_station_name];
      if (!stationId) {
        console.warn(`  ⚠ No station found for: "${plant.pooling_station_name}" — skipping "${plant.plant_name}"`);
        continue;
      }

      // Fuzzy name match against power_plants table
      let powerPlantId = null;
      try {
        const keyWords = plant.plant_name
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 3)
          .join(' ');

        const matchResult = await client.query(
          `SELECT id FROM power_plants WHERE name ILIKE '%' || $1 || '%' LIMIT 1`,
          [keyWords]
        );
        if (matchResult.rows.length > 0) {
          powerPlantId = matchResult.rows[0].id;
          matched++;
        } else {
          unmatched++;
        }
      } catch (matchErr) {
        console.warn(`  ⚠ Fuzzy match error for "${plant.plant_name}":`, matchErr.message);
        unmatched++;
      }

      await client.query(
        `INSERT INTO ppc_plants (
          pooling_station_id, power_plant_id, plant_name, wbes_acronym, capacity_mw,
          evacuating_line, poi, owner,
          ppc_oem, ppc_mode_of_control, ppc_reference_point, ppc_reference_voltage_kv,
          ppc_voltage_deadband_pct, ppc_voltage_droop_pct,
          max_reactive_power_injection_mvar, max_reactive_power_absorption_mvar,
          ppc_comm_time_ms, ppc_sampling_time_ms, ppc_total_exec_time_ms,
          freq_control_mode, freq_deadband, freq_droop_pct, power_reduction_at_50_3hz
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23
        )`,
        [
          stationId,
          powerPlantId,
          plant.plant_name,
          plant.wbes_acronym || null,
          plant.capacity_mw || null,
          plant.evacuating_line || null,
          plant.poi || null,
          plant.owner || null,
          plant.ppc_oem || null,
          plant.ppc_mode_of_control || null,
          plant.ppc_reference_point || null,
          plant.ppc_reference_voltage_kv || null,
          plant.ppc_voltage_deadband_pct || null,
          plant.ppc_voltage_droop_pct || null,
          plant.max_reactive_power_injection_mvar || null,
          plant.max_reactive_power_absorption_mvar || null,
          plant.ppc_comm_time_ms || null,
          plant.ppc_sampling_time_ms || null,
          plant.ppc_total_exec_time_ms || null,
          plant.freq_control_mode || null,
          plant.freq_deadband || null,
          plant.freq_droop_pct || null,
          plant.power_reduction_at_50_3hz || null,
        ]
      );

      const matchLabel = powerPlantId ? `→ power_plant #${powerPlantId}` : '→ no match';
      console.log(`  ✓ "${plant.plant_name}" [${plant.pooling_station_name}] ${matchLabel}`);
    }

    console.log('\n====================================================');
    console.log(`PPC seeding complete!`);
    console.log(`  Plants inserted : ${ppcPlants.length}`);
    console.log(`  Matched to DB   : ${matched}`);
    console.log(`  Unmatched (null): ${unmatched}`);
    console.log('====================================================');

    // Print login credentials summary
    console.log('\n--- Pooling Station Login Credentials ---');
    for (const station of poolingStations) {
      console.log(`  ${station.login_id}  |  Password: ${station.password}`);
    }
    console.log('-----------------------------------------\n');

  } catch (err) {
    console.error('Error during PPC seeding:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
};

main();
