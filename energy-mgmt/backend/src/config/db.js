const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });
} else {
  pool = new Pool({
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? process.env.DB_PASSWORD ?? 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'energy_db',
    ssl: false,
  });
}

pool.on('connect', () => {
  console.log('Connected successfully to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
