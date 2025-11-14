// api/users.js
let pool;
let verifyToken;
let Resend;
let bcrypt;

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  // ✅ Always return CORS headers
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ✅ Preflight request (for CORS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Dynamic imports (Edge-compatible)
  try {
    const { default: p } = await import("../lib/db.js");
    const { verifyToken: vt } = await import("../lib/auth.js");
    const { Resend: ResendClass } = await import("resend");
    const bcryptModule = await import("bcryptjs");

    pool = p;
    verifyToken = vt;
    Resend = new ResendClass(process.env.RESEND_API_KEY);
    bcrypt = bcryptModule.default || bcryptModule;
  } catch (err) {
    console.error("Module import error:", err);
    return res.status(500).json({ error: "Internal import error: " + err.message });
  }

  // ✅ Handle routes
  try {
    // --- (1) Admin: GET list of users ---
    if (req.method === "GET") {
      return verifyToken(req, res, async () => {
        const role = req.user?.role || "";
        if (role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const q = `
          SELECT id, name, email, role, created_at
          FROM users
          ORDER BY created_at DESC
        `;
        const r = await pool.query(q);
        return res.status(200).json(r.rows);
      });
    }

    // --- (2) Admin: Invite new user ---
    if (req.method === "POST" && !req.query.setPassword) {
      return verifyToken(req, res, async () => {
        const adminRole = req.user?.role || "";
        if (adminRole !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const { name, email, role: newRole } = req.body || {};
        if (!name || !email || !newRole) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const existing = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
        if (existing.rowCount > 0) {
          return res.status(400).json({ error: "User already exists" });
        }

        const insert = await pool.query(
          `INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id`,
          [name, email, newRole]
        );

        // Send invitation email
        const setPasswordUrl = `https://mockchat.vercel.app/set-password.html?email=${encodeURIComponent(email)}`;
        await Resend.emails.send({
          from: "MockChat <no-reply@mockchat.app>",
          to: email,
          subject: "Welcome to MockChat - Set Your Password",
          html: `
            <p>Hello ${name},</p>
            <p>You’ve been invited to join <strong>MockChat</strong> as a <strong>${newRole}</strong>.</p>
            <p>Please set your password using the link below:</p>
            <p><a href="${setPasswordUrl}" target="_blank" style="color:#6D28D9;">Set Your Password</a></p>
            <p>If you did not expect this email, please ignore it.</p>
            <p>— MockChat Team</p>
          `,
        });

        return res.status(200).json({ success: true, message: "Invite email sent successfully" });
      });
    }

    // --- (3) User: Set Password ---
    if (req.method === "POST" && req.query.setPassword === "true") {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      const hash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id`,
        [hash, email]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({ success: true, message: "Password set successfully" });
    }

    // --- Default ---
    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("Error in /api/users:", err);
    return res.status(500).json({ error: err.message });
  }
}
