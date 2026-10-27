import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recovery = readFileSync('public/radar-recovery.js', 'utf8');
const sw = readFileSync('public/sw.js', 'utf8');
const app = readFileSync('public/app.js', 'utf8');

test('primary map is checked against the visible container and rendered panes', () => {
  assert.match(recovery, /primary\.getContainer\(\)===element/);
  assert.match(recovery, /element\.querySelector\('\.leaflet-pane'\)/);
});
test('normal loading and missing vehicle data do not trigger recovery timers', () => {
  assert.doesNotMatch(recovery, /setTimeout\(start,\s*\d+\)/);
  assert.doesNotMatch(recovery, /setTimeout\(fail,\s*\d+\)/);
  assert.match(recovery, /function detectFailure\(\)/);
  assert.match(recovery, /explicitFailure\)fail\(/);
});
test('API errors are isolated from map failure detection', () => {
  assert.match(recovery, /Promise\.allSettled/);
  assert.match(recovery, /NOTFALLKARTE · FEEDS OFFLINE/);
  assert.match(recovery, /function detectFailure\(\)/);
});
test('fallback only follows explicit startup or app-module failure signals', () => {
  assert.match(recovery, /(fehler beim start|startup error|startup-error|kartenfehler|map error)/i);
  assert.match(recovery, /app\.js/);
  assert.match(recovery, /window\.addEventListener\('error',onScriptError,true\)/);
});
test('recovery is one-shot and cannot loop between map modes', () => {
  assert.match(recovery, /var timer=null,fallback=null,group=null,mode='primary'/);
  assert.match(recovery, /if\(mode!=='primary'\)return/);
  assert.match(recovery, /mode='recovering'/);
  assert.match(recovery, /mode='fallback'/);
  assert.match(recovery, /mode='failed'/);
});
test('a ready primary map permanently prevents later fallback', () => {
  assert.match(recovery, /mode='primary-ready';stopObserver\(\)/);
  assert.match(recovery, /if\(mode!=='primary'\)return/);
});
test('fallback failure reports a readable status and clears its polling timer', () => {
  assert.match(recovery, /Notfallkarte nicht verfügbar/);
  assert.match(recovery, /window\.clearInterval\(timer\)/);
});
test('fallback uses the existing core parser and only finite source positions', () => {
  assert.match(recovery, /import\('\/core\.js\?v=9\.9\.0'\)/);
  assert.match(recovery, /core\.parseVehicles\(result\.value,names\[i\],\{\}\)/);
  assert.match(recovery, /Number\.isFinite\(Number\(v\.lat\)\)/);
  assert.match(recovery, /Number\.isFinite\(Number\(v\.lon\)\)/);
});
test('recovery live API requests remain uncached', () => {
  assert.match(recovery, /fetch\('\/api\/'\+name,\{cache:'no-store'\}\)/);
});
test('primary map and existing app initialization remain in place', () => {
  assert.match(app, /function initMap\(\)/);
  assert.match(app, /bootPhase\('map-ready'\)/);
  assert.match(app, /document\.dispatchEvent\(new Event\('sr37:ready'\)\)/);
});
test('service worker explicitly bypasses API requests', () => {
  assert.match(sw, /\/api\//);
  assert.match(sw, /no-store|network-only|return fetch\(request\)/i);
});
test('recovery never initializes the classic map more than once', () => {
  assert.match(recovery, /if\(mode!=='primary'\)return/);
  assert.match(recovery, /fallback=window\.L\.map\(element/);
  assert.match(recovery, /timer=window\.setInterval\(fetchVehicles,30000\)/);
});
