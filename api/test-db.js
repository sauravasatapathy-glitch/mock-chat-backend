import pkg from 'pg';
const { Client } = pkg;

export default async function handler(req, res) {
  try {
    const client = new Client({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    const result = await client.query('SELECT NOW() AS time');
    await client.end();

    return res.status(200).json({
      success: true,
      message: 'Connected successfully to Supabase!',
      db_time: result.rows[0].time,
    });
  } catch (err) {
    console.error('Database connection failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
