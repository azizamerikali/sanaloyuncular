import { Router, Request, Response } from "express";
import db from "../db";
import { protect, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface ConsentRow {
  id: string;
  user_id: string;
  version: string;
  accepted_at: string;
  ip_address: string;
}

function toApi(row: ConsentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    version: row.version,
    acceptedAt: row.accepted_at,
    ipAddress: row.ip_address,
  };
}

// GET /api/consents
// Admin: all records; others: only own records
router.get("/", protect, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "admin") {
    if (req.query.userId) {
      const rows = await db.prepare("SELECT * FROM consents WHERE user_id = ?").all(req.query.userId as string) as ConsentRow[];
      return res.json(rows.map(toApi));
    }
    const rows = await db.prepare("SELECT * FROM consents").all() as ConsentRow[];
    return res.json(rows.map(toApi));
  }

  // Non-admin: only own consents, ignore userId query param
  const rows = await db.prepare("SELECT * FROM consents WHERE user_id = ?").all(req.user!.id) as ConsentRow[];
  res.json(rows.map(toApi));
});

// POST /api/consents — requires authentication; user can only create consent for themselves
router.post("/", protect, async (req: AuthenticatedRequest, res: Response) => {
  const { version } = req.body;
  let { userId } = req.body;

  // Non-admin can only record consent for themselves
  if (req.user?.role !== "admin") {
    userId = req.user!.id;
  } else {
    userId = userId || req.user!.id;
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const acceptedAt = new Date().toISOString();
  const ipAddress = req.ip || req.socket?.remoteAddress || "unknown";

  db.prepare(
    "INSERT INTO consents (id, user_id, version, accepted_at, ip_address) VALUES (?, ?, ?, ?, ?)"
  ).run(id, userId, version || "1.0", acceptedAt, ipAddress);

  res.status(201).json({ id, userId, version: version || "1.0", acceptedAt, ipAddress });
});

// GET /api/consents/text — public
router.get("/text", (_req: Request, res: Response) => {
  const row = await db.prepare("SELECT content FROM consent_text WHERE id = 1").get() as { content: string } | undefined;
  res.json({ text: row?.content || "" });
});

// PUT /api/consents/text — admin only
router.put("/text", protect, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler sözleşme metnini güncelleyebilir." });
  }
  const { text } = req.body;
  await db.prepare("INSERT OR REPLACE INTO consent_text (id, content) VALUES (1, ?)").run(text || "");
  res.json({ success: true });
});

export default router;
