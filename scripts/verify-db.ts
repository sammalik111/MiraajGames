// Quick sanity check — lists tables in the public schema.
// Run: npx tsx scripts/verify-db.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables in your Neon database:");
  for (const r of rows) console.log("  •", r.table_name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
