// api/conversations.js
import pool from "../lib/db.js";
import { verifyToken } from "../lib/auth.js"; // assumes lib/auth.js exports verifyToken

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // POST: create conversation (already required verifyToken previously, keep that)
    if (req.method === "POST") {
      await verifyToken(req, res, async () => {
        const { trainerName, associateName } = req.body || {};
        const { name: creatorName } = req.user || {};

        if (!trainerName || !associateName) return res.status(400).json({ error: "Missing required fields" });

        const convKey = Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await pool.query(
          `INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended, created_by)
           VALUES ($1, $2, $3, NOW(), false, $4) RETURNING *`,
          [convKey, trainerName, associateName, creatorName]
        );

        return res.status(200).json({ success: true, convKey, conversation: result.rows[0] });
      });
      return;
    }

    // GET
    if (req.method === "GET") {
      const { convKey, all } = req.query || {};

      // If all=true, return all conversations BUT we want unread_count for the requesting user.
      if (all === "true") {
        // require auth to compute unread_count per user
        return await verifyToken(req, res, async () => {
          const userName = req.user?.name || "";

          // Query: conversations + unread_count for this user
          const q = `
            SELECT c.*,
              COALESCE((
                SELECT COUNT(*) FROM messages m
                LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_name = $2
                WHERE m.conv_key = c.conv_key AND mr.message_id IS NULL
              ), 0)::int AS unread_count
            FROM conversations c
            ORDER BY c.start_time DESC
          `;

          const r = await pool.query(q, ["", userName]); // first param placeholder not used
          return res.status(200).json(r.rows);
        });
      }

      // Otherwise fetch single conversation by key (no unread_count here)
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });
      const r2 = await pool.query("SELECT * FROM conversations WHERE conv_key = $1", [convKey]);
      if (r2.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
      return res.status(200).json(r2.rows[0]);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/conversations:", err);
    return res.status(500).json({ error: err.message });
  }
}
