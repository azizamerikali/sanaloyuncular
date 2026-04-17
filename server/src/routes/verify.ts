import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import db from "../db";

const router = Router();

// Strict rate limiter for verification endpoints (max 10 per 15 min per IP)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Çok fazla doğrulama isteği yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
});

// POST /api/verify/send
router.post("/send", verifyLimiter, (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "E-posta adresi gereklidir." });
    }

    // Generate 6-digit code using cryptographically secure random
    const code = crypto.randomInt(100000, 1000000).toString();
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    // Set expiry (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    try {
        // Clean up old codes for this email
        db.prepare("DELETE FROM verification_codes WHERE email = ?").run(email);

        // Save new code
        db.prepare(
            "INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)"
        ).run(id, email, code, expiresAt);

        // TODO: Replace with real email sending (SMTP/SES/etc.)
        // Code is intentionally not logged to avoid exposing secrets in server output.

        res.json({ success: true, message: "Doğrulama kodu gönderildi." });
    } catch (error: any) {
        console.error("Verification send failed:", error);
        res.status(500).json({ error: "Kod gönderilemedi." });
    }
});

// POST /api/verify/check
router.post("/check", verifyLimiter, (req: Request, res: Response) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ error: "E-posta ve kod gereklidir." });
    }

    try {
        const row = db.prepare(
            "SELECT * FROM verification_codes WHERE email = ? AND code = ? AND status = 'pending'"
        ).get(email, code) as any;

        if (!row) {
            return res.status(400).json({ error: "Geçersiz kod." });
        }

        const now = new Date().toISOString();
        if (row.expires_at < now) {
            return res.status(400).json({ error: "Kodun süresi dolmuş." });
        }

        // 1. Mark code as used
        db.prepare("UPDATE verification_codes SET status = 'verified' WHERE id = ?").run(row.id);

        // 2. Activate User
        const result = db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run(email);

        if (result.changes === 0) {
            return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        }

        res.json({ success: true, message: "Hesabınız başarıyla aktifleştirildi." });
    } catch (error: any) {
        console.error("Verification check failed:", error);
        res.status(500).json({ error: "Doğrulama sırasında bir hata oluştu." });
    }
});

// POST /api/verify/legal-approve
// Only activates accounts created within the last 2 hours to prevent
// unauthorized activation of existing pending accounts.
router.post("/legal-approve", verifyLimiter, (req: Request, res: Response) => {
    const { email, version } = req.body;
    if (!email) {
        return res.status(400).json({ error: "E-posta gereklidir." });
    }

    try {
        // Verify the account exists, is still pending, and was created recently (within 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const user = db.prepare(
            "SELECT id FROM users WHERE email = ? AND status = 'pending' AND created_at > ?"
        ).get(email, twoHoursAgo) as { id: string } | undefined;

        if (!user) {
            return res.status(400).json({ error: "Geçerli bir bekleyen kayıt bulunamadı." });
        }

        // 1. Activate User
        db.prepare("UPDATE users SET status = 'active' WHERE email = ? AND status = 'pending'").run(email);

        // 2. Record Consent (Legacy table)
        const consentId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        const acceptedAt = new Date().toISOString();
        db.prepare(
            "INSERT INTO consents (id, user_id, version, accepted_at, ip_address) VALUES (?, ?, ?, ?, ?)"
        ).run(consentId, user.id, version || "Registration_Legal_v1", acceptedAt, req.ip || req.socket?.remoteAddress || "unknown");

        // 3. Record Detailed Legal Archive (New table)
        const { firstName, lastName, legalText } = req.body;
        
        // Prevent duplicate records for the same email if one was already created recently (e.g. within 1 minute)
        // to handle potential double-clicks or retry logic in frontend.
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const existingRecord = db.prepare(
            "SELECT id FROM member_legal_records WHERE email = ? AND approved_at > ?"
        ).get(email, oneMinuteAgo);

        if (!existingRecord) {
            const recordId = "LR_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
            db.prepare(
                "INSERT INTO member_legal_records (id, email, first_name, last_name, approved_at, contract_content, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run(
                recordId, 
                email, 
                firstName || "", 
                lastName || "", 
                acceptedAt, 
                legalText || "", 
                req.ip || "unknown", 
                req.headers["user-agent"] || "unknown"
            );
        }

        res.json({ success: true, message: "Sözleşme onaylandı ve hesabınız aktifleştirildi." });
    } catch (error: any) {
        console.error("Legal approval failed:", error);
        res.status(500).json({ error: "Onay işlemi sırasında bir hata oluştu." });
    }
});

export default router;
