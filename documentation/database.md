# Database — Drizzle ORM + Neon Postgres

## The flow 

```
   schema.ts            →     db:generate          →     drizzle/*.sql     →     db:migrate     →     Neon
   (source of truth)          (create migration)         (review)                (apply)              (live DB)
```

1. **`src/db/schema.ts`** is the source of truth. Every table, index, FK, and constraint lives there in TypeScript.
2. **`drizzle-kit generate`** diffs the schema against the last snapshot in `drizzle/meta/` and writes a new `.sql` file describing the change.
3. **`drizzle-kit migrate`** applies any unapplied SQL files to the live Neon DB and records them in the `__drizzle_migrations` tracking table.

## Connection

`src/db/index.ts` opens the connection on app boot:
- Reads `DATABASE_URL` from `.env.local` (throws if missing)
- Creates a Neon client that talks to Postgres over **HTTPS** (not TCP)
- Wraps it with Drizzle for typed query builders


Import in typescript with the following format:
```ts
import { db, users, gameSessions } from "@/db";
```

## Common commands

```bash
npm run db:generate   # diff schema → write a new SQL migration file
npm run db:migrate    # apply pending migrations to Neon
npm run db:push       # skip migration files; sync schema → DB directly
npm run db:studio     # open Drizzle Studio web UI to inspect tables
```


## Inspecting the live DB without the app

```bash
npm run db:studio
# → opens https://local.drizzle.studio
```
