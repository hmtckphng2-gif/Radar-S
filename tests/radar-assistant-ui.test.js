import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('chat starts with map-back navigation, one new-chat action and four drawer destinations',()=>{
 const ui=read('radar-assistant-ui.mjs');for(const id of ['chat','map','departures','favorites'])assert.ok(ui.includes("['"+id+"'" )||ui.includes("['"+id+","));assert.match(ui,/Zurück zur Karte/);assert.match(ui,/Neuer Chat/);assert.match(ui,/sr-chat-menu/);assert.match(ui,/aria-label','AI-Menü öffnen/);assert.match(ui,/setDrawer\(true\)/);assert.match(ui,/sidebar-open/);assert.match(ui,/drawerOpen\)setDrawer\(false\)/);
});
test('assistant health check requires ready status and reads live feed freshness',()=>{
 const ui=read('radar-assistant-ui.mjs');assert.match(ui,/\/api\/assistant\/status/);assert.match(ui,/health\.enabled===true&&health\.status==='ready'/);assert.match(ui,/\/api\/v1\/diagnostics/);assert.match(ui,/Live-Daten geprüft/);
});
test('composer stays above safe area and visual viewport with 16px iOS input',()=>{
 const ui=read('radar-assistant-ui.mjs'),css=read('radar-assistant.css');assert.match(ui,/visualViewport/);assert.match(css,/position:sticky/);assert.match(css,/env\(safe-area-inset-bottom\)/);assert.match(css,/font:400 16px/);assert.match(css,/min-height:44px/);assert.match(css,/z-index:2600/);
});
test('friendly error states, retry, cancel and animated progressive answer are present',()=>{
 const ui=read('radar-assistant-ui.mjs');for(const code of ['rate_limited','assistant_unavailable','feed_unavailable','model_unavailable','model_quota','timeout','offline'])assert.ok(ui.includes(code));assert.match(ui,/Erneut versuchen/);assert.match(ui,/cancelRequest/);assert.match(ui,/requestAnimationFrame/);assert.match(ui,/sr-chat-dots/);
});
test('GPS requires explicit one-time permission and confirms a nearby vehicle before sending only trip identifiers',()=>{
 const ui=read('radar-assistant-ui.mjs');assert.match(ui,/Standort einmalig freigeben/);assert.match(ui,/getCurrentPosition/);assert.match(ui,/Welches dieser Fahrzeuge ist deins/);assert.match(ui,/vehicleTripId/);assert.doesNotMatch(ui,/latitude:pos\.coords|longitude:pos\.coords|localStorage|sessionStorage/);
});
test('answers always expose evidence and can open a matching vehicle on the map',()=>{
 const ui=read('radar-assistant-ui.mjs');assert.match(ui,/Woher weiß ich das\?/);assert.match(ui,/ageLabel\(fact\.observedAt\)/);assert.match(ui,/Auf Karte zeigen/);assert.match(ui,/SuedtirolRadar50\?\.openVehicle/);assert.match(ui,/Alternativen zeigen/);assert.match(ui,/getStationList/);assert.match(ui,/openStationFromMap/);
});
test('chat history is memory-only and API requests bypass browser cache',()=>{
 const ui=read('radar-assistant-ui.mjs');assert.match(ui,/history=\[\]/);assert.match(ui,/cache:'no-store'/);assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/);
});
