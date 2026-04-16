import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.VERCEL 
  ? path.join("/tmp", "webdb.sqlite")
  : path.join(__dirname, "..", "data", "webdb.sqlite");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Wrapper around sql.js Database that provides a better-sqlite3-like API.
 * This allows all route files to use the same synchronous-style calls.
 */
class DatabaseWrapper {
  private db: SqlJsDatabase | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const SQL = await initSqlJs({
        // Load WASM from CDN for serverless reliability
        locateFile: (file) => `https://sql.js.org/dist/${file}`
      });

      if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
      }

      // Enable foreign keys
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
    const data = this.getDb().export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  /**
   * Execute raw SQL (multiple statements). Used for schema creation.
   */
  exec(sql: string): void {
    this.getDb().exec(sql);
    this.save();
  }

  /**
   * Returns a statement-like object with .all(), .get(), .run() methods.
   */
  prepare(sql: string) {
    const database = this.getDb();
    const wrapper = this;

    return {
      /**
       * Execute and return all rows as an array of objects.
       */
      all(...params: any[]): any[] {
        const stmt = database.prepare(sql);
        if (params.length > 0) {
          stmt.bind(wrapper.normalizeParams(params));
        }

        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },

      /**
       * Execute and return first row as an object, or undefined.
       */
      get(...params: any[]): any {
        const stmt = database.prepare(sql);
        if (params.length > 0) {
          stmt.bind(wrapper.normalizeParams(params));
        }

        let result: any = undefined;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },

      /**
       * Execute a statement (INSERT, UPDATE, DELETE) and return changes info.
       */
      run(...params: any[]): { changes: number } {
        if (params.length > 0) {
          database.run(sql, wrapper.normalizeParams(params));
        } else {
          database.run(sql);
        }
        const changesRow = database.exec("SELECT changes() as changes");
        const changes = changesRow.length > 0 && changesRow[0].values.length > 0
          ? (changesRow[0].values[0][0] as number)
          : 0;
        wrapper.save();
        return { changes };
      },
    };
  }

  /**
   * Simple transaction helper — executes the function and saves.
   */
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
   * Overwrite the database file and reload the internal state.
   */
  async restore(buffer: Buffer): Promise<void> {
    await this.ready();
    const SQL = await initSqlJs();
    
    // 1. Write to file
    fs.writeFileSync(DB_PATH, buffer);
    
    // 2. Clear current DB and reload from new buffer
    if (this.db) {
      this.db.close();
    }
    this.db = new SQL.Database(buffer);
    this.db.run("PRAGMA foreign_keys = ON;");
    
    console.log("♻️ Database hot-reloaded from restore");
  }

  pragma(_statement: string): void {
    // No-op — pragmas handled in init
  }

  /**
   * Normalize params: sql.js expects a flat array for positional params.
   */
  private normalizeParams(params: any[]): any[] {
    // If called with spread args like .all("a", "b"), flatten them
    if (params.length === 1 && Array.isArray(params[0])) {
      return params[0];
    }
    return params;
  }
}

const db = new DatabaseWrapper();

export default db;
