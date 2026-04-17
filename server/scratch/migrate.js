
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const dbPath = 'c:\\agProjects\\SanalOyuncular\\server\\data\\webdb.sqlite';
    const wasmPath = 'c:\\agProjects\\SanalOyuncular\\server\\node_modules\\sql.js\\dist\\sql-wasm.wasm';
    
    if (!fs.existsSync(dbPath)) {
        console.log("❌ DB file not found");
        return;
    }
    
    const wasmBinary = fs.readFileSync(wasmPath);
    const SQL = await initSqlJs({ wasmBinary: wasmBinary });
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    console.log("Creating table member_legal_records...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS member_legal_records (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        approved_at TEXT NOT NULL DEFAULT (datetime('now')),
        contract_content TEXT NOT NULL DEFAULT '',
        ip_address TEXT DEFAULT '',
        user_agent TEXT DEFAULT ''
      );
    `);
    
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    console.log("✅ Migration successful!");
}

migrate().catch(console.error);
