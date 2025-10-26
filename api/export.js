// api/export.js
import PDFDocument from "pdfkit";
import getStream from "get-stream"; // we will include small get-stream utility inline if needed

import { DB } from "./store";

function sendJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

// helper to convert stream to Buffer (use get-stream or built-in)
async function streamToBuffer(stream) {
  const chunks = [];
  return await new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", err => reject(err));
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  try {
    const { key } = req.method === "GET" ? req.query : req.body || {};
    if (!key) return sendJson(res, 400, { error: "Missing key" });

    const conv = DB.conversations[key];
    if (!conv) return sendJson(res, 404, { error: "Conversation not found" });

    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    // stream to buffer
    const bufferPromise = streamToBuffer(doc);

    doc.fontSize(16).text(`Conversation: ${key}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Trainer: ${conv.trainer}`);
    doc.text(`Associate: ${conv.associate}`);
    doc.text(`Started: ${conv.startTime}`);
    if (conv.ended) doc.text(`Ended: ${conv.endTime || ""}`);
    doc.moveDown();
    doc.moveDown();

    conv.messages.forEach(m => {
      const ts = new Date(m.timestamp).toLocaleString();
      doc.fontSize(10).fillColor("gray").text(`[${ts}] ${m.role} ${m.sender}`);
      doc.fillColor("black").fontSize(12).text(m.text, { indent: 10, paragraphGap: 8 });
    });

    doc.end();
    const buffer = await bufferPromise;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Conversation_${key}.pdf`);
    res.send(buffer);
  } catch (err) {
    console.error("export error", err);
    return sendJson(res, 500, { error: err.message });
  }
}
