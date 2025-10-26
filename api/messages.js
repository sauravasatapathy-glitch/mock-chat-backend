// api/messages.js
import { DB } from "./store";

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  try {
    if (req.method === "POST") {
      const { action } = req.body || {};
      if (action === "sendMessage") {
        const { key, sender, role, text } = req.body || {};
        if (!key || !sender || !role || !text) return sendJson(res, 400, { error: "Missing fields" });
        const conv = DB.conversations[key];
        if (!conv) return sendJson(res, 404, { error: "Conversation not found" });
        if (conv.ended) return sendJson(res, 400, { error: "Conversation ended" });
        const msg = { timestamp: new Date().toISOString(), sender, role, text };
        conv.messages.push(msg);
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 400, { error: "Invalid action" });
    }

    if (req.method === "GET") {
      const { key } = req.query || {};
      if (!key) return sendJson(res, 400, { error: "Missing key" });
      const conv = DB.conversations[key];
      if (!conv) return sendJson(res, 200, []);
      return sendJson(res, 200, conv.messages);
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("messages error", err);
    return sendJson(res, 500, { error: err.message });
  }
}
