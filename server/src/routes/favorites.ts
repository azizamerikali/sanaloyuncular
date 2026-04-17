import { Router, Response } from "express";
import db from "../db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface FavoriteRow {
  id: string;
  client_id: string;
  member_id: string;
}

function toApi(row: FavoriteRow) {
  return { id: row.id, clientId: row.client_id, memberId: row.member_id };
}

// GET /api/favorites
// Admin: tüm favoriler; Client: sadece kendi favorileri; Member: erişim yok
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  if (role === "member") {
    return res.status(403).json({ error: "Erişim engellendi." });
  }

  let sql = "SELECT * FROM favorites WHERE 1=1";
  const params: string[] = [];

  if (role === "client") {
    // Client sadece kendi favorilerini görebilir
    sql += " AND client_id = ?";
    params.push(userId as string);
  } else {
    // Admin: isteğe bağlı filtre
    if (req.query.clientId) {
      sql += " AND client_id = ?";
      params.push(req.query.clientId as string);
    }
    if (req.query.memberId) {
      sql += " AND member_id = ?";
      params.push(req.query.memberId as string);
    }
  }

  const rows = await db.prepare(sql).all(...params) as FavoriteRow[];
  res.json(rows.map(toApi));
});

// POST /api/favorites — sadece admin ve client (client kendi favori listesine ekler)
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece müşteriler favori ekleyebilir." });
  }

  const { clientId, memberId } = req.body;
  if (!clientId || !memberId) {
    return res.status(400).json({ error: "clientId ve memberId gereklidir." });
  }

  // Client sadece kendi favori listesine ekleyebilir
  if (req.user?.role === "client" && clientId !== req.user?.id) {
    return res.status(403).json({ error: "Erişim engellendi. Sadece kendi favori listenizi düzenleyebilirsiniz." });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  await db.prepare("INSERT INTO favorites (id, client_id, member_id) VALUES (?, ?, ?)").run(id, clientId, memberId);
  res.status(201).json({ id, clientId, memberId });
});

// DELETE /api/favorites/:id — admin veya favori sahibi client
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const favorite = await db.prepare("SELECT * FROM favorites WHERE id = ?").get(req.params.id) as FavoriteRow | undefined;
  if (!favorite) return res.status(404).json({ error: "Favori bulunamadı" });

  if (req.user?.role !== "admin" && favorite.client_id !== req.user?.id) {
    return res.status(403).json({ error: "Erişim engellendi. Sadece kendi favorinizi silebilirsiniz." });
  }

  const result = await db.prepare("DELETE FROM favorites WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Favori bulunamadı" });
  res.json({ success: true });
});

export default router;
