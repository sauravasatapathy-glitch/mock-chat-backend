// api/messages.js
import pool from "../lib/db.js";

const ALLOWED_ORIGIN = "https://mockchat.vercel.app"; // <<-- update to your frontend origin

export default async function handler(req, res) {
  try {
    // CORS for regular requests
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(200).end();

    // -------------------
    // POST: Insert message
    // -------------------
    if (req.method === "POST") {
      const { convKey, senderName, senderRole, text, attachment } = req.body || {};
      if (!convKey || !senderName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await pool.query(
        `INSERT INTO messages (conv_key, sender_name, role, text, attachment_url, timestamp)
         VALUES ($1,$2,$3,$4,$5,NOW())
         RETURNING id, conv_key, sender_name, role, text, attachment_url AS attachment, timestamp`,
        [convKey, senderName, senderRole || "associate", text, attachment || null]
      );

      // return the inserted row so client can render immediately with id
      return res.status(200).json(result.rows[0]);
    }

    // ------------------------------
    // GET: JSON fetch OR SSE stream
    // ------------------------------
    if (req.method === "GET") {
      const { convKey } = req.query || {};
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });

      const accept = req.headers.accept || "";
      const isSSE = accept.includes("text/event-stream");

      // Normal JSON fetch
      if (!isSSE) {
        const r = await pool.query(
          `SELECT id, conv_key, sender_name, role, text, attachment_url AS attachment, timestamp
           FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC`,
          [convKey]
        );
        return res.status(200).json(r.rows);
      }

      // SSE mode
      // Set correct headers for EventSource
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN
      });

      const sendEvent = (payload) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      // initial load
      const initial = await pool.query(
        `SELECT id, conv_key, sender_name, role, text, attachment_url AS attachment, timestamp
         FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC`,
        [convKey]
      );
      sendEvent({ type: "init", messages: initial.rows });

      // track last id sent
      let lastId = initial.rows.length ? initial.rows[initial.rows.length - 1].id : 0;

      // polling loop: messages + typing_state
      const interval = setInterval(async () => {
        try {
          // new messages
          const r = await pool.query(
            `SELECT id, conv_key, sender_name, role, text, attachment_url AS attachment, timestamp
             FROM messages WHERE conv_key = $1 AND id > $2 ORDER BY id ASC`,
            [convKey, lastId]
          );
          if (r.rows.length > 0) {
            lastId = r.rows[r.rows.length - 1].id;
            sendEvent({ type: "new", messages: r.rows });
          }

          // typing states (recent)
          const t = await pool.query(
            `SELECT user_name, role, updated_at
             FROM typing_state
             WHERE conv_key = $1 AND updated_at > NOW() - INTERVAL '6 seconds'`,
            [convKey]
          );
          if (t.rows.length > 0) {
            sendEvent({ type: "typing", typing: t.rows });
          }
        } catch (err) {
          console.error("SSE polling error:", err);
        }
      }, 1500); // 1.5s

      req.on("close", () => {
        clearInterval(interval);
        res.end();
      });

      return;
    }

    // Method not allowed
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Error in /api/messages:", err);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    res.end();
  }
}
