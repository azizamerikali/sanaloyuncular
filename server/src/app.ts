import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import db from "./db";

import usersRouter from "./routes/users";
import authRouter from "./routes/auth";
import projectsRouter from "./routes/projects";
import assignmentsRouter from "./routes/assignments";
import paymentsRouter from "./routes/payments";
import mediaRouter from "./routes/media";
import consentsRouter from "./routes/consents";
import favoritesRouter from "./routes/favorites";
import systemRouter from "./routes/system";
import verifyRouter from "./routes/verify";
import { protect, AuthenticatedRequest } from "./middleware/authMiddleware";

dotenv.config();

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = ["JWT_SECRET", "ENCRYPTION_KEY"];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`❌ FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || "3000");

// Middleware
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:8080", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS: Bu kaynaktan erişim izni yok."));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Reduced base size to standard. Base64 images are handled safely now.
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: "Bu IP'den çok fazla istek yapıldı, lütfen daha sonra tekrar deneyin."
});
app.use(limiter);

// KVKK Audit Request logging
app.use((req, _res, next) => {
  const userId = (req as AuthenticatedRequest).user?.id || "anonim";
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[KVKK-AUDIT] ${new Date().toISOString()} | IP: ${ip} | User: ${userId} | ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", protect, projectsRouter);
app.use("/api/assignments", protect, assignmentsRouter);
app.use("/api/payments", protect, paymentsRouter);
app.use("/api/media", protect, mediaRouter);
app.use("/api/consents", consentsRouter);
app.use("/api/favorites", protect, favoritesRouter);
app.use("/api/system", protect, systemRouter);
app.use("/api/verify", verifyRouter);

// Health check
app.get("/api/health", (_req, res) => {
  try {
    const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number } | undefined;
    res.json({ status: "ok", database: "sqlite", users: userCount?.cnt || 0 });
  } catch {
    res.json({ status: "ok", database: "sqlite", users: 0 });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// Wait for DB to be ready, then start server
async function start() {
  await db.ready();
  console.log("✅ Database initialized");

  // Basic migration
  try {
    db.exec("ALTER TABLE users ADD COLUMN profile_picture TEXT DEFAULT '';");
    console.log("✅ Migration applied: users.profile_picture");
  } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log("✅ Migration applied: verification_codes table");
  } catch (e) {
    console.error("❌ Migration failed: verification_codes", e);
  }

  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`🚀 SanalOyuncular API Server running at http://localhost:${PORT}`);
      console.log(`📦 Database: SQLite`);
      console.log(`🔗 API: http://localhost:${PORT}/api/health`);
    });
  }
}

// In serverless environments, we might want to ensure DB is ready BEFORE exporting or on each request.
// For now, let's just make the 'start' function run once globally.
start().catch((err) => {
  console.error("Failed to initialize server:", err);
  // Do not exit on Vercel
  if (!process.env.VERCEL) process.exit(1);
});

export default app;
