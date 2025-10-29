// api/auth.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const path = req.url.split("?")[0]; // e.g. /api/auth/login

  try {
    // --- LOGIN ---
    if (path.endsWith("/login") && req.method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: "User not found" });

      const valid = await bcrypt.compare(password, user.password_hash || user.password);
      if (!valid) return res.status(401).json({ error: "Invalid password" });

      const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, {
        expiresIn: "12h",
      });

      return res.status(200).json({
        success: true,
        token,
        user: { id: user.id, name: user.name, role: user.role, email: user.email },
      });
    }

    // --- REGISTER (self register, optional) ---
    if (path.endsWith("/register") && req.method === "POST") {
      const { name, email, password, role = "trainer" } = req.body || {};
      if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

      const hashed = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,NOW())",
        [name, email, hashed, role]
      );
      return res.status(200).json({ success: true, message: "Registered" });
    }

    // --- ADD USER (admin-only) ---
    if (path.endsWith("/addUser") && req.method === "POST") {
      // NOTE: in production you must check JWT/auth and role (admin). For now, we assume caller checks token externally.
      const { name, email, role = "trainer" } = req.body || {};
      if (!name || !email) return res.status(400).json({ error: "Missing fields" });

      const tempPass = Math.random().toString(36).slice(2, 10);
      const hashed = await bcrypt.hash(tempPass, 10);
      await pool.query(
        "INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,NOW())",
        [name, email, hashed, role]
      );

      // For now we log temp pass to server logs — in prod you'd email it.
      console.log(`Temp password for user ${email}: ${tempPass}`);

      return res.status(200).json({
        success: true,
        message: "User created successfully (check console for temp password)",
      });
    }

    return res.status(404).json({ error: "Invalid auth endpoint" });
  } catch (err) {
    console.error("Error in /api/auth:", err);
    return res.status(500).json({ error: err.message });
  }
}
