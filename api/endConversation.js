import db from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { convKey } = req.body;

  if (!convKey) {
    return res.status(400).json({ error: 'convKey is required' });
  }

  try {
    // Update the conversation using your actual column names
    const result = await db.query(
      'UPDATE conversations SET ended = TRUE, end_time = NOW() WHERE conv_key = $1 RETURNING *',
      [convKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.status(200).json({
      message: 'Conversation ended successfully',
      conversation: result.rows[0],
    });
  } catch (err) {
    console.error('Error ending conversation:', err.message);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
