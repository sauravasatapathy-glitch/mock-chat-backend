// api/allConversations.js
import pool from '../db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM conversations ORDER BY start_time DESC'
      );
      return res.status(200).json(result.rows);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/allConversations:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
