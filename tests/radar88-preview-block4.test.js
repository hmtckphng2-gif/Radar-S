import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/radar88-preview-block4.css',import.meta.url),'utf8');
test('map state distinguishes filters, viewport, loading and unavailable feeds',()=>{
  assert.ok(html.includes('id="sr88MapState"') && html.includes('aria-live="polite"'));
  for(const label of ['Keine Fahrzeuge für diesen Filter','Keine Fahrzeuge in diesem Ausschnitt','Live-Daten werden geladen','Live-Feed gerade nicht erreichbar'])assert.ok(app.includes(label));
  assert.ok(app.includes('finally{state.busy=false;updateMapEmptyState();}'));
});
test('map state recovery actions reset filters, fit the map or retry feeds',()=>{
  assert.ok(app.includes("setFilter('all');renderSearchResults()"));
  assert.ok(app.includes("else if(mode==='fit')fitMap();else refreshFeeds()"));
  assert.ok(app.includes('updateMapEmptyState();'));
});
test('line favorites can be toggled directly from the line list',()=>{
  assert.ok(app.includes("toggleLineFavorite(l.source+':'+l.routeId)"));
  assert.ok(app.includes("className='sr88-line-favorite'"));
  assert.ok(css.includes('.sr88-line-favorite.active'));
});
test('block 4 stylesheet is linked and reduced-motion is respected',()=>{
  assert.ok(html.includes('radar88-preview-block4.css?v=9.9.3'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
