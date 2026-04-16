import db from "./db";
import bcrypt from "bcryptjs";
import { encryptField } from "./utils/cryptoUtil";

async function seed() {
  await db.ready();

  // ── Schema ──────────────────────────────────────────────────────────
  console.log("🔧 Creating schema...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      birth_date TEXT DEFAULT '',
      parent_name TEXT DEFAULT '',
      consent_document TEXT DEFAULT '',
      iban TEXT DEFAULT '',
      iban_holder TEXT DEFAULT '',
      city TEXT DEFAULT '',
      acting_training TEXT DEFAULT '',
      acting_experience TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      file_path TEXT NOT NULL DEFAULT '',
      file_data TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0',
      accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      UNIQUE(project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT (date('now')),
      gross_amount REAL NOT NULL DEFAULT 0,
      deduction REAL NOT NULL DEFAULT 0,
      net_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS consent_text (
      id INTEGER PRIMARY KEY DEFAULT 1,
      content TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Check if already seeded
  const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number } | undefined;
  if (userCount && userCount.cnt > 0) {
    console.log("✅ Database already seeded, skipping.");
    process.exit(0);
    return;
  }

  console.log("🌱 Seeding data...");

  // Users — passwords are hashed with bcrypt at seed time
  const insertUser = db.prepare(
    "INSERT INTO users (id, first_name, last_name, email, phone, address, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // [id, firstName, lastName, email, phone, address, plaintextPassword, role, status, createdAt]
  const usersRaw = [
    ["admin1",  "Aziz",   "Amerikalı","azizakal@gmail.com",   "05321234567", "İstanbul",           "Q1w2e3r!", "admin",  "active",   "2025-01-15T10:00:00Z"],
    ["admin2",  "Ufuk",   "Tosun",  "uufuktosun@gmail.com",  "05321234567", "İstanbul",           "Q1w2e3r!", "admin",  "active",   "2025-04-10T10:00:00Z"],
    ["member1", "Elif",   "Kaya",   "elif@email.com",         "05339876543", "İstanbul, Kadıköy",  "123456",   "member", "active",   "2025-02-01T09:00:00Z"],
    ["member2", "Can",    "Demir",  "can@email.com",          "05341112233", "Ankara, Çankaya",    "123456",   "member", "active",   "2025-02-15T11:00:00Z"],
    ["member3", "Zeynep", "Arslan", "zeynep@email.com",       "05354445566", "İzmir, Alsancak",    "123456",   "member", "pending",  "2025-03-20T14:00:00Z"],
    ["member4", "Burak",  "Öztürk", "burak@email.com",        "05367778899", "Antalya, Lara",      "123456",   "member", "inactive", "2025-01-20T08:00:00Z"],
    ["client1", "Mert",   "Aydın",  "mert@agency.com",        "05381122334", "İstanbul, Şişli",    "123456",   "client", "active",   "2025-02-10T10:00:00Z"],
    ["client2", "Selin",  "Çelik",  "selin@brand.com",        "05392233445", "İstanbul, Levent",   "123456",   "client", "active",   "2025-03-01T09:00:00Z"],
  ];

  for (const u of usersRaw) {
    const passwordHash = await bcrypt.hash(u[6] as string, 12);
    insertUser.run(u[0], u[1], u[2], u[3], encryptField(u[4] as string), encryptField(u[5] as string), passwordHash, u[7], u[8], u[9]);
  }

  // Media
  const insertMedia = db.prepare(
    "INSERT INTO media (id, user_id, file_name, file_path, file_data, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const mediaData = [
    ["med1", "member1", "istanbul_bogaz.jpg", "/photos/istanbul_bogaz.jpg", "", "2025-02-05T10:00:00Z"],
    ["med2", "member1", "portrait_01.jpg", "/photos/portrait_01.jpg", "", "2025-02-10T11:00:00Z"],
    ["med3", "member2", "ankara_kale.jpg", "/photos/ankara_kale.jpg", "", "2025-02-20T09:00:00Z"],
    ["med4", "member2", "product_shot.jpg", "/photos/product_shot.jpg", "", "2025-03-01T14:00:00Z"],
    ["med5", "member1", "nature_01.jpg", "/photos/nature_01.jpg", "", "2025-03-05T08:00:00Z"],
    ["med6", "member3", "izmir_kordon.jpg", "/photos/izmir_kordon.jpg", "", "2025-03-22T10:00:00Z"],
  ];
  for (const m of mediaData) {
    insertMedia.run(m[0], m[1], m[2], m[3], encryptField(m[4] as string), m[5]);
  }

  // Consents
  const insertConsent = db.prepare(
    "INSERT INTO consents (id, user_id, version, accepted_at, ip_address) VALUES (?, ?, ?, ?, ?)"
  );
  insertConsent.run("con1", "member1", "1.0", "2025-02-01T09:05:00Z", "192.168.1.10");
  insertConsent.run("con2", "member2", "1.0", "2025-02-15T11:10:00Z", "192.168.1.20");

  // Projects
  const insertProject = db.prepare(
    "INSERT INTO projects (id, name, description, created_by, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertProject.run("proj1", "İstanbul Tanıtım Kampanyası", "İstanbul'un turistik mekanlarının tanıtımı için fotoğraf projesi", "client1", "active", "2025-03-01T10:00:00Z");
  insertProject.run("proj2", "E-Ticaret Ürün Çekimi", "Online mağaza için profesyonel ürün fotoğrafları", "admin1", "active", "2025-03-10T09:00:00Z");
  insertProject.run("proj3", "Kurumsal Portre Serisi", "Şirket çalışanları için kurumsal portre fotoğrafları", "client2", "completed", "2025-02-01T08:00:00Z");

  // Assignments
  const insertAssignment = db.prepare("INSERT INTO assignments (id, project_id, user_id) VALUES (?, ?, ?)");
  insertAssignment.run("asgn1", "proj1", "member1");
  insertAssignment.run("asgn2", "proj1", "member2");
  insertAssignment.run("asgn3", "proj2", "member1");
  insertAssignment.run("asgn4", "proj3", "member2");

  // Payments
  const insertPayment = db.prepare(
    "INSERT INTO payments (id, user_id, project_id, date, gross_amount, deduction, net_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertPayment.run("pay1", "member1", "proj1", "2025-03-15", 5000, 1000, 4000, "paid");
  insertPayment.run("pay2", "member2", "proj1", "2025-03-15", 4500, 900, 3600, "paid");
  insertPayment.run("pay3", "member1", "proj2", "2025-03-25", 3000, 600, 2400, "unpaid");
  insertPayment.run("pay4", "member2", "proj3", "2025-02-28", 6000, 1200, 4800, "paid");

  // Favorites
  const insertFavorite = db.prepare("INSERT INTO favorites (id, client_id, member_id) VALUES (?, ?, ?)");
  insertFavorite.run("fav1", "client1", "member1");
  insertFavorite.run("fav2", "client1", "member2");
  insertFavorite.run("fav3", "client2", "member2");

  // Consent text
  db.prepare(
    "INSERT OR REPLACE INTO consent_text (id, content) VALUES (1, ?)"
  ).run(
    "Bu sözleşme, SanalOyuncular üzerinden yüklenen fotoğrafların proje kapsamında kullanılmasına ilişkin koşulları belirler.\n\n1. Yüklenen tüm fotoğrafların telif hakkı üyeye aittir.\n2. Platform, fotoğrafları yalnızca onaylanan projeler kapsamında kullanma hakkına sahiptir.\n3. Her kullanım için üyeye hakediş ödemesi yapılacaktır.\n4. Üye, istediği zaman fotoğraflarını platformdan kaldırabilir.\n5. Bu sözleşme, dijital onay ile kabul edilmiş sayılır.\n\nSürüm: 1.0 | Son güncelleme: 2025-01-01"
  );

  console.log("✅ Seed data inserted successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
