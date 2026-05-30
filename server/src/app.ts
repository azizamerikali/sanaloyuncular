import express from "express";
// Database: Supabase (PostgreSQL)
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
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
import adminLegalRouter from "./routes/admin_legal";
import { protect, AuthenticatedRequest } from "./middleware/authMiddleware";
import { dbReadyMiddleware } from "./middleware/dbReadyMiddleware";
import { getEncryptionKeyInfo } from "./utils/cryptoUtil";

dotenv.config();

// Ensure default values to prevent startup crashes if env variables are missing
process.env.JWT_SECRET = process.env.JWT_SECRET || "sanal_oyuncular_default_secret_key_123";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "sanaloyuncular_secret_32char_key";

let initializationError: string | null = null;

// Validate required environment variables at startup
try {
  const REQUIRED_ENV_VARS = ["JWT_SECRET", "ENCRYPTION_KEY"];
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  // Also check encryption key specifically
  const keyInfo = getEncryptionKeyInfo();
  if (!keyInfo.isValid) {
    throw new Error(`ENCRYPTION_KEY is invalid: length is ${keyInfo.length}, expected 32.`);
  }
} catch (err: any) {
  initializationError = err.message;
  console.error(`❌ Initialization Error: ${initializationError}`);
}

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || "3000");

// Trust Vercel's proxy so req.ip is populated correctly (needed for rate limiting)
app.set("trust proxy", 1);

// Middleware
// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://openui5.hana.ondemand.com", "https://accounts.google.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://openui5.hana.ondemand.com", "https://fonts.googleapis.com"],
      "img-src": ["'self'", "data:", "https://openui5.hana.ondemand.com", "https://*.googleusercontent.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "connect-src": ["'self'", "https://openui5.hana.ondemand.com", "https://accounts.google.com", "https://www.googleapis.com"],
      "frame-src": ["'self'", "https://accounts.google.com"]
    },
  },
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:8080", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    // Explicitly configured origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // On Vercel: allow the auto-generated deployment URL
    if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) {
      return callback(null, true);
    }
    // On Vercel without explicit ALLOWED_ORIGINS: allow all origins.
    // Frontend and API are on the same deployment; JWT tokens provide auth.
    if (process.env.VERCEL && !process.env.ALLOWED_ORIGINS) {
      return callback(null, true);
    }
    callback(new Error("CORS: Bu kaynaktan erişim izni yok."));
  },
  credentials: true,
}));

// Health Check & Diagnostic Endpoint
app.get("/api/health-db", async (req, res) => {
  try {
    const userCount = await db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
    const legalCount = await db.prepare("SELECT COUNT(*) as cnt FROM member_legal_records").get() as { cnt: number };
    const tables = await db.prepare("SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'").all();
    
    res.json({
      success: true,
      time: new Date().toISOString(),
      counts: {
        users: userCount.cnt,
        legalRecords: legalCount.cnt
      },
      tables: tables.map((t: any) => t.name)
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Middleware (Moved below health check for simplicity)
app.use(express.json({ limit: "50mb" })); // Reduced base size to standard. Base64 images are handled safely now.
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
app.use("/api", dbReadyMiddleware);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", protect, projectsRouter);
app.use("/api/assignments", protect, assignmentsRouter);
app.use("/api/payments", protect, paymentsRouter);
app.use("/api/media", protect, mediaRouter);
app.use("/api/consents", consentsRouter);
app.use("/api/favorites", protect, favoritesRouter);
app.use("/api/system", protect, systemRouter);
app.use("/api/admin-legal", adminLegalRouter);
app.use("/api/verify", verifyRouter);

// Health check
app.get("/api/health", async (_req, res) => {
  const keyInfo = getEncryptionKeyInfo();
  try {
    const userCount = await db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number } | undefined;
    res.status(initializationError ? 503 : 200).json({ 
      status: initializationError ? "error" : "ok",
      initError: initializationError,
      envStatus: {
        jwtSecret: !!process.env.JWT_SECRET,
        encryptionKey: keyInfo
      },
      database: "supabase", 
      users: userCount?.cnt || 0 
    });
  } catch (err: any) {
    res.status(503).json({ 
      status: "error", 
      initError: initializationError || err.message,
      envStatus: {
        jwtSecret: !!process.env.JWT_SECRET,
        encryptionKey: keyInfo
      },
      database: "supabase", 
      users: 0 
    });
  }
});

// Supabase health check
  app.get("/api/health-supabase", async (_req, res) => {
    try {
      const userCount = await db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
      res.json({
        serverTime: new Date().toISOString(),
        status: "ready",
        database: "supabase-postgresql",
        supabaseUrl: process.env.SUPABASE_URL ? "configured" : "missing",
        users: userCount?.cnt || 0
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message,
        hint: "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
      });
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

  // Disable auto-save during bootstrap to prevent massive upload overhead on Vercel
  (db as any).setSkipSave(true);

  // Supabase: Schema should be created via Supabase SQL Editor (see migration plan).
  // The following is a safety check — tables should already exist.
  try {
    const userCount = await db.prepare("SELECT COUNT(*) as cnt FROM users").get();
    console.log(`✅ Main Schema ready (users: ${userCount?.cnt || 0})`);
  } catch (e) {
    console.error("❌ Schema check failed — have you created the tables in Supabase?", e);
  }

  // Verify legal records table exists
  try {
    await db.prepare("SELECT COUNT(*) as cnt FROM member_legal_records").get();
    console.log("✅ Legal records table verified");
  } catch (e) {
    console.error("❌ Legal records table not found — create it in Supabase SQL Editor", e);
  }

  // Column migrations handled in Supabase SQL Editor

  // Bootstrap default admins if they don't exist
  await bootstrapAdmins();

  // Re-enable and trigger final save after all bootstrap operations are done
  (db as any).setSkipSave(false);
  await (db as any).save();

  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`🚀 SanalOyuncular API Server running at http://localhost:${PORT}`);
      console.log(`📦 Database: Supabase (PostgreSQL)`);
      console.log(`🔗 API: http://localhost:${PORT}/api/health`);
    });
  }
}

// Export the startup promise so Vercel handler can await DB readiness before
// processing the first request (prevents race condition on cold starts).
export const startupPromise = start().catch((err) => {
  console.error("Failed to initialize server:", err);
  if (!process.env.VERCEL) process.exit(1);
});

async function bootstrapAdmins() {
  const admins = [
    { id: "admin1", first: "Aziz", last: "Amerikalı", email: "azizakal@gmail.com" },
    { id: "admin2", first: "Ufuk", last: "Tosun", email: "uufuktosun@gmail.com" }
  ];

  const defaultPassword = "Q1w2e3r!";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  for (const admin of admins) {
    try {
      const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(admin.email);
      if (!existing) {
        await db.prepare(
          "INSERT INTO users (id, first_name, last_name, email, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          admin.id,
          admin.first,
          admin.last,
          admin.email,
          passwordHash,
          "admin",
          "active",
          new Date().toISOString()
        );
        console.log(`👤 Bootstrap: Admin created (${admin.email})`);
      }
    } catch (err: any) {
      console.error(`❌ Bootstrap: Failed to create admin ${admin.email}:`, err.message);
    }
  }
}

export default app;
