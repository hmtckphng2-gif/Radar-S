import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/radar71.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('cinematic zoom temporarily hides Leaflet SVG overlays without removing their data',()=>{
 assert.match(css,/body\.sr71-focusing #map \.leaflet-overlay-pane/);
 assert.match(css,/visibility:hidden!important/);
 assert.doesNotMatch(css,/leaflet-marker-pane\s*\{[^}]*display:none/);
});
test('old fixed Mehr button never overlaps active or emerging vehicle sheet',()=>{
 assert.match(css,/body\.sr71-focusing #sr60Launch/);
 assert.match(css,/body\.sr71-focused #sr60Launch/);
 assert.match(css,/body:has\(#sheet\.open\) #sr60Launch/);
});
test('new CSS asset version invalidates iPhone PWA caches',()=>{
  // The version query must be present and must match the current release.
  // A hardcoded number would have to be changed on every release and would
  // silently stop invalidating the PWA cache if someone forgot it.
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(html,new RegExp('radar71\\.css\\?v='+pkg.version.replace(/\./g,'\\.')));
});
