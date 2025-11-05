// api/messageRead.js
import pool from "../lib/db.js";

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { convKey } = req.body || {};
    // extract user from Authorization header (token) if provided
    const authHeader = req.headers.authorization || "";
    // If token-based auth is used, decode it server-side (if you have verifyToken middleware, better).
    // For simplicity we will accept userName in body if not using token decoding here:
    const userName = (req.body && req.body.userName) || null;

    if (!convKey || !userName) {
      return res.status(400).json({ error: "Missing convKey or userName" });
    }

    // Insert reads for all messages in convKey which are not yet marked read by this user
    // Uses INSERT .. SELECT .. ON CONFLICT DO NOTHING (requires message_reads unique constraint (message_id, user_name) which you indicated exists)
    const q = `
      INSERT INTO message_reads (message_id, user_name, read_at)
      SELECT m.id, $2, NOW()
      FROM messages m
      WHERE m.conv_key = $1
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_name = $2
        )
      RETURNING message_id
    `;

    const r = await pool.query(q, [convKey, userName]);
    return res.status(200).json({ success: true, marked: r.rowCount });
  } catch (err) {
    console.error("Error in /api/messageRead:", err);
    return res.status(500).json({ error: err.message });
  }
}
