import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import db from "../db";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = "50993658634-7hoto049cjs26qks8m8pd87juoj96h11.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Strict rate limiter for login: max 5 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.",
  standardHeaders: true,
  legacyHeaders: false,
});

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
  profile_picture: string;
  created_at: string;
}

function toApi(row: UserRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    role: row.role,
    status: row.status,
    profilePicture: row.profile_picture,
    createdAt: row.created_at,
  };
}

// POST /api/auth/login
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: "Kullanıcı adı ve şifre gereklidir" });

  // Fetch user by ID only (no plaintext password in SQL query)
  const row = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(userId) as (UserRow & { password?: string }) | undefined;
  if (!row) return res.status(401).json({ error: "Hatalı kimlik bilgileri veya hesap aktif değil." });

  // ONLY clients and admins can use standard login
  if (row.role !== "client" && row.role !== "admin") {
    return res.status(403).json({ error: "Bu kullanıcı tipi sadece Google ile giriş yapabilir." });
  }

  // Dual-mode password check: bcrypt hash OR legacy plaintext (auto-upgrades on success)
  const storedPassword = row.password || "";
  const isBcryptHash = storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$");
  let passwordValid = false;

  if (isBcryptHash) {
    passwordValid = await bcrypt.compare(password, storedPassword);
  } else {
    // Legacy plaintext comparison — auto-upgrade to bcrypt on success
    passwordValid = storedPassword === password;
    if (passwordValid) {
      const hash = await bcrypt.hash(password, 12);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, row.id);
    }
  }

  if (!passwordValid) return res.status(401).json({ error: "Hatalı kimlik bilgileri veya hesap aktif değil." });

  const token = jwt.sign(
    { id: row.id, role: row.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "8h" }
  );

  res.json({ token, user: toApi(row) });
});

// POST /api/auth/google — authenticate via Google id_token
router.post("/google", async (req: Request, res: Response) => {
	const { idToken } = req.body;
	if (!idToken) return res.status(400).json({ error: "Google idToken gereklidir" });

	// Step 1: Verify Google token
	let email: string;
	let firstName: string;
	let lastName: string;
	try {
		const ticket = await client.verifyIdToken({
			idToken,
			audience: GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();
		if (!payload || !payload.email) return res.status(400).json({ error: "Geçersiz Google token verisi" });
		email = payload.email;
		firstName = payload.given_name || "";
		lastName = payload.family_name || "";
	} catch (error: any) {
		console.error("[Google Auth] Token verification failed:", error?.message || error);
		return res.status(401).json({ error: "Google kimliği doğrulanamadı. Lütfen tekrar deneyin." });
	}

	// Step 2: Look up user in database
	try {
		const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
		if (row) {
			if (row.status !== "active") return res.status(401).json({ error: "Hesabınız aktif değil." });

			// Clients CANNOT use Google Login
			if (row.role === "client") {
				return res.status(403).json({ error: "Müşteriler Google ile giriş yapamaz. Lütfen şifrenizle giriş yapın." });
			}

			const token = jwt.sign(
				{ id: row.id, role: row.role },
				process.env.JWT_SECRET as string,
				{ expiresIn: "8h" }
			);
			return res.json({ token, user: toApi(row) });
		} else {
			// User doesn't exist — redirect to register with prefilled details
			return res.status(404).json({
				error: "Kullanıcı bulunamadı, kayıt sayfasına yönlendiriliyor",
				googlePayload: { email, firstName, lastName }
			});
		}
	} catch (error: any) {
		console.error("[Google Auth] Database lookup failed for", email, ":", error?.message || error);
		return res.status(500).json({ error: "Sunucu hatası. Lütfen tekrar deneyin." });
	}
});

export default router;
