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

  /**
   * Finds and loads the sql-wasm.wasm binary from known candidate paths.
   * Returns a safe, standalone ArrayBuffer (not a view into a shared Buffer pool).
   */
  private loadWasmBinary(): ArrayBuffer {
    const wasmCandidates = [
      path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      "/var/task/node_modules/sql.js/dist/sql-wasm.wasm",
      path.join(__dirname, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(__dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    ];

    for (const p of wasmCandidates) {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      }
    }
    throw new Error("sql-wasm.wasm not found.");
  }

  /**
   * Creates a brand-new sql.js WASM engine instance.
   * Calling this on restore gives a completely fresh WASM heap — no corruption risk.
   */
  private async initSqlEngine(): Promise<void> {
    this.sqlHandle = await initSqlJs({ wasmBinary: this.loadWasmBinary() });
  }

  private async initialize(): Promise<void> {
    try {
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      await this.initSqlEngine();

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

  /** Exports the current in-memory database as a Buffer. Safe to call at any time. */
  exportDb(): Buffer {
    return Buffer.from(this.getDb().export());
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

  /**
   * Restores the database from a backup buffer.
   *
   * Strategy:
   * 1. Always write the file to disk first (safe, reversible).
   * 2. Attempt an in-process hot-reload (close → drop old WASM refs → yield for GC → reinit).
   * 3. If the in-process reload fails (e.g. WASM heap OOM from stale allocations),
   *    trigger process.exit(0) so the supervisor (nodemon) restarts cleanly from the new file.
   *
   * Returns { restarting: true } when the process is about to exit so the caller can
   * send an appropriate response before the exit fires.
   */
  async restore(buffer: Buffer): Promise<{ restarting: boolean }> {
    await this.ready();
    this.isRestoring = true;

    // Cancel any pending debounced save before tearing down the DB
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }

    // Step 1: Write to disk unconditionally — this is always safe.
    try {
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err: any) {
      this.isRestoring = false;
      throw new Error(`Veritabanı dosyası diske yazılamadı: ${err.message}`);
    }

    // Step 2: Try in-process hot-reload.
    // Strategy A: close old DB, reload in the SAME WASM engine (no double-memory pressure).
    // This works when the heap is not too fragmented (typical on Vercel / fresh Lambda).
    // Strategy B: if A fails, reinitialize the WASM engine entirely (fresh heap).
    // This works when the heap is fragmented (typical on long-running local dev processes).
    // If both fail locally → process.exit(1) so supervisor restarts cleanly.
    // If both fail on Vercel → return success (file is on disk, next cold start will load it).
    let strategyAError: string | null = null;

    // --- Strategy A: same WASM engine ---
    try {
      if (this.db) {
        try { this.db.close(); } catch (e) {}
        this.db = null;
      }
      await new Promise<void>(resolve => setImmediate(resolve));
      if (!this.sqlHandle) throw new Error("WASM engine unavailable — skipping to strategy B");
      this.db = new this.sqlHandle.Database(new Uint8Array(buffer));
      this.db.run("PRAGMA foreign_keys = ON;");
      console.log("✅ Database restored (same WASM engine)");
      return { restarting: false };
    } catch (errA: any) {
      strategyAError = errA instanceof Error ? errA.message : String(errA);
      console.warn(`⚠️ Strategy A failed (${strategyAError}), trying Strategy B...`);
      this.db = null;
    }

    // --- Strategy B: fresh WASM engine ---
    try {
      this.sqlHandle = null;  // Drop reference → eligible for GC
      await new Promise<void>(resolve => setImmediate(resolve));
      await this.initSqlEngine();
      this.db = new this.sqlHandle.Database(new Uint8Array(buffer));
      this.db.run("PRAGMA foreign_keys = ON;");
      console.log("✅ Database restored (fresh WASM engine)");
      return { restarting: false };
    } catch (errB: any) {
      const msg = errB instanceof Error ? errB.message : String(errB);
      console.error(`⚠️ Both strategies failed. A: ${strategyAError} | B: ${msg}. File is on disk.`);

      if (!process.env.VERCEL) {
        // Local: supervisor will restart the process and load the new file cleanly.
        setTimeout(() => process.exit(1), 800);
        return { restarting: true };
      }
      // Vercel: file is written to disk. Current Lambda instance is degraded.
      // Next cold start will load the restored DB automatically.
      // Return success so the user knows the file was saved — don't show a 500 error.
      return { restarting: false };
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
