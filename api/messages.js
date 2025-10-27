import pool from '../db.js';

export default async function handler(req, res) {
    // ✅ Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ... your existing logic here (creating conversation, etc)
  } catch (err) {
    console.error("Error in /api/conversation:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
  try {
    if (req.method === 'POST') {
      const { convKey, senderName, senderRole, message } = req.body;
      if (!convKey || !senderName || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

    await pool.query(
      `INSERT INTO messages (conv_key, sender_name, role, text, timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [convKey, senderName, senderRole, message]
    );

      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
      const { convKey } = req.query;
      const result = await pool.query(
        'SELECT * FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC',
        [convKey]
      );

      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/messages:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
