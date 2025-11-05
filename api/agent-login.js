// api/agent-login.js
import pool from "../lib/db.js";

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { convKey } = req.body || {};
    if (!convKey) {
      return res.status(400).json({ error: "Missing convKey" });
    }

    const r = await pool.query(
      `SELECT conv_key, trainer_name, associate_name
       FROM conversations WHERE conv_key = $1`,
      [convKey]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "Invalid convKey" });
    }

    const row = r.rows[0];
    return res.status(200).json({
      success: true,
      convKey: row.conv_key,
      agentName: row.associate_name || "Agent",
      trainerName: row.trainer_name || null,
    });
  } catch (err) {
    console.error("Error in /api/agent-login:", err);
    return res.status(500).json({ error: err.message });
  }
}
