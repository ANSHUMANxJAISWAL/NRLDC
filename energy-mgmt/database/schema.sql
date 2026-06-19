-- Drop tables and types if they exist for clean initialization
DROP TABLE IF EXISTS user_plant_permissions CASCADE;
DROP TABLE IF EXISTS inverters CASCADE;
DROP TABLE IF EXISTS ppc_plants CASCADE;
DROP TABLE IF EXISTS power_plants CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS pooling_stations CASCADE;

DROP TYPE IF EXISTS inverter_status CASCADE;
DROP TYPE IF EXISTS plant_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create Enum Types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE plant_status AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE inverter_status AS ENUM ('online', 'offline', 'fault', 'maintenance');

-- Pooling Stations table (220kV/400kV grid substations)
CREATE TABLE pooling_stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  login_id VARCHAR(100) NOT NULL UNIQUE,        -- e.g. bikanerpg@energymgmt
  password_hash TEXT NOT NULL,
  total_capacity_mw NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    pooling_station_id INT REFERENCES pooling_stations(id) ON DELETE SET NULL,
    two_factor_code VARCHAR(6),
    two_factor_expires TIMESTAMP WITH TIME ZONE,
    reset_code VARCHAR(6),
    reset_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Power Plants table
CREATE TABLE power_plants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(100),
    company_group VARCHAR(100),
    pooling_station VARCHAR(255),
    capacity_mw NUMERIC(10, 3) NOT NULL,
    commissioned_date DATE, -- Nullable to handle missing dates in real data
    status plant_status DEFAULT 'active' NOT NULL,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Inverters (Inverter Groups) table
CREATE TABLE inverters (
    id SERIAL PRIMARY KEY,
    plant_id INTEGER REFERENCES power_plants(id) ON DELETE CASCADE NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    rating_mva NUMERIC(10, 3),
    capacity_mw NUMERIC(10, 4) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    total_capacity_mw NUMERIC(10, 3) NOT NULL,
    pooling_station VARCHAR(255),
    owner VARCHAR(100),
    status inverter_status DEFAULT 'online' NOT NULL,
    efficiency_percent NUMERIC(5, 2) CHECK (efficiency_percent >= 0 AND efficiency_percent <= 100), -- Nullable
    last_maintenance_date DATE,
    lvrt JSONB, -- Low Voltage Ride Through settings
    hvrt JSONB, -- High Voltage Ride Through settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- PPC Plants table (Power Plant Controllers — one per RE plant)
CREATE TABLE ppc_plants (
  id SERIAL PRIMARY KEY,
  pooling_station_id INT REFERENCES pooling_stations(id) ON DELETE CASCADE,
  power_plant_id INT REFERENCES power_plants(id) ON DELETE SET NULL,  -- nullable FK to existing plants
  plant_name VARCHAR(200) NOT NULL,
  wbes_acronym VARCHAR(50),
  capacity_mw NUMERIC,
  evacuating_line TEXT,
  poi TEXT,
  owner VARCHAR(100),

  -- PPC technical fields
  ppc_oem VARCHAR(100),
  ppc_mode_of_control VARCHAR(50),             -- 'Q(V) Mode' | 'V-Mode' | null
  ppc_reference_point TEXT,
  ppc_reference_voltage_kv VARCHAR(20),
  ppc_voltage_deadband_pct VARCHAR(20),
  ppc_voltage_droop_pct VARCHAR(20),
  max_reactive_power_injection_mvar VARCHAR(30),
  max_reactive_power_absorption_mvar VARCHAR(30),
  ppc_comm_time_ms NUMERIC,
  ppc_sampling_time_ms NUMERIC,
  ppc_total_exec_time_ms VARCHAR(50),

  -- Frequency control
  freq_control_mode VARCHAR(50),
  freq_deadband VARCHAR(30),
  freq_droop_pct VARCHAR(20),
  power_reduction_at_50_3hz TEXT,

  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Plant Permissions table
CREATE TABLE user_plant_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    plant_id INTEGER REFERENCES power_plants(id) ON DELETE CASCADE NOT NULL,
    can_read BOOLEAN DEFAULT TRUE NOT NULL,
    can_write BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, plant_id)
);

-- System Logs table for settings updates
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
