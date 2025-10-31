import pool from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const allowedOrigin = "https://mockchat.vercel.app";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    // === POST: send message ===
    if (req.method === "POST") {
      const { convKey, senderName, senderRole, text } = req.body || {};
      if (!convKey || !senderName || !text)
        return res.status(400).json({ error: "Missing required fields" });

      await pool.query(
        `INSERT INTO messages (conv_key, sender_name, role, text, timestamp)
         VALUES ($1, $2, $3, $4, NOW())`,
        [convKey, senderName, senderRole, text]
      );

      return res.status(200).json({ success: true });
    }

    // === GET: decide between SSE vs normal fetch ===
    if (req.method === "GET") {
      const { convKey } = req.query || {};
      if (!convKey) return res.status(400).json({ error: "Missing convKey" });

      // 👇 Check if client expects SSE
      const isSSE = req.headers.accept === "text/event-stream";

      if (!isSSE) {
        // === Normal GET: return messages JSON ===
        const result = await pool.query(
          "SELECT * FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC",
          [convKey]
        );
        return res.status(200).json(result.rows);
      }

      // === SSE mode: real-time stream ===
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Initial load
      const initial = await pool.query(
        "SELECT * FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC",
        [convKey]
      );
      sendEvent({ type: "init", messages: initial.rows });

      let lastCount = initial.rows.length;

      const interval = setInterval(async () => {
        try {
          const result = await pool.query(
            "SELECT * FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC",
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

      req.on("close", () => {
        clearInterval(interval);
        res.end();
      });

      return; // end handler here
    }

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
