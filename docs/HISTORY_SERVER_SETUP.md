# Radar History Engine — Render/Turso + Cloudflare Cron

## Current preview architecture

The history database already used by Radar is Turso, accessed by the Render Node backend. Do **not** create a second D1 database for this preview fix. The Cloudflare Worker now proxies read-only `/api/history/*` requests to Render and owns the reliable five-minute scheduler.

1. The Render service must be deployed from branch `feature/render-node-backend`. Automatic deploys are disabled, so deploy the new commit manually from the Render dashboard.
2. Render environment must contain `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `HISTORY_COLLECTOR_ENABLED=true`, and `HISTORY_COLLECTOR_SECRET`. The database URL, auth token, and collector secret are secrets; never commit or paste them into chat.
3. The preview Worker has `HISTORY_API_ORIGIN=https://radar-s.onrender.com` in `wrangler.jsonc` and a Cron Trigger `*/5 * * * *`.
4. In Cloudflare Workers & Pages → `suedtirol-radar-preview` → Settings → Variables and Secrets, add a secret named `HISTORY_COLLECTOR_SECRET`. Its value must exactly match the `HISTORY_COLLECTOR_SECRET` already configured on the Render service. Do not add the value to `wrangler.jsonc`.
5. The scheduled Worker sends a protected `POST /internal/collect-history` to Render every five minutes. Without the secret, it intentionally fails closed and skips collection; it does not write to an unconfigured database.
6. Read-only history endpoints on the preview Worker are proxied to Render/Turso. Verify `GET /api/history/status` returns `enabled:true`, includes `bySource` and `today`, and the counts increase after two scheduled runs.

## Optional D1 mode

The Worker can still use a Cloudflare D1 binding directly if a separate D1 migration is explicitly chosen. That requires creating a D1 database, binding it as `HISTORY_DB`, and applying `db/history-schema.sql`. This is not required for the current Render/Turso setup.

## Read-only endpoints

- `/api/history/status` — total records, per-source counts, latest collection timestamps, and today's write count.
- `/api/history/vehicle?id=<encoded vehicle id>&hours=24` — latest 300 received position observations.
- `/api/history/stop?id=<encoded stop id>` — latest 200 predicted stop-update records.

## Data integrity and budget

Vehicle-position records are not independently verified GPS. Stop-time updates are forecasts, not confirmed arrivals; do not claim a train reached a stop based on them. Missing updates do not mean zero delay. The collector stores no IPs or passenger information.

At five-minute intervals, the current worst-case projection is 13,824 write attempts per day against a 15,000 daily budget. The collector deduplicates unchanged stop forecasts and enforces the daily remaining-write budget. Monitor `today.totalWrites` and the per-source counters after deployment.
