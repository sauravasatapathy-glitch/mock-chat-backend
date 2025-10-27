import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    return res.status(200).json({
      status: 'ok',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('DB connection error:', err);
    return res.status(500).json({ error: err.message });
  }
}
