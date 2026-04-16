import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import db from "../db";
import { protect, AuthenticatedRequest } from "../middleware/authMiddleware";
import multer from "multer";
import fs from "fs";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Max 5 backup downloads per hour per IP
const backupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Çok fazla yedek indirme isteği. Lütfen bir saat sonra tekrar deneyin.",
});

// GET /api/system/backup
router.get("/backup", protect, backupLimiter, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin") {
        return res.status(403).json({ error: "Sadece yöneticiler yedek alabilir" });
    }

    const dbPath = (db as any).getDbPath();
    if (fs.existsSync(dbPath)) {
        res.download(dbPath, `backup_${new Date().toISOString().split('T')[0]}.sqlite`);
    } else {
        res.status(404).json({ error: "Veritabanı dosyası bulunamadı" });
    }
});

// POST /api/system/restore
router.post("/restore", protect, upload.single("backup"), async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin") {
        return res.status(403).json({ error: "Sadece yöneticiler yedek geri yükleyebilir" });
    }

    if (!req.file) {
        return res.status(400).json({ error: "Yedek dosyası seçilmedi" });
    }

    try {
        await (db as any).restore(req.file.buffer);
        res.json({ success: true, message: "Veritabanı başarıyla geri yüklendi" });
    } catch (error: any) {
        console.error("Restore failed:", error);
        res.status(500).json({ error: "Geri yükleme başarısız." });
    }
});

export default router;
