import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [html, css, app, sw, pkg, startupCss] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-fixpack.css', import.meta.url), 'utf8'),
  readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/radar10-startup.css', import.meta.url), 'utf8')
]);
const version = JSON.parse(pkg).version;
test('map SR badge uses a silver mark on graphite', () => {
  assert.match(html, /radar10-fixpack\.css\?v=9\.9\.0/);
  assert.ok(css.includes('color: #e5e9ed !important'));
  assert.ok(css.includes('background: linear-gradient(145deg, #282f37, #11161c) !important'));
  assert.ok(css.includes('.topbar .brand-badge svg path { fill: none !important; stroke: #e5e9ed !important; }'));
  assert.ok(css.includes('.topbar .brand-badge svg circle { fill: #e5e9ed !important; stroke: none !important; }'));
});
test('the full visible marker wrapper is tappable, not only the small inner circle', () => {
  assert.match(app, /marker\.on\('click',\(\)=>selectVehicle\(key\)\)/);
  assert.ok(css.includes('#map .leaflet-marker-icon.leaflet-interactive .marker-wrap'));
  assert.ok(css.includes('pointer-events: auto !important'));
  assert.ok(css.includes('touch-action: manipulation'));
});
test('dash-only or empty vehicle detail fields show a truthful fallback', () => {
  assert.ok(app.includes("function displayField(value,fallback='Nicht verfügbar')"));
  assert.ok(app.includes('strong.textContent=displayField(value)'));
  assert.ok(app.includes("displayField(v.headsign,'Ziel nicht verfügbar')"));
  assert.ok(app.includes('Keine bestätigten Verspätungsdaten'));
});
test('Service Worker cache matches app version and live APIs bypass caching', () => {
  assert.ok(sw.includes("const CACHE='radar-shell-v" + version + "';"));
  const apiGuard = sw.indexOf('if(isApi(url))return;');
  const assetCache = sw.indexOf('if(isAsset(url))');
  assert.ok(apiGuard >= 0 && assetCache > apiGuard, 'API bypass must occur before asset caching');
});
test('startup checkmark uses valid CSS Unicode and no mojibake', () => {
  assert.ok(startupCss.includes("content:'\\2713'"));
  assert.ok(!startupCss.includes('â'));
});
