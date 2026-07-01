import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __kidsDb: Promise<Db> | undefined;
}

async function init(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("render.com")
        ? { rejectUnauthorized: false }
        : undefined,
    });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    return db;
  }

  // Local dev fallback: embedded Postgres (PGlite), data stored in ./.pglite
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle("./.pglite", { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!globalThis.__kidsDb) globalThis.__kidsDb = init();
  return globalThis.__kidsDb;
}

export * from "./schema";
