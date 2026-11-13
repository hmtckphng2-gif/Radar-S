# Südtirol Radar 6.6 — Unified Radar API v1

Public, read-only, JSON. Intended for the existing website and future Expo clients. Production root: `https://radar-s.j9fr2vg4vm.workers.dev`.

## Endpoints

- `GET /api/v1/vehicles` — merged current-position snapshot; each vehicle has `id`, `kind`, `lat`, `lon`, `observedAt`, `routeId`, `tripId`, `tripStartDate`, `vehicleId`, `source`, `sourceCount`, `positionType`, `quality`, `trainNumber`, `verifiedLine`. `verifiedLine: null` means there was **no verified static GTFS route join** in this API. A route ID is not automatically a public line name. Source and timestamps are mandatory context when interpreting coordinates.
- `GET /api/v1/diagnostics` — feed freshness, counts of merged vehicles, stale reports, ambiguous bus line identities, and conflicting STA/STA Direct positions.
- `GET /api/v1/models` — verified/planned train-number associations from `/vehicle-models.json`, plus documented fleet TYPES from `/train-model-catalog.json`. Entries in `types` are NOT assignments to a particular service or train number. Null image means rights or a verified source image are not available.

## Semantics and safety

- Position coordinates are received **feed observations**, not continuously verified GPS fixes. Never extrapolate locations or silently infer train model, delay, track/platform, or direction.
- Only current GTFS feeds are in the vehicle snapshot. Feeds older than 300 seconds are marked `old` and omitted from `vehicles`; a 503 indicates no current position feed. The original website may display last-known stale markers with explicit labeling.
- Cross-source deduplication is conservative, designed not to merge different buses just because their line names match. An unresolved discrepancy is a diagnostic, not a false combined position.
- Backend uses existing whitelisted STA, STA Direct, Trentino and train position feeds. The official STA alerts endpoint remains separate at `/api/sta_alerts` and is not a vehicle position source.
- Worker JSON responses cached for 15 seconds. No authentication secrets are returned; call at a reasonable interval (e.g. ≥20 seconds). Do not poll several times per second, especially from a Dynamic Island client.
- Browser access via read-only public CORS is allowed. Any future user-specific live activity tokens and notifications require a separate authenticated push architecture.

## Updating model evidence

Only add `by_train` assignments backed by a reliable, clearly attributable train-specific source. Every assignment must identify the service or exact GTFS trip, provenance, and confidence. `planned` means a documented scheduled assignment, not a certainty for today's operated train. For general fleet types, link to the manufacturer/operator information without guessing a matching train number. Use an image only if the rights for that image allow redistribution and the exact subject is supported.

## Native migration

The Expo/React Native client can consume `/api/v1/vehicles` while leaving the existing Leaflet website intact. Live Activities require ActivityKit, native builds, authorization, and a separate push/update delivery mechanism; the 6.6 API alone does not implement native iOS features.
