import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

test('ordinary vehicle marker tap launches the cinematic 3D view directly', () => {
  const src = get('app.js');
  const marker = src.indexOf("marker.on('click',()=>selectVehicle(key))");
  const selection = src.slice(src.indexOf('function selectVehicle(key){'), src.indexOf('function drawVehicleTrack(key){'));
  assert.ok(marker >= 0, 'map marker click must use the central vehicle selector');
  assert.match(selection, /void launchVehicleCinematic\(key\)/, 'vehicle selection must launch 3D');
  assert.match(src, /cinematic3D\.open\(current, \{ lat: point\.lat, lon: point\.lon \}, heading, 4300, zoom\)/,
    '3D must receive the selected vehicle, real map position, heading, duration and current zoom');
  assert.doesNotMatch(selection, /closeSheets\(\);return/, 'tapping the selected vehicle must not only close the detail sheet');
  assert.doesNotMatch(selection, /sr71-focusing/, 'the old 2D camera-focus animation must not override the cinematic view');
});
