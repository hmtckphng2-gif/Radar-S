import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

test('ordinary vehicle tap dispatches the single Main-style cinematic controller', () => {
  const src = get('app.js');
  const camera = get('radar71-camera.mjs');
  const selection = src.slice(src.indexOf('function selectVehicle(key){'), src.indexOf('function drawVehicleTrack(key){'));
  assert.ok(selection.includes("document.dispatchEvent(new Event('sr37:selection'))"), 'central selector announces the selected vehicle');
  assert.ok(camera.includes("document.addEventListener('sr37:selection',onSelection)"), 'camera controller owns the selection event');
  assert.ok(camera.includes('cinema3d.open(vehicle,pos,heading,duration3D,cinematicZoom)'), 'camera launches the existing 3D renderer automatically');
  assert.ok(!src.includes('launchVehicleCinematic'), 'app.js must not create a competing 3D controller');
  assert.doesNotMatch(camera,/launch\.id='sr71Open3D'/, '3D does not require a second button tap');
});
