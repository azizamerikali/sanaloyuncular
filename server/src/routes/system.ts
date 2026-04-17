import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import db from "../db";
import { protect, AuthenticatedRequest } from "../middleware/authMiddleware";
import multer from "multer";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Max 30 backup downloads per hour per IP (admin-only endpoint)
const backupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: "Çok fazla yedek indirme isteği. Lütfen bir saat sonra tekrar deneyin.",
});

// GET /api/system/backup
router.get("/backup", protect, backupLimiter, (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin") {
        return res.status(403).json({ error: "Sadece yöneticiler yedek alabilir" });
    }

    try {
        // Export directly from in-memory sql.js — always current, works on Vercel (/tmp) too
        const data = (db as any).exportDb() as Buffer;
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
        const filename = `SanalOyuncular_Backup_${timestamp}.sqlite`;

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", data.length);
        res.send(data);
    } catch (error: any) {
        console.error("Backup failed:", error.message);
        res.status(500).json({ error: "Yedek alınamadı." });
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
        const result = await (db as any).restore(req.file.buffer);
        if (result?.restarting) {
            return res.json({
                success: true,
                restarting: true,
                message: "Veritabanı geri yüklendi. Sistem yeniden başlatılıyor, lütfen 5 saniye bekleyin."
            });
        }
        res.json({ success: true, message: "Veritabanı başarıyla geri yüklendi" });
    } catch (error: any) {
        console.error("Restore failed:", error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: "Geri yükleme başarısız." });
    }
});

export default router;
