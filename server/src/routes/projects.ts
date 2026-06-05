import { Router, Response } from "express";
import db from "../db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  created_by: string;
  status: string;
  created_at: string;
  royalty_fee: number;
  max_members: number;
}

function toApi(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at,
    royaltyFee: Number(row.royalty_fee) || 0,
    maxMembers: Number(row.max_members) || 0,
  };
}

// GET /api/projects
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  let sql = "SELECT * FROM projects WHERE 1=1";
  const params: string[] = [];

  if (req.query.createdBy) {
    sql += " AND created_by = ?";
    params.push(req.query.createdBy as string);
  }
  if (req.query.status) {
    sql += " AND status = ?";
    params.push(req.query.status as string);
  }

  sql += " ORDER BY created_at DESC";
  const rows = await db.prepare(sql).all(...params) as ProjectRow[];
  res.json(rows.map(toApi));
});

// GET /api/projects/count
router.get("/count", async (_req: AuthenticatedRequest, res: Response) => {
  const result = await db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number };
  res.json({ count: result.cnt });
});

// GET /api/projects/:id
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const row = await db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow | undefined;
  if (!row) return res.status(404).json({ error: "Proje bulunamadı" });
  res.json(toApi(row));
});

// POST /api/projects — only admin or client
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler proje oluşturabilir." });
  }

  const { name, description, createdBy, status, royaltyFee, maxMembers } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const createdAt = new Date().toISOString();
  const fee = Number(royaltyFee) || 0;
  const maxM = Number(maxMembers) || 0;

  await db.prepare(
    "INSERT INTO projects (id, name, description, created_by, status, created_at, royalty_fee, max_members) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, name || "", description || "", createdBy || req.user?.id || "", status || "active", createdAt, fee, maxM);

  res.status(201).json({ id, name, description, createdBy, status: status || "active", createdAt, royaltyFee: fee, maxMembers: maxM });
});

// PUT /api/projects/:id — only admin or client
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler proje güncelleyebilir." });
  }

  const existing = await db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow | undefined;
  if (!existing) return res.status(404).json({ error: "Proje bulunamadı" });

  const { name, description, createdBy, status, royaltyFee, maxMembers } = req.body;
  await db.prepare(
    "UPDATE projects SET name = ?, description = ?, created_by = ?, status = ?, royalty_fee = ?, max_members = ? WHERE id = ?"
  ).run(
    name ?? existing.name,
    description ?? existing.description,
    createdBy ?? existing.created_by,
    status ?? existing.status,
    royaltyFee ?? existing.royalty_fee ?? 0,
    maxMembers ?? existing.max_members ?? 0,
    req.params.id
  );

  const updated = await db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow;
  res.json(toApi(updated));
});

// DELETE /api/projects/:id — only admin
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler proje silebilir." });
  }

  const result = await db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Proje bulunamadı" });
  res.json({ success: true });
});

export default router;
