import { Router, Response } from "express";
import db from "../db";
import { protect, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface LegalRecordRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  approved_at: string;
  contract_content: string;
  ip_address: string;
  user_agent: string;
}

// GET /api/admin/legal-records
// Admin only list of all compliance records
router.get("/legal-records", protect, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler bu verileri görebilir." });
  }

  try {
    const rows = await db.prepare("SELECT * FROM member_legal_records ORDER BY approved_at DESC").all() as LegalRecordRow[];
    
    const results = rows.map(row => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      approvedAt: row.approved_at,
      contractContent: row.contract_content,
      ipAddress: row.ip_address,
      userAgent: row.user_agent
    }));

    res.json(results);
  } catch (error: any) {
    console.error("Fetch legal records failed:", error);
    res.status(500).json({ error: "Sözleşme kayıtları yüklenemedi." });
  }
});

export default router;
