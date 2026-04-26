// -----------------------------------------------------------------------------
// Singleton DB client. Import as `import { db } from "@/db"`.
//
// Uses @neondatabase/serverless which talks to Postgres over HTTPS, not TCP.
// Why HTTPS: Lambda / serverless functions are short-lived. A TCP pool can't
// be reused across cold starts, so under load you exhaust Postgres's
// connection limit. HTTPS sidesteps the whole problem.
//
// In dev with hot-reload, Next.js re-evaluates this module on every change.
// We cache the client on `globalThis` to avoid leaking handles.
// -----------------------------------------------------------------------------

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const sql = neon(process.env.DATABASE_URL);

export const db =
  globalForDb.db ?? drizzle(sql, { schema, logger: process.env.NODE_ENV === "development" });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// Re-export schema so callers can do `import { db, users } from "@/db"`.
export * from "./schema";
