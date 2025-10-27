import pool from '../../db.js';

export default async function handler(req, res) {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error('DB connection error:', err);
    res.status(500).json({ error: err.message });
  }
}
