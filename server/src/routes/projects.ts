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
}

function toApi(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at,
  };
}

// GET /api/projects
router.get("/", (req: AuthenticatedRequest, res: Response) => {
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
  const rows = db.prepare(sql).all(...params) as ProjectRow[];
  res.json(rows.map(toApi));
});

// GET /api/projects/count
router.get("/count", (_req: AuthenticatedRequest, res: Response) => {
  const result = db.prepare("SELECT COUNT(*) as cnt FROM projects").get() as { cnt: number };
  res.json({ count: result.cnt });
});

// GET /api/projects/:id
router.get("/:id", (req: AuthenticatedRequest, res: Response) => {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow | undefined;
  if (!row) return res.status(404).json({ error: "Proje bulunamadı" });
  res.json(toApi(row));
});

// POST /api/projects — only admin or client
router.post("/", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler proje oluşturabilir." });
  }

  const { name, description, createdBy, status } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const createdAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO projects (id, name, description, created_by, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name || "", description || "", createdBy || req.user?.id || "", status || "active", createdAt);

  res.status(201).json({ id, name, description, createdBy, status: status || "active", createdAt });
});

// PUT /api/projects/:id — only admin or client
router.put("/:id", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler proje güncelleyebilir." });
  }

  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow | undefined;
  if (!existing) return res.status(404).json({ error: "Proje bulunamadı" });

  const { name, description, createdBy, status } = req.body;
  db.prepare(
    "UPDATE projects SET name = ?, description = ?, created_by = ?, status = ? WHERE id = ?"
  ).run(name ?? existing.name, description ?? existing.description, createdBy ?? existing.created_by, status ?? existing.status, req.params.id);

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as ProjectRow;
  res.json(toApi(updated));
});

// DELETE /api/projects/:id — only admin
router.delete("/:id", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler proje silebilir." });
  }

  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Proje bulunamadı" });
  res.json({ success: true });
});

export default router;
