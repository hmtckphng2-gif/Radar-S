import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {start3DCamera,target3DCamera,use3DTerrain,cinematicDuration,prefersReducedMotion} from '../public/radar83-logic.mjs';

/* Radar 8.5 - the 3D camera must move on the tap, not after a wait.
 *
 * Measured on the live app before this change: tapping a vehicle left the
 * screen completely still for several seconds. The camera flight only
 * started after the vector tiles AND the 3D model had loaded. The camera
 * then ended up in the start pose (zoom 15 instead of 17.8, pitch 38 instead
 * of 62), because the follow logic cancelled the flight.
 *
 * These tests lock down the new order.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + 'public/' + name, 'utf8');

test('the camera flight starts before the scene is fully built', () => {
  const src = read('radar83-map.mjs');
  const flight = src.indexOf('this.replay();');
  const scene = src.indexOf('await waitFor3DScene(map);');
  const model = src.indexOf('await waitFor3DModel(map,this.layer);');
  assert.ok(flight > 0 && scene > 0 && model > 0, 'the three steps must exist');
  assert.ok(flight < scene, 'the flight must start BEFORE waiting for the scene');
  assert.ok(flight < model, 'the flight must start BEFORE waiting for the model');
});

test('the overlay becomes visible while the scene is still loading', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /classList\.add\('sr83-loading'\)/);
  const css = read('radar83.css');
  assert.match(css, /\.sr83-viewport\.sr83-loading\{opacity:\.?68;pointer-events:auto\}/);
  assert.match(css, /\.sr83-viewport\.sr83-ready\{opacity:1;pointer-events:auto\}/);
  assert.match(css, /transition:opacity 1\.12s cubic-bezier\(\.22,\.72,\.18,1\)/);
});

test('the follow never fights the running flight', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(this\.touched\|\|this\.flying\|\|!this\.map\)return;/);
  assert.match(src, /this\.flying=true;/);
  assert.match(src, /this\.flying=false;clearTimeout\(this\.flightTimer\)/);
});

test('replay works before the model is ready', () => {
  const src = read('radar83-map.mjs');
  // The old guard "if(!this.ready||...)return;" meant the flight could not
  // start while the scene was still building.
  assert.match(src, /replay\(\)\{\s*\n\s*if\(!this\.map\|\|!this\.flight\)return;/);
});

test('the camera move is short enough to feel immediate', () => {
  assert.ok(cinematicDuration(0.2) >= 3800 && cinematicDuration(0.2) <= 4600);
  assert.ok(cinematicDuration(0.2) < cinematicDuration(30), 'a distant vehicle may take a little longer');
  // A very long base value is still clamped.
  assert.ok(cinematicDuration(0.2, 9000) <= 4600);
  assert.ok(cinematicDuration(0.2, 100) >= 3800);
});

test('the flight still ends on the vehicle', () => {
  const p = {lat: 46.498, lng: 11.353};
  const end = target3DCamera(p, 19, 90, 3800);
  const start = start3DCamera(p, 90, end.zoom);
  assert.deepEqual(end.center, [p.lng, p.lat]);
  assert.equal(end.zoom, 19);
  assert.equal(end.pitch, 38);
  assert.ok(start.zoom < end.zoom);
  assert.ok(start.pitch > end.pitch, 'the camera descends to the train');
});

test('the 3D camera respects prefers-reduced-motion', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(prefersReducedMotion\(\)\)this\.map\.jumpTo\(target\)/,
    'ohne Bewegung wird direkt auf das Fahrzeug gesprungen');
  assert.match(src, /if\(prefersReducedMotion\(\)\)/);
  // Die Funktion selbst darf nie werfen.
  assert.equal(typeof prefersReducedMotion(), 'boolean');
});