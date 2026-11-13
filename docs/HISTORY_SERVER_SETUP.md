# Radar History Engine – Cloudflare D1 setup

**Status:** Code committed to GitHub does **not** create a database or deploy a Worker. No history is stored until the following steps succeed.

1. In Cloudflare, create a D1 database called `radar-history` and note its database UUID.
2. Add to `wrangler.jsonc` before deployment:

   `"d1_databases": [{"binding":"HISTORY_DB","database_name":"radar-history","database_id":"<your D1 database UUID>"}]`

   Replace the placeholder with the real UUID. Do not commit account credentials.
3. Apply the schema to production: `npx wrangler d1 execute radar-history --remote --file=./db/history-schema.sql`.
4. Deploy using your normal Cloudflare workflow. Cron is configured for every five minutes (`*/5 * * * *`); verify the schedule is active in the Cloudflare dashboard.
5. Verify `GET /api/history/status` returns `enabled:true`, then confirm counters increase across two cron runs. Without a binding, it deliberately returns HTTP 503.

Read-only endpoints:
- `/api/history/status` — record counts and most recent collection time
- `/api/history/vehicle?id=<encoded vehicle id>&hours=24` — latest 300 received positions
- `/api/history/stop?id=<encoded stop id>` — latest 200 predicted stop-update records

**Data integrity:** Raw GTFS-RT positions are not independently verified GPS. Stop-time updates are predictions, not confirmed arrivals; do not use them to claim a train reached a stop. Missing updates do not mean zero delay. Collector stores no IPs or passenger information. All history starts only after successful deployment. At 5-minute intervals, D1 storage and write limits may matter; monitor Cloudflare usage and adjust retention or sampling before exceeding your plan.
