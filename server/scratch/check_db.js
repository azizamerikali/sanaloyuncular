
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkDb() {
    const dbPath = 'c:\\agProjects\\SanalOyuncular\\server\\data\\webdb.sqlite';
    const wasmPath = 'c:\\agProjects\\SanalOyuncular\\server\\node_modules\\sql.js\\dist\\sql-wasm.wasm';
    
    if (!fs.existsSync(dbPath)) {
        console.log("❌ DB file not found at " + dbPath);
        return;
    }
    
    const wasmBinary = fs.readFileSync(wasmPath);
    const SQL = await initSqlJs({ wasmBinary: wasmBinary });
    
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    console.log("--- Tables ---");
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(JSON.stringify(tables, null, 2));
    
    console.log("\n--- Member Legal Records Count ---");
    const count = db.exec("SELECT COUNT(*) FROM member_legal_records");
    console.log(JSON.stringify(count, null, 2));
    
    console.log("\n--- Last 5 Records ---");
    const last = db.exec("SELECT id, email, approved_at FROM member_legal_records ORDER BY approved_at DESC LIMIT 5");
    console.log(JSON.stringify(last, null, 2));
}

checkDb().catch(console.error);
