# Render Node backend

This branch adds a Node.js HTTP adapter around the existing Radar Worker so the same API handlers and static app can run on a Render Web Service. It does not change the Worker implementation, production deployment, or the main branch.

## Render settings

- Service: Web Service
- Runtime: Node
- Region: Frankfurt (`frankfurt`)
- Root Directory: repository root (leave blank)
- Build Command: `npm install && npm run check && npm test`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Instance: Free for the initial preview
- Automatic deploys: disabled in `render.yaml`

The `render.yaml` file contains these settings. `PORT` is supplied by Render and is read by `server.mjs`.

## Environment variables

- `ASSISTANT_ENABLED=true` enables the existing evidence-grounded assistant endpoint.
- `GROQ_FREE_TIER_ONLY=true` allows only the existing Groq free-tier provider path.
- `GROQ_API_KEY` is a secret entered directly in Render's Environment settings. Never commit it or paste it into chat.
- `BUSONE_CLIENT` is optional and defaults to a read-only Radar client label.

## Scope and limitations

- `/api/health`, `/api/version`, the existing vehicle/feed APIs, static assets, and the existing `/api/assistant` handler are routed through the existing Worker code.
- The Node adapter provides a small in-memory rate limiter. It resets on restart and is not a persistent/distributed quota system.
- Cloudflare AI bindings are not available in this Node service. The existing journey-chat endpoint that requires `env.AI` remains unavailable here; the Groq-backed `/api/assistant` path is the supported AI-chat path.
- No history database is configured. Historical collection and statistics persistence remain disabled; this service must not claim to store history.
- Render's free web service can sleep when idle. It is suitable for an initial preview, not a promise of continuously warm real-time service.
- The existing production app continues to use its current deployment until a separate, explicitly approved frontend/API cutover is prepared.

## Local smoke test

```sh
node server.mjs
```

Then open `/api/health` and `/api/version` on the local server.
