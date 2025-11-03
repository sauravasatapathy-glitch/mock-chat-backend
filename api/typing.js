// api/typing.js
import pool from "../lib/db.js";

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      const { convKey, userName, role, typing } = req.body || {};
      if (!convKey || !userName) return res.status(400).json({ error: "Missing fields" });

      if (typing) {
        // upsert: update updated_at or insert
        await pool.query(
          `INSERT INTO typing_state (conv_key, user_name, role, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (conv_key, user_name) DO UPDATE SET updated_at = NOW(), role = EXCLUDED.role`,
          [convKey, userName, role]
        );
      } else {
        // stop typing: delete row
        await pool.query(
          `DELETE FROM typing_state WHERE conv_key = $1 AND user_name = $2`,
          [convKey, userName]
        );
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/typing:", err);
    return res.status(500).json({ error: err.message });
  }
}
