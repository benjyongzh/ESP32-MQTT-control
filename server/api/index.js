const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();
const { startMqttLogger } = require("../mqttLogger");

const app = express();
// const PORT = 4000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 1 day

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_DEPLOY,
].filter(Boolean);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins, // Vite frontend and deploy branch
    credentials: true,
  })
);

// Token verification middleware
function authMiddleware(req, res, next) {
  const token = req.cookies[process.env.COOKIE_NAME];
  if (token === process.env.SHARED_TOKEN) {
    return next();
  } else {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// Login endpoint
app.post("/auth/login", (req, res) => {
  const { token } = req.body;
  if (token === process.env.SHARED_TOKEN) {
    res.cookie(process.env.COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: SESSION_TTL_MS,
    });
    return res.json({ message: "Login successful" });
  } else {
    return res.status(401).json({ message: "Invalid Token" });
  }
});

// Check session
app.get("/auth/check", authMiddleware, (req, res) => {
  res.json({ valid: true });
});

// Logout
app.post("/auth/logout", (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME);
  res.json({ message: "Logged out" });
});

// Fallback route
app.get("/", (req, res) => {
  res.send("ESP32 backend auth server reached");
});

// Start MQTT logging service
startMqttLogger();

// app.listen(PORT, () => {
//   console.log(`✅ Auth server running at ${PORT}`);
// });

// Export the app for Vercel to handle the routing
module.exports = app;
