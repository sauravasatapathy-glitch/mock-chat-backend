// /api/store.js
const pool = require('../db.js');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await pool.query('SELECT * FROM conversations ORDER BY updated_at DESC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { title } = req.body;
      const result = await pool.query(
        'INSERT INTO conversations (title) VALUES ($1) RETURNING *',
        [title]
      );
      res.status(201).json(result.rows[0]);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: err.message });
  }
}
