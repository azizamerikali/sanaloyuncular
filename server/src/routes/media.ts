import { Router, Response } from "express";
import db from "../db";
import { encryptField, decryptField } from "../utils/cryptoUtil";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface MediaRow {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_data: string;
  created_at: string;
}

// toApi without media content for lists
function toApi(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileData: row.file_data ? decryptField(row.file_data) : null,
    createdAt: row.created_at,
  };
}

// GET /api/media - LIST ONLY (No content)
router.get("/", (req: AuthenticatedRequest, res: Response) => {
  // We explicitly EXCLUDE file_data from global listing to prevent OOM
  let sql = "SELECT id, user_id, file_name, file_path, created_at FROM media WHERE 1=1";
  const params: string[] = [];

  if (req.query.userId) {
    sql += " AND user_id = ?";
    params.push(req.query.userId as string);
  }

  sql += " ORDER BY created_at DESC";
  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      filePath: row.file_path,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error("Media list fetch error:", error);
    res.status(500).json({ error: "Medya listesi alinamadi." });
  }
});

// GET /api/media/:id/content - View specific media content
router.get("/:id/content", (req: AuthenticatedRequest, res: Response) => {
  const row = db.prepare("SELECT file_data FROM media WHERE id = ?").get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: "Medya bulunamadı" });
  
  res.json({
    fileData: decryptField(row.file_data)
  });
});

// GET /api/media/count
router.get("/count", (req: AuthenticatedRequest, res: Response) => {
  if (req.query.userId) {
    const result = db.prepare("SELECT COUNT(*) as cnt FROM media WHERE user_id = ?").get(req.query.userId as string) as { cnt: number };
    return res.json({ count: result.cnt });
  }
  const result = db.prepare("SELECT COUNT(*) as cnt FROM media").get() as { cnt: number };
  res.json({ count: result.cnt });
});

// POST /api/media
router.post("/", (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "member" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi." });
  }

  const { userId, fileName, filePath, fileData } = req.body;
  if (userId && req.user?.role !== "admin" && userId !== req.user?.id) {
    return res.status(403).json({ error: "Başka bir kullanıcı için fotoğraf yükleyemezsiniz." });
  }

  // Validate file type using magic bytes (not just the data URI prefix)
  if (fileData) {
    const headerMatch = fileData.match(/^data:image\/(jpeg|png);base64,/);
    if (!headerMatch) {
      return res.status(400).json({ error: "Geçersiz dosya formatı. Sadece JPG ve PNG kabul edilir." });
    }
    try {
      const base64Data = fileData.split(",")[1];
      if (!base64Data) throw new Error("empty");
      const bytes = Buffer.from(base64Data.slice(0, 16), "base64");
      // JPEG: FF D8 FF
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      // PNG:  89 50 4E 47 0D 0A 1A 0A
      const isPng  = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      if (!isJpeg && !isPng) {
        return res.status(400).json({ error: "Dosya içeriği geçersiz. Sadece gerçek JPG ve PNG dosyaları kabul edilir." });
      }
    } catch {
      return res.status(400).json({ error: "Dosya verisi okunamadı." });
    }
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const createdAt = new Date().toISOString();
  
  const encryptedFileData = encryptField(fileData || "");

  await db.prepare(
    "INSERT INTO media (id, user_id, file_name, file_path, file_data, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, userId || req.user?.id || "", fileName || "", filePath || "", encryptedFileData, createdAt);

  res.status(201).json({ id, userId, fileName, filePath, fileData, createdAt });
});

// DELETE /api/media/:id
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const media = db.prepare("SELECT * FROM media WHERE id = ?").get(req.params.id) as MediaRow | undefined;
  if (!media) return res.status(404).json({ error: "Medya bulunamadı" });

  if (req.user?.role !== "admin" && media.user_id !== req.user?.id) {
    return res.status(403).json({ error: "Access denied." });
  }

  const result = await db.prepare("DELETE FROM media WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Media not found" });
  res.json({ success: true });
});

export default router;
