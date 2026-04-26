// Drizzle Kit reads this when generating SQL migrations from schema.ts
// and when applying them to the live database.
//
// dotenv loads .env.local so DATABASE_URL is available to drizzle-kit.
// (Next.js loads .env.local automatically for the app, but the CLI doesn't.)
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Surfaces SQL in the terminal during generate / migrate. Useful for review.
  verbose: true,
  strict: true,
});
