// api/markRead.js
import pool from "../lib/db.js";
const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { convKey, userName } = req.body || {};
    if (!convKey || !userName) return res.status(400).json({ error: "Missing fields" });

    // insert read rows for any messages not yet marked read by this user
    await pool.query(
      `INSERT INTO message_reads (message_id, user_name, read_at)
       SELECT m.id, $2, NOW()
       FROM messages m
       LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_name = $2
       WHERE m.conv_key = $1 AND mr.id IS NULL`,
      [convKey, userName]
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in /api/markRead:", err);
    return res.status(500).json({ error: err.message });
  }
}
