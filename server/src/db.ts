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
  private _saveTimeout: NodeJS.Timeout | null = null;

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
        if (fs.existsSync(p)) { wasmBinary = fs.readFileSync(p); break; }
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
    if (!this.db) throw new Error("Database not initialized / Offline.");
    return this.db;
  }

  /**
   * Debounced Save to prevent OOM.
   * sql.js.export() is very memory intensive.
   */
  private save(): void {
    if (this._saveTimeout) return;
    
    this._saveTimeout = setTimeout(() => {
      if (this.isRestoring || !this.db) {
        this._saveTimeout = null;
        return;
      }
      try {
        const data = this.db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      } catch (e) {
        console.warn("⚠️ DB Backup skip (possible OOM or Lock):", e);
      } finally {
        this._saveTimeout = null;
      }
    }, 2000); // Wait 2s before writing to disk
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
        let stmt;
        try {
          stmt = database.prepare(sql);
          if (params.length > 0) stmt.bind(wrapper.normalizeParams(params));
          const results: any[] = [];
          while (stmt.step()) results.push(stmt.getAsObject());
          return results;
        } finally {
          if (stmt) stmt.free();
        }
      },
      get(...params: any[]): any {
        let stmt;
        try {
          stmt = database.prepare(sql);
          if (params.length > 0) stmt.bind(wrapper.normalizeParams(params));
          let result: any = undefined;
          if (stmt.step()) result = stmt.getAsObject();
          return result;
        } finally {
          if (stmt) stmt.free();
        }
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

  async restore(buffer: Buffer): Promise<void> {
    await this.ready();
    this.isRestoring = true;
    
    try {
      if (!this.sqlHandle) throw new Error("SQL handle not available");
      
      if (this.db) {
        try { this.db.close(); } catch (e) {}
        this.db = null;
      }

      fs.writeFileSync(DB_PATH, buffer);
      this.db = new this.sqlHandle.Database(new Uint8Array(buffer));
      this.db.run("PRAGMA foreign_keys = ON;");
      
      console.log("✅ Database hot-reloaded success");
    } catch (err: any) {
      console.error(`❌ Restore failed: ${err.message}`);
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
