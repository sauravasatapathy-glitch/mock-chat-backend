// api/users.js
import { Resend } from "resend";
import pool from "../lib/db.js";
import { verifyToken } from "../lib/auth.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = "https://mockchat.vercel.app"; // Your frontend base URL
const ALLOWED_ORIGIN = APP_URL;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ✅ Route 1: Admin creates user and sends invite
    if (req.method === "POST") {
      return verifyToken(req, res, async () => {
        const { name, email, role } = req.body || {};
        const inviter = req.user?.name;
        const inviterRole = req.user?.role;

        if (inviterRole !== "admin") {
          return res.status(403).json({ error: "Only admins can add users" });
        }

        if (!name || !email || !role) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        // Generate one-time token valid for 24 hours
        const token = crypto.randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

        // Insert or update user
        await pool.query(
          `INSERT INTO users (name, email, role, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (email) DO NOTHING`,
          [name, email, role]
        );

        // Store or update token
        await pool.query(
          `INSERT INTO password_reset_tokens (email, token, expires_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
          [email, token, expiresAt]
        );

        const inviteLink = `${APP_URL}/set-password.html?token=${token}`;

        // Send email invite
        await resend.emails.send({
          from: "MockChat <noreply@mockchat.app>",
          to: email,
          subject: "Welcome to MockChat – Set up your account",
          html: `
            <div style="font-family:Inter,Arial,sans-serif;padding:20px;">
              <h2>Welcome to MockChat!</h2>
              <p>Hello ${name},</p>
              <p>You’ve been invited by <b>${inviter}</b> to join MockChat as a <b>${role}</b>.</p>
              <p>Click below to set your password and get started:</p>
              <p><a href="${inviteLink}" style="background:#7c3aed;color:#fff;padding:10px 20px;text-decoration:none;border-radius:8px;">Set Password</a></p>
              <p>This link will expire in 24 hours.</p>
              <p>— MockChat Team</p>
            </div>
          `,
        });

        return res.status(200).json({ success: true, message: "User invited successfully" });
      });
    }

    // ✅ Route 2: User sets password (called from set-password.html)
    if (req.method === "PATCH") {
      const { token, password } = req.body || {};

      if (!token || !password) {
        return res.status(400).json({ error: "Missing token or password" });
      }

      // Verify token validity
      const { rows } = await pool.query(
        `SELECT email FROM password_reset_tokens
         WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );

      if (!rows.length) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const email = rows[0].email;
      const hash = await bcrypt.hash(password, 10);

      // Update password & clear token
      await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2`, [hash, email]);
      await pool.query(`DELETE FROM password_reset_tokens WHERE email = $1`, [email]);

      return res.status(200).json({ success: true, message: "Password set successfully" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/users:", err);
    res.status(500).json({ error: err.message });
  }
}
