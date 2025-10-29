import pool from "../db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing or invalid token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || (decoded.role !== "trainer" && decoded.role !== "admin"))
      return res.status(403).json({ error: "Access denied" });

    const result = await pool.query(
      `SELECT * FROM conversations ORDER BY start_time DESC LIMIT 20`
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error in /api/conversations:", err.message);
    res.status(500).json({ error: err.message });
  }
}
