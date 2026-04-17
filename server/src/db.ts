import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.VERCEL 
  ? path.join("/tmp", "webdb.sqlite")
  : path.join(__dirname, "..", "data", "webdb.sqlite");

class DatabaseWrapper {
  private db: SqlJsDatabase | null = null;
  private initPromise: Promise<void>;
  private sqlHandle: any = null;
  private isRestoring: boolean = false;

  constructor() {
    this.initPromise = this.initialize().catch(err => {
      console.error(`❌ Global Database Initialization Error: ${err.message}`);
    });
    this.initPromise.catch(() => {});
  }

  private async initialize(): Promise<void> {
    try {
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const wasmCandidates = [
        path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
        "/var/task/node_modules/sql.js/dist/sql-wasm.wasm",
        path.join(__dirname, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
        path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
        path.join(__dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      ];

      let wasmBinary: Buffer | undefined;
      for (const p of wasmCandidates) {
        if (fs.existsSync(p)) {
          wasmBinary = fs.readFileSync(p);
          console.log(`✅ sql.js WASM loaded from: ${p}`);
          break;
        }
      }

      if (!wasmBinary) throw new Error(`sql-wasm.wasm not found.`);

      const wasmArrayBuffer = wasmBinary.buffer.slice(
        wasmBinary.byteOffset,
        wasmBinary.byteOffset + wasmBinary.byteLength
      ) as ArrayBuffer;
      
      this.sqlHandle = await initSqlJs({ wasmBinary: wasmArrayBuffer });

      if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        this.db = new this.sqlHandle.Database(new Uint8Array(buffer));
      } else {
        this.db = new this.sqlHandle.Database();
      }

      this.db.run("PRAGMA foreign_keys = ON;");
      console.log(`✅ Database initialized at ${DB_PATH}`);
    } catch (err: any) {
      console.error(`❌ Database Initialization Failed: ${err.message}`);
      throw err;
    }
  }

  async ready(): Promise<void> {
    try {
      await this.initPromise;
      // Wait if a restore is in progress
      while (this.isRestoring) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err: any) {
      throw new Error(`Database failed to initialize: ${err.message}`);
    }
  }

  getDbPath(): string {
    return DB_PATH;
  }

  private getDb(): SqlJsDatabase {
    if (!this.db) throw new Error("Database not initialized. Call await db.ready() first.");
    return this.db;
  }

  private save(): void {
    if (this.isRestoring) return; // Don't save while restoring
    const data = this.getDb().export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  exec(sql: string): void {
    this.getDb().exec(sql);
    this.save();
  }

  prepare(sql: string) {
    const database = this.getDb();
    const wrapper = this;

    return {
      all(...params: any[]): any[] {
        const stmt = database.prepare(sql);
        if (params.length > 0) stmt.bind(wrapper.normalizeParams(params));
        const results: any[] = [];
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      },
      get(...params: any[]): any {
        const stmt = database.prepare(sql);
        if (params.length > 0) stmt.bind(wrapper.normalizeParams(params));
        let result: any = undefined;
        if (stmt.step()) result = stmt.getAsObject();
        stmt.free();
        return result;
      },
      run(...params: any[]): { changes: number } {
        if (params.length > 0) database.run(sql, wrapper.normalizeParams(params));
        else database.run(sql);
        const changesRow = database.exec("SELECT changes() as changes");
        const changes = changesRow.length > 0 && changesRow[0].values.length > 0 ? (changesRow[0].values[0][0] as number) : 0;
        wrapper.save();
        return { changes };
      },
    };
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.getDb().run("BEGIN TRANSACTION");
      try {
        const result = fn();
        this.getDb().run("COMMIT");
        this.save();
        return result;
      } catch (e) {
        this.getDb().run("ROLLBACK");
        throw e;
      }
    };
  }

  /**
   * Safe Hot-Reloading Restore.
   * Follows user's logic: Close -> Load -> Open while ensuring atomicity.
   */
  async restore(buffer: Buffer): Promise<void> {
    await this.ready();
    this.isRestoring = true;
    
    try {
      if (!this.sqlHandle) throw new Error("SQL handle not available");

      const uint8Array = new Uint8Array(buffer);
      
      // 1. Create the NEW database instance BEFORE closing the old one.
      // This validates the buffer before we touch the current state.
      const newDb = new this.sqlHandle.Database(uint8Array);
      newDb.run("PRAGMA foreign_keys = ON;");

      // 2. ONLY NOW write to disk (physical part)
      fs.writeFileSync(DB_PATH, buffer);
      
      // 3. Safely swap the pointers (the "Close -> Load -> Open" part)
      const oldDb = this.db;
      this.db = newDb;

      if (oldDb) {
        try { oldDb.close(); } catch (e) { console.warn("Old DB close warn:", e); }
      }
      
      console.log("♻️ Database successfully hot-swapped during restore");
    } catch (err: any) {
      console.error(`❌ Atomic Restore failed: ${err.message || 'Unknown error'}`);
      throw err;
    } finally {
      this.isRestoring = false;
    }
  }

  pragma(_statement: string): void { }

  private normalizeParams(params: any[]): any[] {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params;
  }
}

let dbInstance: DatabaseWrapper | null = null;
const db = new Proxy({} as DatabaseWrapper, {
  get: (target, prop, receiver) => {
    if (!dbInstance) dbInstance = new DatabaseWrapper();
    return Reflect.get(dbInstance, prop, receiver);
  }
});

export default db;
