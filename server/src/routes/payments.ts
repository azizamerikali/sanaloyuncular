import { Router, Response } from "express";
import db from "../db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface PaymentRow {
  id: string;
  user_id: string;
  project_id: string;
  date: string;
  gross_amount: number;
  deduction: number;
  net_amount: number;
  status: string;
}

function toApi(row: PaymentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    date: row.date,
    grossAmount: row.gross_amount,
    deduction: row.deduction,
    netAmount: row.net_amount,
    status: row.status,
  };
}

// GET /api/payments
// Admin/Client: tüm ödemeler (filtreli); Member: sadece kendi ödemeleri
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  let sql = "SELECT * FROM payments WHERE 1=1";
  const params: string[] = [];

  if (role === "member") {
    // Üyeler sadece kendi ödemelerini görebilir
    sql += " AND user_id = ?";
    params.push(userId as string);
  } else {
    // Admin/Client: isteğe bağlı filtre
    if (req.query.userId) {
      sql += " AND user_id = ?";
      params.push(req.query.userId as string);
    }
    if (req.query.projectId) {
      sql += " AND project_id = ?";
      params.push(req.query.projectId as string);
    }
  }

  sql += " ORDER BY date DESC";
  const rows = await db.prepare(sql).all(...params) as PaymentRow[];
  res.json(rows.map(toApi));
});

// GET /api/payments/stats — sadece admin ve client
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi." });
  }
  const totalPaid = await db.prepare("SELECT COALESCE(SUM(net_amount), 0) as total FROM payments WHERE status = 'paid'").get() as { total: number };
  const totalUnpaid = await db.prepare("SELECT COALESCE(SUM(net_amount), 0) as total FROM payments WHERE status = 'unpaid'").get() as { total: number };
  const count = await db.prepare("SELECT COUNT(*) as cnt FROM payments").get() as { cnt: number };
  res.json({ totalPaid: totalPaid.total, totalUnpaid: totalUnpaid.total, count: count.cnt });
});

// GET /api/payments/:id — admin/client veya kaydın sahibi
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const row = await db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as PaymentRow | undefined;
  if (!row) return res.status(404).json({ error: "Ödeme bulunamadı" });

  if (req.user?.role !== "admin" && req.user?.role !== "client" && row.user_id !== req.user?.id) {
    return res.status(403).json({ error: "Erişim engellendi." });
  }
  res.json(toApi(row));
});

// POST /api/payments — sadece admin ve client
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler ödeme oluşturabilir." });
  }

  const { userId, projectId, date, grossAmount, deduction, status } = req.body;
  const gross = Math.max(0, Number(grossAmount) || 0);
  const ded = Math.max(0, Number(deduction) || 0);
  const net = gross - ded;
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

  await db.prepare(
    "INSERT INTO payments (id, user_id, project_id, date, gross_amount, deduction, net_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, userId || "", projectId || "", date || new Date().toISOString().split("T")[0], gross, ded, net, status || "unpaid");

  res.status(201).json({ id, userId, projectId, date, grossAmount: gross, deduction: ded, netAmount: net, status: status || "unpaid" });
});

// PUT /api/payments/:id — sadece admin
router.put("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler ödeme güncelleyebilir." });
  }

  const existing = await db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as PaymentRow | undefined;
  if (!existing) return res.status(404).json({ error: "Ödeme bulunamadı" });

  const { userId, projectId, date, grossAmount, deduction, status } = req.body;
  const gross = Math.max(0, Number(grossAmount ?? existing.gross_amount));
  const ded = Math.max(0, Number(deduction ?? existing.deduction));
  const net = gross - ded;

  await db.prepare(
    "UPDATE payments SET user_id = ?, project_id = ?, date = ?, gross_amount = ?, deduction = ?, net_amount = ?, status = ? WHERE id = ?"
  ).run(
    userId ?? existing.user_id,
    projectId ?? existing.project_id,
    date ?? existing.date,
    gross, ded, net,
    status ?? existing.status,
    req.params.id
  );

  const updated = await db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as PaymentRow;
  res.json(toApi(updated));
});

// DELETE /api/payments/:id — sadece admin
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler ödeme silebilir." });
  }

  const result = await db.prepare("DELETE FROM payments WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Ödeme bulunamadı" });
  res.json({ success: true });
});

export default router;
