// api/reports.js
import pool from "../lib/db.js";
import { verifyToken } from "../lib/auth.js";
import { Parser } from "json2csv";

const ALLOWED_ORIGIN = "https://mockchat.vercel.app";

export default async function handler(req, res) {
  // --- ✅ Always send CORS headers (even for OPTIONS)
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- ✅ Handle OPTIONS preflight immediately with HTTP 200
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  // --- ✅ Restrict to GET only
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    return verifyToken(req, res, async () => {
      const { from, to } = req.query || {};
      if (!from || !to) {
        return res.status(400).json({ error: "Missing 'from' or 'to' parameters" });
      }

      const role = req.user?.role || "";
      const trainerName = req.user?.name || "";

      // --- ✅ Main query with both duration columns
      const q = `
        SELECT
          c.trainer_name AS "Trainer",
          c.associate_name AS "Agent",
          TO_CHAR(c.start_time, 'YYYY-MM-DD HH24:MI:SS') AS "Start Time",
          TO_CHAR(c.end_time, 'YYYY-MM-DD HH24:MI:SS') AS "End Time",
          TO_CHAR((COALESCE(c.end_time, NOW()) - c.start_time), 'HH24:MI:SS') AS "Duration (HH:MM:SS)",
          EXTRACT(EPOCH FROM (COALESCE(c.end_time, NOW()) - c.start_time))::INT AS "Duration (seconds)",
          COUNT(m.id) AS "Message Count"
        FROM conversations c
        LEFT JOIN messages m ON m.conv_key = c.conv_key
        WHERE c.start_time BETWEEN $1 AND $2
        ${role === "admin" ? "" : "AND c.trainer_name = $3"}
        GROUP BY c.trainer_name, c.associate_name, c.start_time, c.end_time
        ORDER BY c.start_time DESC;
      `;

      const params = role === "admin" ? [from, to] : [from, to, trainerName];
      const result = await pool.query(q, params);
      const rows = result.rows || [];

      if (!rows.length) {
        return res.status(200).json({ message: "No data found for given range." });
      }

      // --- ✅ Convert JSON to CSV
      const parser = new Parser();
      const csv = parser.parse(rows);

      // --- ✅ Send CSV file
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=MockChat_Report_${Date.now()}.csv`);
      return res.status(200).send(csv);
    });
  } catch (err) {
    console.error("Error in /api/reports:", err);
    return res.status(500).json({ error: err.message });
  }
}
