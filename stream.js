import pool from "./db.js";

export default async function handler(req, res) {
  try {
    const allowedOrigin = "https://mockchat.vercel.app";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(200).end();

    const { convKey } = req.query;
    if (!convKey) {
      res.status(400).json({ error: "Missing convKey" });
      return;
    }

    // === Setup SSE Headers ===
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // === Helper: send message to client ===
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // === Initial load ===
    const initial = await pool.query(
      "SELECT * FROM messages WHERE conv_key = $1 ORDER BY timestamp ASC",
      [convKey]
    );
    sendEvent({ type: "init", messages: initial.rows });

    // === Polling mechanism every 3 seconds ===
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
    }, 3000);

    // === Cleanup on client disconnect ===
    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });
  } catch (err) {
    console.error("💥 Error in /api/stream:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      res.end();
    }
  }
}
