import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cinematicDuration,prefersReducedMotion} from '../public/radar83-logic.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + 'public/' + name, 'utf8');

test('a vehicle tap starts directly on the 3D map without a 2D zoom or zoomed-out intro', () => {
  const src = read('radar83-map.mjs');
  assert.doesNotMatch(src, /this\.leaflet\.flyTo\(\[point\.lat,point\.lng\]/);
  assert.match(src, /const tapCamera=handoff3DCamera\(this\.leaflet\.getCenter\?\.\(\),this\.leaflet\.getZoom\?\.\(\)\)/);
  assert.match(src, /this\.flight=\{start:tapCamera,target\}/);
  const style = src.indexOf("map.on('load',loaded);map.on('error',failed);");
  const flight = src.indexOf('this.flight={start:tapCamera,target};');
  const reveal = src.indexOf("this.overlay.classList.add('sr83-ready')");
  const replay = src.indexOf('this.replay();',flight);
  const scene = src.indexOf('await waitFor3DScene(map);');
  const model = src.indexOf('await waitFor3DModel(map,this.layer);');
  assert.ok(style > 0 && flight > style && reveal > flight && replay > reveal);
  assert.ok(replay < scene && scene < model, '3D animation starts before tile/model preparation completes');
  const ready = src.indexOf('this.ready=true;',model);
  assert.ok(ready > model && !src.slice(model,ready).includes('this.replay();'), 'model readiness must not restart the already-running flight');
});

test('3D libraries and style are warmed before a vehicle tap without creating a WebGL context', () => {
  const src = read('radar83-map.mjs');
  const preload = src.slice(src.indexOf('export function preload3DLibraries'), src.indexOf('// Wait for real vector tiles'));
  assert.match(preload, /loadMapLibre\(\)\.catch/);
  assert.match(preload, /loadThree\(\)\.catch/);
  assert.match(preload, /fetch\(VECTOR_STYLE/);
  assert.doesNotMatch(preload, /new lib\.Map|WebGLRenderer/);
  const entry = read('radar71-camera.mjs');
  assert.match(entry, /preload3DLibraries\(\);/);
});

test('the 3D overlay is revealed as soon as the MapLibre style is ready', () => {
  const src = read('radar83-map.mjs');
  const style = src.indexOf("map.on('load',loaded);map.on('error',failed);");
  const reveal = src.indexOf("this.overlay.classList.add('sr83-ready')");
  const scene = src.indexOf('await waitFor3DScene(map);');
  assert.ok(style > 0 && reveal > style && scene > reveal);
  const css = read('radar83.css');
  assert.match(css, /\.sr83-viewport\{[\s\S]*?opacity:0;pointer-events:none;/);
  assert.match(css, /\.sr83-viewport\.sr83-ready\{opacity:1;pointer-events:auto\}/);
});

test('the follow never fights the running flight', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(!quality\.fresh\|\|this\.touched\|\|this\.flying\|\|!this\.map\)return;/);
  assert.match(src, /this\.flying=true;/);
  assert.match(src, /this\.flying=false;this\.lastPoint=null/);
});

test('replay works before the model is ready', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /replay\(\)\{\s*\n\s*if\(!this\.map\|\|!this\.flight\)return;/);
});

test('the camera flight remains smooth and bounded', () => {
  assert.ok(cinematicDuration(0.2) >= 6600 && cinematicDuration(0.2) <= 7600);
  assert.ok(cinematicDuration(0.2) < cinematicDuration(30));
  assert.ok(cinematicDuration(0.2, 9000) <= 7600);
  assert.ok(cinematicDuration(0.2, 100) >= 4200);
});

test('the 3D camera respects prefers-reduced-motion', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(prefersReducedMotion\(\)\)this\.map\.jumpTo\(target\)/);
  assert.equal(typeof prefersReducedMotion(), 'boolean');
});

test('the startup watchdog preserves the mobile loading budget', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /3D-Start nach 35 Sekunden abgebrochen/);
  assert.match(src, /\},35000\);/);
});
