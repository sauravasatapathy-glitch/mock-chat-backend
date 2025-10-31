import pool from "./db.js";

export default async function handler(req, res) {
  // === CORS ===
  const allowedOrigin = "https://mockchat.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // === POST: Add new message ===
    if (req.method === "POST") {
      const { convKey, senderName, senderRole, text } = req.body || {};

      if (!convKey || !senderName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await pool.query(
        `INSERT INTO messages (conv_key, sender_name, role, text, timestamp)
         VALUES ($1, $2, $3, $4, NOW())`,
        [convKey, senderName, senderRole || "agent", text]
      );

      return res.status(200).json({ success: true });
    }

    // === GET: Fetch messages for a conversation ===
    if (req.method === "GET") {
      const { convKey } = req.query || {};

      if (!convKey) {
        return res.status(400).json({ error: "Missing convKey" });
      }

      const result = await pool.query(
        `SELECT id, conv_key, sender_name, role, text, timestamp
         FROM messages
         WHERE conv_key = $1
         ORDER BY timestamp ASC`,
        [convKey]
      );

      return res.status(200).json(result.rows);
    }

    // === Invalid method ===
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("💥 Error in /api/messages:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
