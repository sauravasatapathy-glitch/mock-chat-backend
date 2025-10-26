// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Create a conversation
app.post("/api/createConversation", async (req, res) => {
  try {
    const { trainer, associate } = req.body;
    const key = Math.random().toString(36).substring(2, 8).toUpperCase();

    await pool.query(
      "INSERT INTO conversations (conv_key, trainer_name, associate_name, start_time, ended) VALUES ($1,$2,$3,NOW(),FALSE)",
      [key, trainer, associate]
    );

    res.json({ key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ✅ Get all messages
app.get("/api/getMessages", async (req, res) => {
  try {
    const { key } = req.query;
    const result = await pool.query(
      "SELECT timestamp, sender, role, message FROM messages WHERE conv_key=$1 ORDER BY timestamp ASC",
      [key]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ✅ Send message
app.post("/api/sendMessage", async (req, res) => {
  try {
    const { key, sender, role, text } = req.body;
    await pool.query(
      "INSERT INTO messages (conv_key, timestamp, sender, role, message) VALUES ($1,NOW(),$2,$3,$4)",
      [key, sender, role, text]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ✅ Get role info
app.get("/api/getUserRoleAndStartTime", async (req, res) => {
  try {
    const { key, name } = req.query;
    const conv = await pool.query("SELECT * FROM conversations WHERE conv_key=$1", [key]);
    if (conv.rowCount === 0) return res.json(null);

    const c = conv.rows[0];
    if (c.ended) return res.json(null);

    let role = null;
    if (c.trainer_name.toLowerCase() === name.toLowerCase()) role = "trainer";
    else if (c.associate_name.toLowerCase() === name.toLowerCase()) role = "associate";
    else return res.json(null);

    res.json({
      role,
      trainerName: c.trainer_name,
      associateName: c.associate_name,
      startTime: c.start_time,
      convKey: key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversation info" });
  }
});

// ✅ End conversation
app.post("/api/endConversation", async (req, res) => {
  try {
    const { key } = req.body;
    await pool.query("UPDATE conversations SET ended=TRUE, end_time=NOW() WHERE conv_key=$1", [key]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end conversation" });
  }
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
