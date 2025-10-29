import pool from "../db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export default async function handler(req, res) {
  // ✅ Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      // ✅ 1. Authenticate user
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid token" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      if (!decoded || (decoded.role !== "trainer" && decoded.role !== "admin")) {
        return res.status(403).json({ error: "Access denied" });
      }

      // ✅ 2. Validate body
      const { associateName } = req.body;
      if (!associateName)
        return res.status(400).json({ error: "Missing associate name" });

      // ✅ 3. Create conversation
      const convKey = Math.random().toString(36).substring(2, 8).toUpperCase();

      const result = await pool.query(
        `INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended)
         VALUES ($1, $2, $3, NOW(), false)
         RETURNING *`,
        [convKey, decoded.name, associateName]
      );

      return res.status(201).json({
        success: true,
        convKey,
        conversation: result.rows[0],
      });
    }

    if (req.method === "GET") {
      const { convKey } = req.query;
      const result = await pool.query(
        "SELECT * FROM conversations WHERE conv_key = $1",
        [convKey]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ error: "Conversation not found" });

      return res.status(200).json(result.rows[0]);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/conversation:", err.message);
    res.status(500).json({ error: err.message });
  }
}
