import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 8080;

// PostgreSQL connection (Render gives DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Helper to generate conversation key
function generateConvKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
}

// --- ROUTES ---

// Create conversation
app.post("/api/conversations", async (req, res) => {
  try {
    const { trainer, associate } = req.body;
    const convKey = generateConvKey();

    await pool.query(
      `INSERT INTO conversations (key, trainer, associate, start_time, ended)
       VALUES ($1, $2, $3, NOW(), false)`,
      [convKey, trainer, associate]
    );

    res.json({ key: convKey });
  } catch (err) {
    console.error("createConversation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get user role and conversation details
app.get("/api/conversations/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { name } = req.query;

    const result = await pool.query(
      `SELECT * FROM conversations WHERE key = $1`,
      [key]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const conv = result.rows[0];
    if (conv.ended) return res.json({ error: "Conversation ended" });

    const lower = name.toLowerCase();
    let role = null;
    if (conv.trainer.toLowerCase() === lower) role = "trainer";
    else if (conv.associate.toLowerCase() === lower) role = "associate";
    else return res.status(403).json({ error: "Not a participant" });

    res.json({
      role,
      trainerName: conv.trainer,
      associateName: conv.associate,
      startTime: conv.start_time,
      convKey: conv.key,
    });
  } catch (err) {
    console.error("getUserRole error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send message
app.post("/api/messages", async (req, res) => {
  try {
    const { key, sender, role, text } = req.body;

    const conv = await pool.query(`SELECT ended FROM conversations WHERE key=$1`, [key]);
    if (conv.rowCount === 0) return res.status(404).json({ error: "Conversation not found" });
    if (conv.rows[0].ended) return res.status(400).json({ error: "Conversation ended" });

    await pool.query(
      `INSERT INTO messages (conv_key, timestamp, sender, role, text)
       VALUES ($1, NOW(), $2, $3, $4)`,
      [key, sender, role, text]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("sendMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Get all messages
app.get("/api/messages/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      `SELECT * FROM messages WHERE conv_key=$1 ORDER BY timestamp ASC`,
      [key]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// End conversation
app.post("/api/conversations/:key/end", async (req, res) => {
  try {
    const { key } = req.params;
    await pool.query(
      `UPDATE conversations SET ended=true, end_time=NOW() WHERE key=$1`,
      [key]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("endConversation error:", err);
    res.status(500).json({ error: "Failed to end conversation" });
  }
});

app.get("/", (_, res) => res.send("✅ Mock Chat API running"));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
