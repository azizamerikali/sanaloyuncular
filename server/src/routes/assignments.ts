import { Router, Response } from "express";
import db from "../db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface AssignmentRow {
  id: string;
  project_id: string;
  user_id: string;
}

function toApi(row: AssignmentRow) {
  return { id: row.id, projectId: row.project_id, userId: row.user_id };
}

// GET /api/assignments
// Admin/Client: tüm atamalar (filtreli); Member: sadece kendi atamaları
router.get("/", (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  let sql = "SELECT * FROM assignments WHERE 1=1";
  const params: string[] = [];

  if (role === "member") {
    // Üyeler sadece kendi atamalarını görebilir
    sql += " AND user_id = ?";
    params.push(userId as string);
  } else {
    if (req.query.projectId) {
      sql += " AND project_id = ?";
      params.push(req.query.projectId as string);
    }
    if (req.query.userId) {
      sql += " AND user_id = ?";
      params.push(req.query.userId as string);
    }
  }

  const rows = db.prepare(sql).all(...params) as AssignmentRow[];
  res.json(rows.map(toApi));
});

// POST /api/assignments — sadece admin ve client
router.post("/", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler atama yapabilir." });
  }

  const { projectId, userId } = req.body;
  if (!projectId || !userId) {
    return res.status(400).json({ error: "projectId ve userId gereklidir." });
  }

  const existing = db.prepare("SELECT * FROM assignments WHERE project_id = ? AND user_id = ?").get(projectId, userId) as AssignmentRow | undefined;
  if (existing) return res.json(toApi(existing));

  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  db.prepare("INSERT INTO assignments (id, project_id, user_id) VALUES (?, ?, ?)").run(id, projectId, userId);
  res.status(201).json({ id, projectId, userId });
});

// DELETE /api/assignments/:projectId/:userId — sadece admin ve client
router.delete("/:projectId/:userId", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler atama kaldırabilir." });
  }

  const result = db.prepare("DELETE FROM assignments WHERE project_id = ? AND user_id = ?").run(req.params.projectId, req.params.userId);
  res.json({ success: true, deleted: result.changes > 0 });
});

export default router;
