# Getting Started

Run the app locally. Assumes Node 20+, npm, and a Neon Postgres database.

## Setup

```bash
# 1. Clone
git clone <YOUR_REPO_URL>
cd miraaj-games

# 2. Install
npm install

# 3. Env — create .env.local at the project root
nano .env.local
```

## Required env vars

```
# Postgres
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require

# NextAuth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Admin gating
ADMIN_IDS=<your-user-id>,<other-admin-id>

# CloudWatch configuration 

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<iam-user-key>
AWS_SECRET_ACCESS_KEY=<iam-user-secret>
EC2_INSTANCE_ID=<i-...>
```

> `ADMIN_IDS` is comma-separated. Multiple admins:
> `ADMIN_IDS=abc123,def456,ghi789` — no quotes, no brackets, no spaces.
> Restart the dev server after editing `.env.local` (Next caches process.env at boot).

## First-time DB sync

```bash
npm run db:generate  # creates a SQL migration file
npm run db:migrate   # applies pending migrations
```

## Run

```bash
npm run dev         # navigate to http://localhost:3000
```


## Useful scripts

| Script                | What it does                                              |
|-----------------------|-----------------------------------------------------------|
| `npm run dev`         | Next dev server on :3000                                  |
| `npm run build`       | Production build                                          |
| `npm run start`       | Run the production build                                  |
| `npm run lint`        | ESLint                                                    |
| `npm run db:generate` | Create a Drizzle migration file from schema changes       |
| `npm run db:migrate`  | Apply pending migrations to the live DB                   |
| `npm run db:push`     | Sync schema directly to live DB (skips migration files)   |
| `npm run db:studio`   | Open Drizzle Studio to inspect tables                     |
