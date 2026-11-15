require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(url);

module.exports = new Pool({
  connectionString: url,
  ssl: url && !isLocal ? { rejectUnauthorized: false } : false,
});
