import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import db from "../db";
import { encryptField, decryptField } from "../utils/cryptoUtil";
import { protect, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  status: string;
  created_at: string;
  password?: string;
  birth_date: string;
  parent_name: string;
  consent_document: string;
  iban: string;
  iban_holder: string;
  city: string;
  acting_training: string;
  acting_experience: string;
  profile_picture: string;
}

function maskIban(iban: string): string {
  if (!iban || iban.length < 6) return iban;
  return iban.slice(0, 4) + "*".repeat(iban.length - 8) + iban.slice(-4);
}

// Full response — for own profile only
function toApi(row: UserRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: decryptField(row.phone),
    address: decryptField(row.address),
    role: row.role,
    status: row.status,
    birthDate: row.birth_date,
    parentName: row.parent_name,
    consentDocument: row.consent_document,
    iban: decryptField(row.iban),
    ibanHolder: row.iban_holder,
    city: row.city,
    actingTraining: row.acting_training,
    actingExperience: row.acting_experience,
    profilePicture: row.profile_picture,
    createdAt: row.created_at,
  };
}

// Masked response — for list endpoints (hides full IBAN)
function toApiMasked(row: UserRow) {
  const full = toApi(row);
  return { ...full, iban: maskIban(full.iban) };
}

// GET /api/users — all users (optional query: role, status)
router.get("/", protect, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "client") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece admin veya müşteriler üyeleri listeleyebilir." });
  }

  let sql = "SELECT * FROM users WHERE 1=1";
  const params: string[] = [];

  if (req.query.role) {
    sql += " AND role = ?";
    params.push(req.query.role as string);
  }
  if (req.query.status) {
    sql += " AND status = ?";
    params.push(req.query.status as string);
  }

  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...params) as UserRow[];
  res.json(rows.map(toApiMasked));
});

// GET /api/users/count
router.get("/count", protect, (_req: Request, res: Response) => {
  const total = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  const members = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'member'").get() as { cnt: number };
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE status = 'pending'").get() as { cnt: number };
  res.json({ total: total.cnt, members: members.cnt, pending: pending.cnt });
});

// GET /api/users/:id
router.get("/:id", protect, (req: AuthenticatedRequest, res: Response) => {
  // Admin: any user; Client: only their own profile; Member: only their own profile
  if (req.user?.role !== "admin" && req.user?.id !== req.params.id) {
    return res.status(403).json({ error: "Erişim engellendi." });
  }

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
  if (!row) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  res.json(toApi(row));
});

// POST /api/users
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      id: reqId, firstName, lastName, email, phone, address, password,
      birthDate, parentName, consentDocument, iban, ibanHolder, city,
      actingTraining, actingExperience, profilePicture,
      initialPhotos // Array of {fileName, fileData}
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: "E-posta adresi gereklidir." });
    }

    // Check if user already exists
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(400).json({ error: "Bu e-posta adresi ile zaten bir kayıt bulunuyor." });
    }

    const id = reqId || Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const createdAt = new Date().toISOString();

    // Hash password with bcrypt (salt rounds: 12)
    const passwordHash = password ? await bcrypt.hash(password, 12) : "";

    const userStatus = req.body.status || "pending";
    const userRole = req.body.role || "member";

    // 1. Insert User
    await db.prepare(
      "INSERT INTO users (id, first_name, last_name, email, phone, address, password, role, status, birth_date, parent_name, consent_document, iban, iban_holder, city, acting_training, acting_experience, profile_picture, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, firstName || "", lastName || "", email || "", encryptField(phone || ""), encryptField(address || ""), passwordHash, userRole, userStatus, birthDate || "", parentName || "", consentDocument || "", encryptField(iban || ""), ibanHolder || "", city || "", actingTraining || "", actingExperience || "", profilePicture || "", createdAt);

    // Auto-create legal record if created as active member
    if (userStatus === "active" && userRole === "member") {
      const recordId = "LR_ADM_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      await db.prepare(
        "INSERT INTO member_legal_records (id, email, first_name, last_name, approved_at, contract_content, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        recordId,
        email,
        firstName || "",
        lastName || "",
        createdAt,
        "Bu üye yönetici tarafından manuel olarak sisteme eklenmiş ve onaylanmıştır. (Administratively Approved)",
        "Admin Panel",
        "Server Internal"
      );
      console.log(`📜 Auto-created legal record for new member ${email} (Admin creation)`);
    }

    // 2. Insert Initial Photos into Media table if provided
    if (Array.isArray(initialPhotos)) {
      const insertMedia = db.prepare(
        "INSERT INTO media (id, user_id, file_name, file_path, file_data, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const photo of initialPhotos) {
        const mediaId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        await insertMedia.run(
          mediaId,
          id,
          photo.fileName || "Registration Photo",
          "",
          encryptField(photo.fileData || ""),
          createdAt
        );
      }
    }

    res.status(201).json({ id, firstName, lastName, email, phone, address, profilePicture, role: userRole, status: userStatus, createdAt });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Kayıt işlemi sırasında sunucu hatası oluştu." });
  }
});

// PUT /api/users/:id
router.put("/:id", protect, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.id !== req.params.id) {
    return res.status(403).json({ error: "Erişim engellendi." });
  }

  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow | undefined;
  if (!existing) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const { firstName, lastName, email, phone, address, role, status, birthDate, parentName, consentDocument, iban, ibanHolder, city, actingTraining, actingExperience, profilePicture } = req.body;

  await db.prepare(
    "UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, role = ?, status = ?, birth_date = ?, parent_name = ?, consent_document = ?, iban = ?, iban_holder = ?, city = ?, acting_training = ?, acting_experience = ?, profile_picture = ? WHERE id = ?"
  ).run(
    firstName ?? existing.first_name,
    lastName ?? existing.last_name,
    email ?? existing.email,
    phone !== undefined ? encryptField(phone) : existing.phone,
    address !== undefined ? encryptField(address) : existing.address,
    role ?? existing.role,
    status ?? existing.status,
    birthDate ?? existing.birth_date,
    parentName ?? existing.parent_name,
    consentDocument ?? existing.consent_document,
    iban !== undefined ? encryptField(iban) : existing.iban,
    ibanHolder ?? existing.iban_holder,
    city ?? existing.city,
    actingTraining ?? existing.acting_training,
    actingExperience ?? existing.acting_experience,
    profilePicture ?? existing.profile_picture,
    req.params.id
  );

  // Check if status is transitioning to active to auto-create legal record if missing
  if (status === "active" && existing.status !== "active" && existing.role === "member") {
    try {
      const targetEmail = email ?? existing.email;
      const recordExists = db.prepare("SELECT id FROM member_legal_records WHERE email = ?").get(targetEmail);
      
      if (!recordExists) {
        const recordId = "LR_ADM_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        await db.prepare(
          "INSERT INTO member_legal_records (id, email, first_name, last_name, approved_at, contract_content, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          recordId,
          targetEmail,
          firstName ?? existing.first_name,
          lastName ?? existing.last_name,
          new Date().toISOString(),
          "Bu üye yönetici tarafından manuel olarak aktif hale getirilmiştir. Sistem onayı otomatik olarak arşivlenmiştir. (Administratively Approved)",
          "Admin Panel",
          "Server Internal"
        );
        console.log(`📜 Auto-created legal record for ${targetEmail} (Admin activation)`);
      }
    } catch (err) {
      console.error("Failed to auto-create legal record during admin activation:", err);
    }
  }

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as UserRow;
  res.json(toApi(updated));
});

// DELETE /api/users/:id
router.delete("/:id", protect, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Erişim engellendi. Sadece adminler silebilir." });
  }

  const result = await db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  res.json({ success: true });
});

export default router;
