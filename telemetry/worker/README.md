# Reference telemetry worker

This optional Cloudflare Worker implements the privacy boundary documented by the desktop app. It never reads `CF-Connecting-IP`, hashes each random installation UUID with a secret salt before storage, deduplicates daily-active rows, and deletes records older than 90 days.

It is deployment infrastructure, not required to build or use Codex Quota Overlay.

## Deploy

1. Copy `wrangler.jsonc.example` to `wrangler.jsonc`.
2. Run `npm install` and authenticate Wrangler.
3. Create a D1 database, place its ID in `wrangler.jsonc`, and apply `schema.sql`.
4. Create a long random secret with `npx wrangler secret put INSTALL_ID_SALT`.
5. Deploy, attach the reviewed custom domain, and set the desktop `App.config` value to the final `https://.../v1/heartbeat` URL.
6. Verify `/healthz`, one valid heartbeat, the D1 row, retention cleanup, and that edge log retention matches the privacy policy before publishing a telemetry-enabled build.

Do not add raw request headers, IP-derived identifiers, Codex data, account fields, or an unauthenticated public statistics endpoint.

## Example metrics

```sql
-- Daily active installations
SELECT active_day, COUNT(*) AS dau
FROM daily_active
GROUP BY active_day
ORDER BY active_day DESC;

-- Active installations in the last 30 days
SELECT COUNT(DISTINCT install_hash) AS mau
FROM daily_active
WHERE active_day >= date('now', '-29 days');

-- Version distribution in the last 7 days
SELECT app_version, COUNT(DISTINCT install_hash) AS active_installs
FROM daily_active
WHERE active_day >= date('now', '-6 days')
GROUP BY app_version
ORDER BY active_installs DESC;
```
