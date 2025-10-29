// api/conversations.js
import pool from "../db.js";

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = req.url.split("?")[0];

  try {
    // Create conversation: POST /api/conversations/create
    if (path.endsWith("/create") && req.method === "POST") {
      const { trainerName, associateName, createdBy } = req.body || {};
      if (!trainerName || !associateName) return res.status(400).json({ error: "Missing fields" });

      const convKey = Math.random().toString(36).substring(2, 8).toUpperCase();
      const q =
        "INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended, created_by) VALUES ($1,$2,$3,NOW(),FALSE,$4) RETURNING *";
      const r = await pool.query(q, [convKey, trainerName, associateName, createdBy || null]);

      return res.status(200).json({ success: true, convKey, conversation: r.rows[0] });
    }

    // Get conversation by key: GET /api/conversations/get?convKey=XXX
    if (path.endsWith("/get") && req.method === "GET") {
      const { convKey } = req.query || {};
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });
      const r = await pool.query("SELECT * FROM conversations WHERE conv_key = $1", [convKey]);
      if (r.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
      return res.status(200).json(r.rows[0]);
    }

    // Active conversations (optionally by owner): GET /api/conversations/active?createdBy=abc
    if (path.endsWith("/active") && req.method === "GET") {
      const { createdBy } = req.query || {};
      let r;
      if (createdBy) {
        r = await pool.query("SELECT * FROM conversations WHERE ended = FALSE AND created_by = $1 ORDER BY start_time DESC", [createdBy]);
      } else {
        r = await pool.query("SELECT * FROM conversations WHERE ended = FALSE ORDER BY start_time DESC");
      }
      return res.status(200).json(r.rows);
    }

    // End conversation: POST /api/conversations/end
    if (path.endsWith("/end") && req.method === "POST") {
      const { convKey } = req.body || {};
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });
      await pool.query("UPDATE conversations SET ended = TRUE, end_time = NOW() WHERE conv_key = $1", [convKey]);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "Invalid conversations endpoint" });
  } catch (err) {
    console.error("Error in /api/conversations:", err);
    return res.status(500).json({ error: err.message });
  }
}
