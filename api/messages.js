import pool from "../lib/db.js";

export default async function handler(req, res) {
  try {
    // ✅ Allow frontend requests
    const allowedOrigin = "https://mockchat.vercel.app";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    // ==============================================================
    // 🟢 POST — Send a new message
    // ==============================================================
    if (req.method === "POST") {
      const { convKey, senderName, senderRole, text } = req.body || {};

      if (!convKey || !senderName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // ✅ Insert and return full inserted message (includes id + timestamp)
      const result = await pool.query(
        `INSERT INTO messages (conv_key, sender_name, sender_role, text, timestamp)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, conv_key, sender_name, sender_role, text, timestamp`,
        [convKey, senderName, senderRole, text]
      );

      // ✅ Return the inserted message (used to prevent duplicate rendering)
      return res.status(200).json(result.rows[0]);
    }

    // ==============================================================
    // 🟡 GET — Either Normal fetch OR SSE (real-time)
    // ==============================================================
    if (req.method === "GET") {
      const { convKey } = req.query || {};
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });

      // 👇 Check if client requested SSE stream
      const acceptHeader = req.headers.accept || "";
      const isSSE = acceptHeader.includes("text/event-stream");

      // ==========================================================
      // 🔹 Normal GET (used by loadMessages)
      // ==========================================================
      if (!isSSE) {
        const result = await pool.query(
          `SELECT id, conv_key, sender_name, sender_role, text, timestamp
           FROM messages
           WHERE conv_key = $1
           ORDER BY timestamp ASC`,
          [convKey]
        );

        return res.status(200).json(result.rows);
      }

      // ==========================================================
      // 🔹 SSE Mode — Continuous message stream
      // ==========================================================
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // === Initial load ===
      const initial = await pool.query(
        `SELECT id, conv_key, sender_name, sender_role, text, timestamp
         FROM messages
         WHERE conv_key = $1
         ORDER BY timestamp ASC`,
        [convKey]
      );
      sendEvent({ type: "init", messages: initial.rows });

      let lastCount = initial.rows.length;

      // === Poll DB every 2 seconds for new messages ===
      const interval = setInterval(async () => {
        try {
          const result = await pool.query(
            `SELECT id, conv_key, sender_name, sender_role, text, timestamp
             FROM messages
             WHERE conv_key = $1
             ORDER BY timestamp ASC`,
            [convKey]
          );

          if (result.rows.length > lastCount) {
            const newMessages = result.rows.slice(lastCount);
            lastCount = result.rows.length;
            sendEvent({ type: "new", messages: newMessages });
          }
        } catch (err) {
          console.error("Stream polling error:", err);
        }
      }, 2000);

      // === Cleanup when client disconnects ===
      req.on("close", () => {
        clearInterval(interval);
        res.end();
      });

      return; // Stop here — SSE connection stays open
    }

    // ==============================================================
    // 🔴 Invalid Method
    // ==============================================================
    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("💥 Error in /api/messages:", err);

    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}
