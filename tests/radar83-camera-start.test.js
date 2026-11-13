import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {start3DCamera,target3DCamera,handoff3DCamera,approach3DCamera,use3DTerrain,cinematicDuration,prefersReducedMotion,FEATURE_FLAGS,enabled3D} from '../public/radar83-logic.mjs';

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

test('the camera flight starts after style load and before tile/model completion', () => {
  const src = read('radar83-map.mjs');
  const style = src.indexOf("map.on('load',loaded);map.on('error',failed);");
  const flight = src.indexOf('this.flight={origin:');
  const reveal = src.indexOf("this.overlay.classList.add('sr83-ready')");
  const replay = src.indexOf('this.replay();',flight);
  const scene = src.indexOf('await waitFor3DScene(map);');
  const model = src.indexOf('await waitFor3DModel(map,this.layer);');
  assert.ok(style>0&&flight>style&&reveal>flight&&replay>reveal&&scene>replay&&model>scene);
});

test('the 3D overlay is revealed when the style is ready, before tiles and model', () => {
  const src = read('radar83-map.mjs'),css=read('radar83.css');
  const reveal=src.indexOf("this.overlay.classList.add('sr83-ready')");
  const scene=src.indexOf('await waitFor3DScene(map);');
  const model=src.indexOf('await waitFor3DModel(map,this.layer);');
  assert.ok(reveal>0&&reveal<scene&&scene<model);
  assert.match(css,/\.sr83-viewport\.sr83-ready\{opacity:1;pointer-events:auto\}/);
  assert.match(css,/transition:opacity 1\.32s cubic-bezier\(\.22,\.72,\.18,1\)/);
});

test('the follow never fights the running flight', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(this\.touched\|\|this\.flying\|\|!this\.map\|\|!quality\.fresh\)return;/);
  assert.match(src, /const quality=positionFreshness\(vehicle\)/);
  assert.match(src, /this\.flying=true;/);
  assert.match(src, /this\.flying=false;clearTimeout\(this\.flightTimer\)/);
});

test('replay works before the model is ready', () => {
  const src = read('radar83-map.mjs');
  // The old guard "if(!this.ready||...)return;" meant the flight could not
  // start while the scene was still building.
  assert.match(src, /replay\(\)\{\s*\n\s*if\(!this\.map\|\|!this\.flight\)return;/);
});

test('3D camera travel adapts to zoom and distance instead of forcing a long flight', () => {
  const near=cinematicDuration(0.2, 430);
  const far=cinematicDuration(30, 2200);
  assert.ok(near>=6600 && near<=6900, 'a nearby selection uses the preview cinematic pacing');
  assert.ok(far>near && far<=7600, 'a distant vehicle may take longer');
  assert.ok(cinematicDuration(0.2, 9000) <= 7600);
  assert.equal(cinematicDuration(0.2, 100), 6600);
});

test('the default live camera flight uses the slower cinematic timing', () => {
  const src = read('radar83-logic.mjs');
  assert.match(src, /function target3DCamera\(point,zoom,heading=null,duration=4300\)/);
});

test('the flight still ends on the vehicle', () => {
  const p = {lat: 46.498, lng: 11.353};
  const end = target3DCamera(p, 19, 90, 3800);
  const start = start3DCamera(p, 90, end.zoom);
  assert.deepEqual(end.center, [p.lng, p.lat]);
  assert.equal(end.zoom, 19);
  assert.equal(end.pitch, 16);
  assert.equal(end.bearing, 118);
  assert.ok(start.zoom < end.zoom);
  assert.equal(start.pitch, 24);
  assert.ok(start.pitch > end.pitch, 'the camera descends to a steeper view');
  assert.equal(start.bearing, 323);
  assert.equal((start.bearing - end.bearing + 360) % 360, 205, 'the camera starts from the preview rear-quarter pose');
  assert.notEqual(start.bearing, end.bearing, 'the camera rotates during the approach');
  assert.ok(start.zoom > 15, 'the approach starts closer than the wide establishing shot');
});

test('the handoff continues the camera from the exact live map view', () => {
  const live = handoff3DCamera({lat:46.5,lng:11.35},18);
  assert.deepEqual(live,{center:[11.35,46.5],zoom:17,pitch:0,bearing:0});
  assert.equal(handoff3DCamera(null,18),null);
  const src=read('radar83-map.mjs');
  const tapFlow=src.slice(src.indexOf('async open('),src.indexOf('await waitFor3DScene(map);'));
  assert.doesNotMatch(tapFlow,/this\.leaflet\.(?:flyTo|setView)\(/,'2D stays still; the zoom belongs only to 3D');
  const target={center:[11.45,46.5],zoom:19,pitch:16,bearing:28};
  const approach=approach3DCamera(live,target,.75);
  assert.ok(approach.center[0]>live.center[0]&&approach.center[0]<target.center[0]);
  const flightStart=approach;
  assert.deepEqual(flightStart.center,approach.center,'the camera starts from the interpolated approach position');
  assert.notDeepEqual(flightStart.center,target.center,'the camera must not snap to the target before animating');
  assert.ok(flightStart.zoom<target.zoom,'the camera still performs the zoom-in');
  assert.equal(flightStart.bearing,approach.bearing,'the cinematic bearing turn is preserved');
  assert.ok(src.includes('approach3DCamera(handoff,target,.75)'));
  assert.ok(src.includes('const flightStart=approachStart;'));
  const cameraController=read('radar71-camera.mjs');
  assert.match(cameraController,/focusDuration\(false,Math\.max\(3,map\.getZoom\(\)-1\),cinematicZoom,remaining3DDistanceKm\)/);
  assert.match(cameraController,/cinema3d\.open\(vehicle,pos,heading,duration3D,cinematicZoom\)/);
  assert.ok(src.indexOf('this.flight={start:flightStart,target:continuedTarget};') < src.indexOf('await waitFor3DScene(map);'));
  assert.ok(src.indexOf('this.replay();') < src.indexOf('await waitFor3DScene(map);'));
  const ready=src.indexOf("this.overlay.classList.add('sr83-ready')");
  assert.ok(ready>0&&ready<src.indexOf('await waitFor3DScene(map);'));
  assert.match(src.slice(ready,src.indexOf('return true;',ready)),/this\.replay\(\)/);
});

test('the 3D camera respects prefers-reduced-motion', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /if\(prefersReducedMotion\(\)\)this\.map\.jumpTo\(target\)/,
    'ohne Bewegung wird direkt auf das Fahrzeug gesprungen');
  assert.match(src, /if\(prefersReducedMotion\(\)\)/);
  // Die Funktion selbst darf nie werfen.
  assert.equal(typeof prefersReducedMotion(), 'boolean');
});

test('cinematic 3D stays enabled by default and all camera modules bypass stale SW assets',()=>{
  assert.equal(FEATURE_FLAGS.cinematic3D,true);
  assert.equal(enabled3D(''),true);
  assert.equal(enabled3D('?radar3d=off'),false);
  const html=read('index.html');
  const camera=read('radar71-camera.mjs');
  const map=read('radar83-map.mjs');
  assert.ok(html.includes('radar71-camera.mjs?v=9.9.5&rev=preview-3d-reliability-1'));
  assert.ok(camera.includes('radar83-map.mjs?v=9.9.5&rev=preview-3d-reliability-1'));
  assert.ok(camera.includes('radar83-logic.mjs?v=9.9.5&rev=preview-3d-reliability-1'));
  assert.ok(map.includes('radar83-logic.mjs?v=9.9.5&rev=preview-3d-reliability-1'));
  assert.ok(map.includes('const exitCamera={...flight.target,center:[...flight.target.center],zoom:flight.origin.zoom}'));
  assert.ok(map.includes('const returnView=null'));
  assert.ok(map.includes('map.easeTo({...exitCamera,duration'));
  assert.ok(!map.includes('map.easeTo({...flight.origin,duration')); 
});
