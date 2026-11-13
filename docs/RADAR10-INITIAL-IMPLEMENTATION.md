# Radar 10.0 — initial implementation notes

## Design references checked

- Emil Kowalski's course is referenced at https://animations.dev/learn. GitHub repository search surfaced community course exercises, not an official source repository by Emil. Do not describe those exercises as official implementation code.
- GitHub search surfaced https://github.com/hot-buro/hot-designer, whose description explicitly includes UI/UX Pro Max and Emil Kowalski design-engineering skills. It is a third-party bundle of skills, not the canonical UI/UX Pro Max project itself.
- Further verification of canonical skill repositories and their licenses remains part of the design audit; this first implementation only applies general interaction principles (brief transitions, reduced-motion support, consistent tokens, focus-visible states, compact touch controls).

## Collector status

The first adapter reads the official STA Open Data Hub vehicle-position endpoint directly, normalizes supported GTFS-Realtime-style payloads and reports source timestamp, age, rejected coordinates and data provenance. It is on-demand and read-only. It does **not** persist history: the isolated preview configuration intentionally has no storage binding and D1 remains disabled. The adapter does not claim that every reported position is GPS; `positionType` is `reported-feed-position`.

| Source | Mode | Position data | Delay | Schedule | Persistence | Access |
|---|---|---|---|---|---|---|
| STA Open Data Hub vehicle positions | on-demand adapter added | Feed-reported coordinates when present; not guaranteed GPS | Not derived by this adapter | Not included by this adapter | Disabled; no approved binding | Public endpoint already used by existing Radar feed pipeline; check current terms before production-scale polling |
| Existing BusOne STA/Trentino/Trenitalia feeds | Existing app pipeline | Depends on upstream feed | Depends on trip updates | Existing GTFS/static data | Not changed | Existing integration retained |

## Next requirements before persistent collection

Choose and approve a storage binding (D1 explicitly excluded for now), retention limits, polling cadence and cost budget. Then add a scheduled collector only after storage is available and the source's terms and rate limits are confirmed. Do not treat Worker Cache API as durable history.
