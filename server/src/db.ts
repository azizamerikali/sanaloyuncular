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
    if (!this.db) throw new Error("Database not initialized. Please retry in a moment.");
    return this.db;
  }

  private save(): void {
    if (this.isRestoring || !this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (e) {
      console.warn("DB save warn (auto-save skipped):", e);
    }
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
   * Final Stability Restore.
   * Closes the old DB FIRST to free WASM heap memory, then loads the new one.
   * The 'isRestoring' flag protects other requests from accessing a null DB.
   */
  async restore(buffer: Buffer): Promise<void> {
    await this.ready();
    this.isRestoring = true;
    
    try {
      if (!this.sqlHandle) throw new Error("SQL handle not available");

      const uint8Array = new Uint8Array(buffer);
      
      // 1. Physically close the old database to free WASM memory
      if (this.db) {
        try {
          this.db.close();
          console.log("🛠️ Old database closed for restore");
        } catch (e) {
          console.warn("Error while closing old DB:", e);
        }
        this.db = null;
      }

      // 2. Write new content to disk
      fs.writeFileSync(DB_PATH, buffer);
      
      // 3. Open the NEW database instance
      this.db = new this.sqlHandle.Database(uint8Array);
      this.db.run("PRAGMA foreign_keys = ON;");
      
      console.log("✅ Database successfully restored and re-opened");
    } catch (err: any) {
      console.error(`❌ Restore failed: ${err.message || 'Unknown error'}`);
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
