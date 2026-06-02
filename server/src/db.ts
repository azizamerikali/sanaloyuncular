import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables!");
}

// Create a single Supabase client using the service_role key.
// This bypasses RLS — all authorization is handled by Express middleware (JWT).
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Escapes a value for safe inclusion in a SQL string.
 * Equivalent to PostgreSQL's quote_literal() — wraps in single quotes
 * and escapes internal single quotes by doubling them.
 */
function escapeLiteral(value: any): string {
  if (value === null || value === undefined) return "NULL";
  const str = String(value);
  // Double any single quotes inside the string, then wrap in quotes
  return "'" + str.replace(/'/g, "''") + "'";
}

/**
 * Builds a final SQL string by replacing ? placeholders with escaped literal values.
 * This is done on the Node.js side to avoid $N conflicts with values containing $ (like bcrypt hashes).
 */
function buildSQL(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;

  let paramIndex = 0;
  return sql.replace(/\?/g, () => {
    if (paramIndex >= params.length) return "?";
    const value = params[paramIndex++];
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number") return String(value);
    return escapeLiteral(value);
  });
}

class DatabaseWrapper {
  private _ready: boolean = false;
  private initPromise: Promise<void>;
  isRestoring: boolean = false;

  constructor() {
    this.initPromise = this.initialize().catch((err) => {
      console.error(`❌ Global Database Initialization Error: ${err.message}`);
    });
    this.initPromise.catch(() => {});
  }

  private async initialize(): Promise<void> {
    try {
      // Test the connection with a simple query
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .limit(0);

      // Table might not exist yet — that's OK during first-time setup
      if (error && !error.message.includes("does not exist")) {
        console.warn(`⚠️ Supabase connection test warning: ${error.message}`);
      }

      this._ready = true;
      console.log(`✅ Database initialized (Supabase: ${SUPABASE_URL})`);
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

  /** No-op for Supabase. Kept for API compatibility. */
  setSkipSave(_skip: boolean): void {}

  /** No-op for Supabase. Kept for API compatibility. */
  async save(): Promise<void> {}

  /**
   * Execute raw SQL (DDL statements like CREATE TABLE, ALTER TABLE).
   */
  async exec(sql: string): Promise<void> {
    await this.ready();

    // Split multi-statement SQL into individual statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        const { error } = await supabase.rpc("exec_ddl", { query: stmt });
        if (error) throw new Error(error.message);
      } catch (e: any) {
        if (
          e.message.includes("already exists") ||
          e.message.includes("duplicate")
        ) {
          continue;
        }
        console.warn(`⚠️ DDL statement warning: ${e.message}`);
      }
    }
  }

  /**
   * Prepare a SQL statement. Returns an object with .all(), .get(), .run() methods.
   * Parameters are substituted on the Node.js side using escapeLiteral() to avoid
   * conflicts with values containing $ characters (e.g. bcrypt hashes like $2b$12$...).
   */
  prepare(sql: string) {
    const wrapper = this;

    return {
      /**
       * Execute query and return all matching rows.
       */
      async all(...params: any[]): Promise<any[]> {
        await wrapper.ready();
        const normalizedParams = wrapper.normalizeParams(params);
        const finalSQL = buildSQL(sql, normalizedParams);

        const { data, error } = await supabase.rpc("exec_sql", {
          query: finalSQL,
        });

        if (error) {
          throw new Error(
            `SQL Query Error: ${error.message}\nQuery: ${finalSQL}`
          );
        }

        return data || [];
      },

      /**
       * Execute query and return the first matching row (or undefined).
       */
      async get(...params: any[]): Promise<any> {
        await wrapper.ready();
        const normalizedParams = wrapper.normalizeParams(params);
        const finalSQL = buildSQL(sql, normalizedParams);

        const { data, error } = await supabase.rpc("exec_sql", {
          query: finalSQL,
        });

        if (error) {
          throw new Error(
            `SQL Query Error: ${error.message}\nQuery: ${finalSQL}`
          );
        }

        const rows = data || [];
        return rows.length > 0 ? rows[0] : undefined;
      },

      /**
       * Execute an INSERT, UPDATE, or DELETE statement.
       * Returns { changes: number }.
       */
      async run(...params: any[]): Promise<{ changes: number }> {
        await wrapper.ready();
        const normalizedParams = wrapper.normalizeParams(params);
        const finalSQL = buildSQL(sql, normalizedParams);

        const { data, error } = await supabase.rpc("exec_sql_with_count", {
          query: finalSQL,
        });

        if (error) {
          throw new Error(
            `SQL Run Error: ${error.message}\nQuery: ${finalSQL}`
          );
        }

        const changes = typeof data === "number" ? data : 1;
        return { changes };
      },
    };
  }

  /**
   * Transaction wrapper. For Supabase via REST API, we execute statements sequentially.
   */
  transaction<T>(fn: () => T): () => Promise<T> {
    return async () => {
      await this.ready();
      try {
        const result = fn();
        return result;
      } catch (e) {
        throw e;
      }
    };
  }

  /**
   * Backup: Export all data as JSON.
   */
  async exportDb(): Promise<Buffer> {
    const tables = [
      "users", "media", "consents", "projects",
      "assignments", "payments", "favorites",
      "consent_text", "verification_codes", "member_legal_records"
    ];

    const backup: Record<string, any[]> = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select("*");
        if (!error && data) {
          backup[table] = data;
        }
      } catch (e) {
        console.warn(`⚠️ Backup: Could not export table ${table}`);
      }
    }

    return Buffer.from(JSON.stringify(backup, null, 2), "utf-8");
  }

  /**
   * Restore: Import data from JSON backup.
   */
  async restore(buffer: Buffer): Promise<{ restarting: boolean }> {
    try {
      const backup = JSON.parse(buffer.toString("utf-8"));

      // Delete all existing data (in reverse dependency order)
      const deleteOrder = [
        "member_legal_records", "verification_codes", "consent_text",
        "favorites", "payments", "assignments", "consents", "media",
        "projects", "users"
      ];

      for (const table of deleteOrder) {
        try {
          await supabase.from(table).delete().neq("id", "___never_match___");
        } catch (e) {
          // Table might not exist
        }
      }

      // Insert data in dependency order
      const insertOrder = [
        "users", "projects", "media", "consents", "assignments",
        "payments", "favorites", "consent_text", "verification_codes",
        "member_legal_records"
      ];

      for (const table of insertOrder) {
        if (backup[table] && backup[table].length > 0) {
          for (let i = 0; i < backup[table].length; i += 100) {
            const batch = backup[table].slice(i, i + 100);
            const { error } = await supabase.from(table).upsert(batch);
            if (error) {
              console.error(`❌ Restore: Failed to insert into ${table}: ${error.message}`);
            }
          }
        }
      }

      console.log("✅ Database restored from backup");
      return { restarting: false };
    } catch (e: any) {
      console.error(`❌ Restore failed: ${e.message}`);
      throw e;
    }
  }

  /** No-op. Kept for API compatibility. */
  pragma(_statement: string): void {}

  private normalizeParams(params: any[]): any[] {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params;
  }
}

let dbInstance: DatabaseWrapper | null = null;
const db = new Proxy({} as DatabaseWrapper, {
  get: (_target, prop, receiver) => {
    if (!dbInstance) dbInstance = new DatabaseWrapper();
    return Reflect.get(dbInstance, prop, receiver);
  },
});

export { supabase };
export default db;
