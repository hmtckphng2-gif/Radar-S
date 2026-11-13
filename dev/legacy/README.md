# Legacy modules

These files are **not loaded by the app any more**. They were moved here
instead of being deleted, so that nothing is lost and the history stays
readable. They are not part of the deployed Worker and are not covered by
`npm test` any more.

## Why they were moved

A check of the whole repository proved that none of these files was
referenced any more - not by `public/index.html`, not by an import of another
module, not by a test, not by a workflow. They were pure ballast in the
public asset folder, which is uploaded to the Worker on every deploy.

| File | What it was | Replaced by |
|---|---|---|
| `radar35.js` | add-on for a dark basemap and stop progress | `radar45.js` / `radar60.css` |
| `radar36.js`, `radar36.css` | another basemap experiment | `radar45.js` |
| `radar69-journey.mjs` | first version of the journey search | `radar70-route.mjs` + `radar70.js` |
| `radar703-coach.mjs` | journey coach helper | `radar703-advisor.mjs` |
| `radar703.css` | styles of the journey coach | `radar70.css` |
| `radar-dark-restore.css` | restore of a dark mode that no longer exists | `radar-dark-restore.css` is obsolete |
| `radar82-3d.mjs` | Radar 8.2: a floating Three.js vehicle model on a separate 190x190 canvas | `radar83-model.mjs` + `radar83-map.mjs` (MapLibre) |
| `radar82-3d.test.js` | tests for the module above | `tests/radar83-3d.test.js` |

## Note on `radar82-3d.mjs`

The only still needed part was `loadThree()`, which loads the Three.js module
from the CDN once and keeps the promise so a failed request can be retried.
It now lives in `public/radar83-model.mjs` and is imported from there.

`radar82.css` was **not** moved: it still contains
`#map .sr82-model-canvas{display:none!important}`, which
`tests/radar83-ui-guard.test.js` checks.

## If you need something from here

Read the file, copy the part you actually need into a current module, and
write a test for it. Do not load these files from `public/index.html` again -
that is exactly the kind of drift this folder is meant to prevent.
