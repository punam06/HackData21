const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));

const users = {};

app.get("/", (req, res) => {
  res.json({ status: "running", version: "1.0" });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", (req, res) => {
  const { userId, message } = req.body;
  
  if (!userId || !message) {
    return res.status(400).json({ error: "Missing fields" });
  }
  
  if (!users[userId]) {
    users[userId] = { id: userId, messages: [] };
  }
  
  users[userId].messages.push({ user: message, timestamp: new Date() });
  
  res.json({
    success: true,
    message: "Hello! I'm NourishAI. How can I help you reduce food waste?",
    userId
  });
});

app.get("/api/user/:userId", (req, res) => {
  const { userId } = req.params;
  if (!users[userId]) {
    users[userId] = { id: userId };
  }
  res.json(users[userId]);
});

app.get("/api/user/:userId/inventory", (req, res) => {
  res.json({ inventory: [] });
});

app.post("/api/user/:userId/inventory", (req, res) => {
  res.json({ success: true });
});

app.get("/api/user/:userId/analytics", (req, res) => {
  res.json({ sdgScore: 50 });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
