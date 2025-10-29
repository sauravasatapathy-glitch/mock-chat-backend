import pool from "../../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Missing Authorization header" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { name, email, role } = req.body;
    if (!name || !email || !role)
      return res.status(400).json({ error: "Missing required fields" });

    // Create temporary password (hashed)
    const tempPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(tempPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, role, hash]
    );

    // TODO: integrate email sending (next sub-step)
    console.log(
      `New user created: ${email} with temp password: ${tempPassword}`
    );

    return res.status(200).json({
      success: true,
      message: "User created successfully (check console for temp password)",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("AddUser Error:", err);
    res.status(500).json({ error: err.message });
  }
}
