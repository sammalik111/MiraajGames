# Admin Panel & Monitoring

The `/dashboards` page is admin-only and surfaces:
- App stats (users, feedback, game scores, active rooms, messages)
- Feedback inbox (timestamp DESC, with submitter info)
- User list with delete capability
- EC2 / CloudWatch metrics (live, with a window selector)

## Who is admin

The `ADMIN_IDS` env var is a comma-separated list of user ids:

```
ADMIN_IDS=abc123,def456
```

`src/lib/requireAdmin.ts` parses it on each request and uses it to gate `/api/admin/*` routes. The `NavRail` shows the Dashboards icon only if `/api/admin/check` returns `{isAdmin: true}` for the current user, which keeps the env list off the client entirely.

To grant admin:
1. Find the user id (it's in `users.id` — a nanoid string)
2. Append to `ADMIN_IDS` in `.env.local` (dev) or `/etc/miraaj.env` (prod)
3. Restart the dev server / `sudo systemctl restart miraaj`



## CloudWatch integration

### What's surfaced

Six EC2 metrics fetched in parallel for whatever `EC2_INSTANCE_ID` is set:

| Metric                    | Statistic | Unit      |
|---------------------------|-----------|-----------|
| CPUUtilization            | Average   | Percent   |
| NetworkIn / NetworkOut    | Sum       | Bytes     |
| DiskReadOps / DiskWriteOps| Sum       | Count     |
| StatusCheckFailed         | Maximum   | Count     |

Each renders as a card with the latest value, min/avg/max, and an inline SVG sparkline. StatusCheckFailed flips to magenta when > 0 as a visible alarm.

### Window selector

1h, 6h, 24h, 7d buttons in the section header. Period adapts (5-min / 10-min / 1-hour granularity).

### Credential resolution

The route doesn't pass `credentials` to `CloudWatchClient`. The AWS SDK's default credential provider chain handles both environments:

| Environment       | What env has                                                  | How the SDK resolves          |
|-------------------|---------------------------------------------------------------|-------------------------------|
| Local dev         | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` from `.env.local`| Chain step 1 (env vars) wins  |
| Production on EC2 | Neither set                                                   | Chain falls through to IMDS, uses the instance role |


### Required env

| Env var                   | When              |
|---------------------------|-------------------|
| `AWS_REGION`              | Always            |
| `EC2_INSTANCE_ID`         | Always            |
| `AWS_ACCESS_KEY_ID`       | Local dev only    |
| `AWS_SECRET_ACCESS_KEY`   | Local dev only    |

The IAM user (local) and instance role (prod) both need `cloudwatch:GetMetricStatistics` at minimum.

### Verifying IMDS works in prod

```bash
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

Should print the attached role's name. If it does, the SDK can read it the same way.

## Feedback flow

1. Public user submits via `/contactUs` (form posts to `PUT /api/admin/feedback`)
2. Row lands in the `feedback_table` with the submitter's user id as FK (so admins can see who reported what)
3. Admins see all feedback rows on `/dashboards`, newest first, with a "View profile" link per row

