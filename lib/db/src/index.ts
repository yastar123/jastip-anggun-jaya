import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let pool: any = undefined;
let db: any = undefined;

if (process.env.DATABASE_URL.startsWith("sqlite:")) {
  const Database = (await import("better-sqlite3")).default;
  const sqlite = await import("drizzle-orm/sqlite3");
  const dbPath = process.env.DATABASE_URL.replace("sqlite:", "");
  const sqliteDb = new Database(dbPath || "./dev.db");
  db = sqlite.drizzle(sqliteDb, { schema });
} else {
  const pg = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = pg;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export { pool, db };

export * from "./schema";
