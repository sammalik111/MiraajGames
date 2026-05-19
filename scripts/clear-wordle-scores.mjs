// One-off: wipe all Wordle (game_id = 19) score history.
// Run with `node scripts/clear-wordle-scores.mjs`.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);

const audit = await sql`DELETE FROM game_scores WHERE game_id = 19 RETURNING id`;
const best = await sql`DELETE FROM best_scores_for_game WHERE game_id = 19 RETURNING user_id`;

console.log(`Cleared ${audit.length} audit rows, ${best.length} best-score rows for Wordle.`);
