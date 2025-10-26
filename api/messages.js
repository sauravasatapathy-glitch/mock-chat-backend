// /api/messages.js
const pool = require('../db.js');

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { conversationId } = req.query;
      const result = await pool.query(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
        [conversationId]
      );
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const { conversationId, sender, content } = req.body;
      const result = await pool.query(
        'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3) RETURNING *',
        [conversationId, sender, content]
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
