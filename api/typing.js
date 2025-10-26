// api/typing.js
import { DB } from "./store";

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

// TTL for typing entries (ms)
const TYPING_TTL = 3000;

export default function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  try {
    if (req.method === "POST") {
      const { key, userName, action } = req.body || {};
      if (!key || !userName) return sendJson(res, 400, { error: "Missing key or userName" });

      DB.typing[key] = DB.typing[key] || {};
      if (action === "start") {
        DB.typing[key][userName] = Date.now();
      } else if (action === "stop") {
        delete DB.typing[key][userName];
      } else {
        return sendJson(res, 400, { error: "Invalid typing action" });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET") {
      const { key } = req.query || {};
      if (!key) return sendJson(res, 400, { error: "Missing key" });

      DB.typing[key] = DB.typing[key] || {};
      // prune stale
      const now = Date.now();
      Object.keys(DB.typing[key]).forEach(u => {
        if (now - DB.typing[key][u] > TYPING_TTL) delete DB.typing[key][u];
      });

      return sendJson(res, 200, Object.keys(DB.typing[key]));
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("typing error", err);
    return sendJson(res, 500, { error: err.message });
  }
}
