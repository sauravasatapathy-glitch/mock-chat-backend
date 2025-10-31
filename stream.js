import pool from "../lib/db.js";

export default async function handler(req, res) {
  // === CORS headers ===
  res.setHeader("Access-Control-Allow-Origin", "https://mockchat.vercel.app");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { convKey } = req.query;
  if (!convKey) return res.status(400).end("Missing convKey");

  console.log(`🔌 SSE connected for conversation: ${convKey}`);

  // === Track clients globally (per conversation) ===
  globalThis.chatClients = globalThis.chatClients || {};
  if (!globalThis.chatClients[convKey]) globalThis.chatClients[convKey] = [];
  const client = { res };
  globalThis.chatClients[convKey].push(client);

  // === Keep-alive ping every 25s to prevent disconnect ===
  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    globalThis.chatClients[convKey] = globalThis.chatClients[convKey].filter(
      (c) => c !== client
    );
    console.log(`❌ SSE closed for convKey: ${convKey}`);
  });
}
