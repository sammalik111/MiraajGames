import { sql } from "drizzle-orm";
import { users } from "./schema";

// COALESCE(nickname, name) — used everywhere we render a user's display
// name. Prefers the user-set nickname, falls back to the original name
// from sign-up. Returned as a plain `name` field so callers don't need
// to know nickname exists.
//
// IMPORTANT: don't write `users.nickname || users.name` — that's a JS
// truthy check on Drizzle column objects (always truthy), not SQL. It
// silently always picks nickname even when null. Use this helper.
export const displayName = sql<string>`coalesce(${users.nickname}, ${users.name})`;
