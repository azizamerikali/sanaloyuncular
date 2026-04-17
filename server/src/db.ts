import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "webdb.sqlite")
  : path.join(__dirname, "..", "data", "webdb.sqlite");

const BLOB_PATHNAME = "webdb/production.sqlite";

/** Upload DB buffer to Vercel Blob (overwrites). No-op if not on Vercel or token missing. */
async function uploadToBlob(buffer: Buffer): Promise<void> {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.VERCEL) {
    console.log("ℹ️ [DB-SYNC] Skipping Blob upload (not on Vercel environment)");
    return;
  }
  if (!hasToken) {
    console.error("❌ [DB-SYNC] CRITICAL: BLOB_READ_WRITE_TOKEN is missing in environment variables!");
    return;
  }

  try {
    console.log(`[DB-SYNC] Attempting to upload to Vercel Blob (${buffer.byteLength} bytes)...`);
    const { put } = await import("@vercel/blob");
    
    // Omit 'access' entirely to let the store configuration decide
    const result = await put(BLOB_PATHNAME, buffer, {
      addRandomSuffix: false,
      contentType: "application/octet-stream",
    });
    
    console.log(`✅ [DB-SYNC] SUCCESS! DB uploaded to Vercel Blob. URL: ${result.url}`);
  } catch (e: any) {
    console.error("❌ [DB-SYNC] FATAL: Blob upload failed with error:", e.message);
    if (e.stack) console.error(e.stack);
  }
}

/** Download DB from Vercel Blob. Returns null if not found or token missing. */
async function downloadFromBlob(): Promise<Buffer | null> {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!process.env.VERCEL) return null;
  if (!hasToken) {
    console.warn("⚠️ [DB-LOAD] Skipping download: BLOB_READ_WRITE_TOKEN missing.");
    return null;
  }

  try {
    console.log("[DB-LOAD] Checking Vercel Blob for existing database...");
    const { list, get } = await import("@vercel/blob");
    const { blobs } = await list(); // List all to be safe and find by pathname
    const target = blobs.find(b => b.pathname === BLOB_PATHNAME || b.pathname.endsWith(BLOB_PATHNAME));
    
    if (!target) {
      console.log("ℹ️ [DB-LOAD] No existing DB blob found in storage — starting with fresh database.");
      return null;
    }
    
    console.log(`[DB-LOAD] Found blob at ${target.url}. Downloading...`);
    const resp = await fetch(target.url);
    const ab = await resp.arrayBuffer();
    
    console.log(`✅ [DB-LOAD] SUCCESS! Loaded from Vercel Blob (${ab.byteLength} bytes)`);
    return Buffer.from(ab);
  } catch (e: any) {
    console.error("❌ [DB-LOAD] FATAL: Blob download failed:", e.message);
    return null;
  }
}

class DatabaseWrapper {
  private db: SqlJsDatabase | null = null;
  private initPromise: Promise<void>;
  private sqlHandle: any = null;
  private _saveTimeout: NodeJS.Timeout | null = null;
  private _skipSave: boolean = false;

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

      // On Vercel: try to restore DB from Blob Storage (persists across cold starts)
      if (process.env.VERCEL) {
        const blobBuffer = await downloadFromBlob();
        if (blobBuffer) {
          fs.writeFileSync(DB_PATH, blobBuffer); // cache in /tmp too
          this.db = new this.sqlHandle.Database(new Uint8Array(blobBuffer));
          this.db.run("PRAGMA foreign_keys = ON;");
          console.log(`✅ Database initialized from Vercel Blob`);
          return;
        }
        // No blob yet — start fresh (first deploy or blob was deleted)
        this.db = new this.sqlHandle.Database();
      } else if (fs.existsSync(DB_PATH)) {
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

  /** Sets whether to skip auto-saving during bulk operations. */
  setSkipSave(skip: boolean): void {
    this._skipSave = skip;
  }

  /**
   * Save: writes to disk (local) or Vercel Blob (production).
   */
  async save(): Promise<void> {
    // If we're already saving or restoring, don't overlap. Also skip if _skipSave is true.
    if (this.isRestoring || !this.db || this._skipSave) return;

    const performSave = async () => {
      try {
        const data = this.db!.export();
        const buffer = Buffer.from(data);
        if (!process.env.VERCEL) {
          fs.writeFileSync(DB_PATH, buffer);
        } else {
          // Write to /tmp as fast local cache + persist to Blob (AWAIT this)
          try { fs.writeFileSync(DB_PATH, buffer); } catch (_) {}
          await uploadToBlob(buffer);
        }
      } catch (e) {
        console.warn("⚠️ DB save failed:", e);
      }
    };

    if (process.env.VERCEL) {
      // Production: Always await to ensure persistence before function termination
      await performSave();
    } else {
      // Local: Use debounce to keep performance snappy
      if (this._saveTimeout) return;
      this._saveTimeout = setTimeout(async () => {
        await performSave();
        this._saveTimeout = null;
      }, 1000);
    }
  }

  async exec(sql: string): Promise<void> {
    await this.ready();
    this.getDb().exec(sql);
    await this.save();
  }

  prepare(sql: string) {
    const wrapper = this;

    return {
      async all(...params: any[]): Promise<any[]> {
        await wrapper.ready();
        const database = wrapper.getDb();
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
      async get(...params: any[]): Promise<any> {
        await wrapper.ready();
        const database = wrapper.getDb();
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
      async run(...params: any[]): Promise<{ changes: number }> {
        await wrapper.ready();
        const database = wrapper.getDb();
        if (params.length > 0) database.run(sql, wrapper.normalizeParams(params));
        else database.run(sql);
        const changesRow = database.exec("SELECT changes() as changes");
        const changes = changesRow.length > 0 && changesRow[0].values.length > 0 ? (changesRow[0].values[0][0] as number) : 0;
        await wrapper.save();
        return { changes };
      },
    };
  }

  transaction<T>(fn: () => T): () => Promise<T> {
    return async () => {
      await this.ready();
      this.getDb().run("BEGIN TRANSACTION");
      try {
        const result = fn();
        this.getDb().run("COMMIT");
        await this.save();
        return result;
      } catch (e) {
        this.getDb().run("ROLLBACK");
        throw e;
      }
    };
  }

  /**
   * Restores the database from a backup buffer.
   * On Vercel, also uploads the new DB to Blob Storage immediately (no wait for debounce).
   */
  async restore(buffer: Buffer): Promise<{ restarting: boolean }> {
    await this.ready();
    this.isRestoring = true;

    // Cancel any pending debounced save before tearing down the DB
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }

    // Step 1: Persist unconditionally — disk + Blob (Vercel)
    try {
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err: any) {
      this.isRestoring = false;
      throw new Error(`Veritabanı dosyası diske yazılamadı: ${err.message}`);
    }

    // Upload to Blob immediately (before in-memory reload, so data is safe even if reload fails)
    if (process.env.VERCEL) {
      await uploadToBlob(buffer);
    }

    // Strategy A: same WASM engine
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
      const strategyAError = errA instanceof Error ? errA.message : String(errA);
      console.warn(`⚠️ Strategy A failed (${strategyAError}), trying Strategy B...`);
      this.db = null;
    }

    // Strategy B: fresh WASM engine
    try {
      this.sqlHandle = null;
      await new Promise<void>(resolve => setImmediate(resolve));
      await this.initSqlEngine();
      this.db = new this.sqlHandle.Database(new Uint8Array(buffer));
      this.db.run("PRAGMA foreign_keys = ON;");
      console.log("✅ Database restored (fresh WASM engine)");
      return { restarting: false };
    } catch (errB: any) {
      const msg = errB instanceof Error ? errB.message : String(errB);
      console.error(`⚠️ Both strategies failed. B: ${msg}. File is on disk/blob.`);

      if (!process.env.VERCEL) {
        setTimeout(() => process.exit(1), 800);
        return { restarting: true };
      }
      // Vercel: file saved to blob, next cold start will load correctly.
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
