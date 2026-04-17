
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function debugUsers() {
    const dbPath = 'c:\\agProjects\\SanalOyuncular\\server\\data\\webdb.sqlite';
    const wasmPath = 'c:\\agProjects\\SanalOyuncular\\server\\node_modules\\sql.js\\dist\\sql-wasm.wasm';
    
    const wasmBinary = fs.readFileSync(wasmPath);
    const SQL = await initSqlJs({ wasmBinary: wasmBinary });
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    console.log("--- Users Email List ---");
    const users = db.exec("SELECT email, status FROM users");
    console.log(JSON.stringify(users, null, 2));

    console.log("\n--- Checking for legal records table again ---");
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='member_legal_records'");
    console.log(JSON.stringify(tables, null, 2));
}

debugUsers().catch(console.error);
