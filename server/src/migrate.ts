import db from "./db";

async function run() {
    await db.ready();
    console.log("Database Ready. Running migrations...");
    
    // 1. users.profile_picture
    try {
        db.exec("ALTER TABLE users ADD COLUMN profile_picture TEXT DEFAULT '';");
        console.log("✅ Added profile_picture to users");
    } catch (e) {}

    // 2. verification_codes table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        `);
        console.log("✅ Created verification_codes table");
    } catch (e) {
        console.error("❌ Failed to create verification_codes:", e);
    }

    console.log("Migration complete.");
}

run();
