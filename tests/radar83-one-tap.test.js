import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

test('ordinary vehicle tap launches the existing cinematic renderer directly', () => {
  const src = get('app.js');
  const marker = src.indexOf("marker.on('click',()=>selectVehicle(key))");
  const selection = src.slice(src.indexOf('function selectVehicle(key){'), src.indexOf('function drawVehicleTrack(key){'));
  assert.ok(marker >= 0, 'map marker click must use the central vehicle selector');
  assert.match(selection, /void launchVehicleCinematic\(key\)/, 'first and repeat vehicle taps must launch 3D');
  assert.match(src, /import\('./radar83-map\.mjs\?v=9\.9\.5&rev=vehicle-tap-3d-2'\)/,
    'load the existing Radar83 renderer module');
  assert.match(src, /cinematic3D\.open\(current, \{ lat, lon \}, heading, 4300, zoom\)/,
    'pass native coordinates, heading, flight duration and current zoom');
  assert.match(src, /onFailure: error =>/, 'surface renderer startup failures instead of silently remaining in 2D');
  assert.doesNotMatch(selection, /sr71-focusing/, 'do not trigger the legacy 2D focus animation');
});
