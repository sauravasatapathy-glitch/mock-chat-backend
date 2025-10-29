import pool from "../db.js";
import { verifyToken, requireRole } from "../lib/auth.js";

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      await verifyToken(req, res, async () => {
        const { trainerName, associateName } = req.body;
        const { name: creatorName } = req.user; // extracted from token

        if (!trainerName || !associateName)
          return res.status(400).json({ error: "Missing required fields" });

        const convKey = Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await pool.query(
          `INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended, created_by)
           VALUES ($1, $2, $3, NOW(), false, $4)
           RETURNING *`,
          [convKey, trainerName, associateName, creatorName]
        );

        return res.status(200).json({
          success: true,
          convKey,
          conversation: result.rows[0],
        });
      });
    }

    else if (req.method === "GET") {
      const { convKey, all } = req.query;

      // ✅ If “all” flag passed, return all conversations (merged route)
      if (all === "true") {
        const result = await pool.query(
          "SELECT * FROM conversations ORDER BY start_time DESC"
        );
        return res.status(200).json(result.rows);
      }

      // ✅ Otherwise fetch a single conversation by key
      const result = await pool.query(
        "SELECT * FROM conversations WHERE conv_key = $1",
        [convKey]
      );

      if (result.rows.length === 0)
        return res.status(404).json({ error: "Conversation not found" });

      return res.status(200).json(result.rows[0]);
    }

    else {
      res.status(405).json({ error: "Method not allowed" });
    }

  } catch (err) {
    console.error("Error in /api/conversations:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
}
