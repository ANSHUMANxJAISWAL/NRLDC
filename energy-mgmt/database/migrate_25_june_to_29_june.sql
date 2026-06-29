-- Migration script to update schema from June 25th, 2026 to June 29th, 2026
-- Safe to run on already deployed/live database.

-- =============================================================
-- 1. Remove login credentials from pooling_stations
--    Pooling stations are now admin-only config entities (no login).
-- =============================================================

-- Drop the unique constraint on login_id (if it exists)
ALTER TABLE pooling_stations DROP CONSTRAINT IF EXISTS pooling_stations_login_id_key;

-- Drop the login_id and password_hash columns
ALTER TABLE pooling_stations DROP COLUMN IF EXISTS login_id;
ALTER TABLE pooling_stations DROP COLUMN IF EXISTS password_hash;

-- =============================================================
-- 2. Remove pooling_station linkage from users table
--    Standard users (role='user') represent company groups only.
--    Access is scoped via user_plant_permissions, not station ID.
-- =============================================================

-- Drop the foreign key constraint first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pooling_station_id_fkey;

-- Then drop the column
ALTER TABLE users DROP COLUMN IF EXISTS pooling_station_id;

-- =============================================================
-- 3. Add pooling_station_id FK to power_plants
--    Links a power plant directly to a pooling station.
--    The old text column pooling_station is kept for reference.
-- =============================================================
ALTER TABLE power_plants ADD COLUMN IF NOT EXISTS pooling_station_id INTEGER REFERENCES pooling_stations(id) ON DELETE SET NULL;
