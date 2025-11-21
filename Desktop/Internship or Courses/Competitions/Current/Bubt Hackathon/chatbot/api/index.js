const users = {};

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const pathname = req.url.split("?")[0];

  // Root
  if (pathname === "/" || pathname === "") {
    return res.status(200).json({ status: "running" });
  }

  // Health
  if (pathname === "/health") {
    return res.status(200).json({ ok: true });
  }

  // Chat POST
  if (pathname === "/api/chat" && req.method === "POST") {
    const body = req.body || {};
    const { userId, message } = body;
    if (!userId || !message) return res.status(400).json({ error: "Missing" });
    if (!users[userId]) users[userId] = { id: userId };
    return res.status(200).json({ success: true, message: "Hello!", userId });
  }

  // User GET
  if (pathname.includes("/api/user/") && !pathname.includes("/inventory") && !pathname.includes("/analytics") && req.method === "GET") {
    const userId = pathname.split("/api/user/")[1];
    if (!users[userId]) users[userId] = { id: userId };
    return res.status(200).json(users[userId]);
  }

  // Inventory
  if (pathname.includes("/inventory")) {
    return res.status(200).json({ inventory: [] });
  }

  // Analytics
  if (pathname.includes("/analytics")) {
    return res.status(200).json({ sdgScore: 50 });
  }

  res.status(200).json({ ok: true });
};
