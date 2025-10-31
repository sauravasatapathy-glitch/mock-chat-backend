import pool from "../lib/db.js";

export default async function handler(req, res) {
  // === Strict CORS for frontend ===
  res.setHeader("Access-Control-Allow-Origin", "https://mockchat.vercel.app");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // === POST: Save a new message ===
    if (req.method === "POST") {
      const { convKey, senderName, senderRole, text } = req.body || {};

      if (!convKey || !senderName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const insertQuery = `
        INSERT INTO messages (conv_key, sender_name, role, text, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, conv_key, sender_name, role, text, timestamp
      `;

      const result = await pool.query(insertQuery, [
        convKey,
        senderName,
        senderRole || "unknown",
        text,
      ]);

      // Return full message for instant rendering (optional)
      return res.status(200).json(result.rows[0]);
    }

    // === GET: Fetch all messages for a conversation ===
    if (req.method === "GET") {
      const { convKey } = req.query || {};
      if (!convKey) {
        return res.status(400).json({ error: "Missing convKey" });
      }

      const result = await pool.query(
        "SELECT * FROM messages WHERE conv_key = $1 ORDER BY id ASC",
        [convKey]
      );

      // Normalize timestamps for frontend
      const messages = result.rows.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : null,
      }));

      return res.status(200).json(messages);
    }

    // === Fallback ===
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("💥 Error in /api/messages:", err);
    return res.status(500).json({ error: err.message });
  }
}
