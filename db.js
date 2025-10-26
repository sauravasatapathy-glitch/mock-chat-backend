// db.js
import pkg from 'pg';
const { Pool } = pkg;

// Pool handles concurrent requests efficiently
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
