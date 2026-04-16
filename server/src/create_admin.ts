import db from "./db";

async function run() {
    await db.ready();
    try {
        db.prepare("INSERT INTO users (id, first_name, last_name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run("testadmin@example.com", "Admin", "User", "testadmin@example.com", "Q1w2e3r!", "admin", "active");
        console.log("✅ Temporary admin user created: testadmin@example.com / Q1w2e3r!");
    } catch (e: any) {
        console.error("❌ Failed to create user (likely already exists):", e.message);
    }
    process.exit(0);
}

run();
