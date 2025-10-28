import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { email, password } = req.body;
    console.log("Incoming login:", email);

    if (!email || !password)
      return res.status(400).json({ error: "Missing credentials" });

    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    console.log("Query successful, result:", result.rows);

    if (!result.rows.length) return res.status(401).json({ error: "User not found" });

    const user = result.rows[0];
    console.log("User found:", user);

    const valid = await bcrypt.compare(password, user.password_hash);
    console.log("Password valid?", valid);

    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, role: user.role, email: user.email },
    });
  } catch (err) {
    console.error("Login Error:", err.stack);
    res.status(500).json({ error: err.message });
  }
}
