import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

test('ordinary vehicle tap launches the existing cinematic renderer directly', () => {
  const src = get('app.js');
  const marker = src.indexOf("marker.on('click',()=>selectVehicle(key))");
  const selection = src.slice(src.indexOf('function selectVehicle(key){'), src.indexOf('function drawVehicleTrack(key){'));
  assert.ok(marker >= 0, 'map marker click must use the central vehicle selector');
  assert.ok(selection.includes('void launchVehicleCinematic(key)'), 'first and repeat taps must launch 3D');
  assert.ok(src.includes("import('./radar83-map.mjs?v=9.9.5&rev=vehicle-tap-3d-2')"), 'load existing Radar83 renderer');
  assert.ok(src.includes('cinematic3D.open(current, { lat, lon }, heading, 4300, zoom)'), 'pass native point, heading, duration and zoom');
  assert.ok(src.includes('onFailure: error =>'), 'surface renderer startup failures');
  assert.ok(!selection.includes('sr71-focusing'), 'do not trigger legacy 2D camera focus');
});
