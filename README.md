# Südtirol Radar 2.0

Cloudflare Workers deployment (GitHub): root contains `worker.js`, `wrangler.jsonc`, and `public/index.html`.

Cloudflare Workers Builds: build command empty; deploy command `npx wrangler deploy`.

Sources: BusOne STA and Trentino GTFS-RT JSON feeds. Provider may be offline; Trentino vehicle positions are simulated. No fictitious vehicles are generated. The current app is a live map MVP; alerts, reliable rail/bus classification, delay enrichment and track shapes need GTFS static mapping and additional verified integrations.

API checks: `/api/health`, `/api/sta`, `/api/trentino`.

BusOne terms: noncommercial use, source attribution, sensible polling. For commercial deployment obtain provider permission.
