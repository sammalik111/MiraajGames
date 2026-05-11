# Documentation

Topic-per-file reference docs for the project. If you can't remember how
something works or want to onboard someone, start here.

## Index

| File | Topic |
|---|---|
| [getting-started.md](./getting-started.md) | Clone, install, env, run locally |
| [deployment.md](./deployment.md) | Provision the EC2 box, point DNS, run user-data |
| [production-updates.md](./production-updates.md) | `git pull` workflow + nightly cron automation |
| [database.md](./database.md) | Drizzle ORM + Neon Postgres — schema-as-code workflow |
| [auth.md](./auth.md) | NextAuth, `requireUser`, `requireAdmin` patterns |
| [multiplayer.md](./multiplayer.md) | Multiplayer architecture, tables, API, tricks |
| [themes.md](./themes.md) | Theme system, adding a new theme |
| [admin-and-monitoring.md](./admin-and-monitoring.md) | Admin panel, feedback, CloudWatch metrics |
| [aws-cli.md](./aws-cli.md) | Install AWS CLI on the EC2 instance |

## Conventions

- **Placeholders** in code blocks use ALL_CAPS or angle brackets (`YOUR_DOMAIN.com`, `<your-user-id>`) — replace before running.
- **Sensitive data** (the real domain, GitHub URL, admin user IDs, secrets) is intentionally left out. Substitute your own.
- Each file is self-contained — you shouldn't need to chain-read to understand a single topic.
