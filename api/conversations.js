import fs from "fs";
console.log("✅ Auth exists:", fs.existsSync("./lib/auth.js"));

export default async function handler(req, res) {
  try {
    // --- Always send CORS headers ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    // --- Lazy import (avoids startup import errors) ---
    const { verifyToken } = await import("../lib/auth.js");
    const poolModule = await import("../db.js");
    const pool = poolModule.default || poolModule.pool;

    // --- Handle POST ---
    if (req.method === "POST") {
      await verifyToken(req, res, async () => {
        const { trainerName, associateName } = req.body || {};
        const { name: creatorName } = req.user;

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
      return;
    }

    // --- Handle GET ---
    if (req.method === "GET") {
      const { convKey, all } = req.query || {};

      const result =
        all === "true"
          ? await pool.query("SELECT * FROM conversations ORDER BY start_time DESC")
          : await pool.query("SELECT * FROM conversations WHERE conv_key = $1", [
              convKey,
            ]);

      if (!result.rows.length)
        return res.status(404).json({ error: "Conversation not found" });

      return res.status(200).json(all === "true" ? result.rows : result.rows[0]);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    // 🧩 If imports fail or anything else breaks, still send CORS
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    console.error("Fatal error in /api/conversations:", err);
    return res.status(500).json({ error: err.message });
  }
}
