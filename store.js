import pool from './db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { trainerName, associateName } = req.body;
      if (!trainerName || !associateName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const convKey = Math.random().toString(36).substring(2, 8).toUpperCase();

      await pool.query(
        `INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended)
         VALUES ($1, $2, $3, NOW(), false)`,
        [convKey, trainerName, associateName]
      );

      return res.status(200).json({ convKey });
    }

    if (req.method === 'GET') {
      const { convKey } = req.query;
      const result = await pool.query(
        'SELECT * FROM conversations WHERE conv_key = $1',
        [convKey]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      return res.status(200).json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/store:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
