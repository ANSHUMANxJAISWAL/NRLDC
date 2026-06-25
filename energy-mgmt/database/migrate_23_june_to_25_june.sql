-- Migration script to update schema from June 23rd, 2026 to June 25th, 2026
-- Safe to run on already deployed/live database.

-- 1. Drop status column from power_plants table
ALTER TABLE power_plants DROP COLUMN IF EXISTS status;

-- 2. Drop status column from inverters table
ALTER TABLE inverters DROP COLUMN IF EXISTS status;

-- 3. Add history column to inverters table
ALTER TABLE inverters ADD COLUMN IF NOT EXISTS history JSONB;

-- 4. Drop status column from ppc_plants table
ALTER TABLE ppc_plants DROP COLUMN IF EXISTS status;

-- 5. Drop enum type plant_status if it exists
DROP TYPE IF EXISTS plant_status;

-- 6. Drop enum type inverter_status if it exists
DROP TYPE IF EXISTS inverter_status;
