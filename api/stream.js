// api/stream.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Set up SSE headers ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*", // <- IMPORTANT for Vercel CORS
  });

  const { convKey } = req.query;
  if (!convKey) {
    res.write(`event: error\ndata: Missing convKey\n\n`);
    return res.end();
  }

  // --- Watch message store in memory (TEMP until DB watcher) ---
  let lastCount = 0;

  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `${process.env.BASE_URL}/api/messages?convKey=${convKey}`
      );
      const data = await response.json();
      if (!Array.isArray(data)) return;

      if (data.length > lastCount) {
        const newMsg = data[data.length - 1];
        res.write(`data: ${JSON.stringify(newMsg)}\n\n`);
        lastCount = data.length;
      }
    } catch (err) {
      console.error("SSE fetch error:", err);
    }
  }, 1500);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
}
