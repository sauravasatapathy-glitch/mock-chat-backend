import pool from "../lib/db.js";

export default async function handler(req, res) {
  // ✅ CORS setup
  const allowedOrigin = "https://mockchat.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { convKey } = req.query;
  if (!convKey) return res.status(400).end("Missing convKey");

  console.log(`🔄 SSE connected for convKey: ${convKey}`);

  let lastMessageId = 0;

  // === Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 30000);

  // === Periodically check DB for new messages
  const checkMessages = setInterval(async () => {
    try {
      const result = await pool.query(
        "SELECT * FROM messages WHERE conv_key = $1 AND id > $2 ORDER BY id ASC",
        [convKey, lastMessageId]
      );

      if (result.rows.length > 0) {
        result.rows.forEach((msg) => {
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
          lastMessageId = msg.id;
        });
      }
    } catch (err) {
      console.error("SSE error:", err);
      clearInterval(checkMessages);
      clearInterval(keepAlive);
      res.end();
    }
  }, 2000);

  req.on("close", () => {
    clearInterval(checkMessages);
    clearInterval(keepAlive);
    console.log(`❌ SSE closed for convKey: ${convKey}`);
  });
}
