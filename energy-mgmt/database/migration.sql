-- Combined migration script from June 23rd, 2026 to June 30th, 2026
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

-- 7. Remove login credentials from pooling_stations
-- Drop the unique constraint on login_id (if it exists)
ALTER TABLE pooling_stations DROP CONSTRAINT IF EXISTS pooling_stations_login_id_key;

-- Drop the login_id and password_hash columns
ALTER TABLE pooling_stations DROP COLUMN IF EXISTS login_id;
ALTER TABLE pooling_stations DROP COLUMN IF EXISTS password_hash;

-- 8. Remove pooling_station linkage from users table
-- Drop the foreign key constraint first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pooling_station_id_fkey;

-- Then drop the column
ALTER TABLE users DROP COLUMN IF EXISTS pooling_station_id;

-- 9. Add pooling_station_id FK to power_plants
ALTER TABLE power_plants ADD COLUMN IF NOT EXISTS pooling_station_id INTEGER REFERENCES pooling_stations(id) ON DELETE SET NULL;

-- 10. Add Connection Type, Region, and State options to power_plants
ALTER TABLE power_plants ADD COLUMN IF NOT EXISTS connection_type VARCHAR(50);
ALTER TABLE power_plants ADD COLUMN IF NOT EXISTS region VARCHAR(50);
ALTER TABLE power_plants ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- 11. Remove Efficiency % and Last Maintenance Date from inverters
ALTER TABLE inverters DROP COLUMN IF EXISTS efficiency_percent;
ALTER TABLE inverters DROP COLUMN IF EXISTS last_maintenance_date;

-- 12. Add Kp and Ti parameters to ppc_plants table
ALTER TABLE ppc_plants ADD COLUMN IF NOT EXISTS kp NUMERIC;
ALTER TABLE ppc_plants ADD COLUMN IF NOT EXISTS ti NUMERIC;
