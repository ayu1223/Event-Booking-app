require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { connectDB } = require("./config/database");
const Admin = require("./models/Admin");
const { startReminderScheduler } = require("./services/reminderService");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const organizerRoutes = require("./routes/organizerRoutes");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

// ---------- Security & core middleware ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret",
    resave: false,
    saveUninitialized: false,
    store: process.env.MONGO_URI
      ? MongoStore.create({ mongoUrl: process.env.MONGO_URI, ttl: 60 * 60 * 24 })
      : undefined,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// General-purpose rate limiter to reduce abuse across all routes.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  // Session values only (no DB lookup per request) - set at login/register.
  res.locals.currentUser =
    req.session && req.session.userId
      ? { id: req.session.userId, name: req.session.userName }
      : null;
  next();
});

// ---------- Routes ----------
app.use("/", authRoutes);
app.use("/my-events", organizerRoutes);
app.use("/", eventRoutes);
app.use("/", bookingRoutes);
app.use("/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// ---------- Startup ----------
const PORT = process.env.PORT || 3000;
let server;

async function start() {
  await connectDB();
  await Admin.ensureSeedAdmin();
  startReminderScheduler();

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

module.exports = app;
