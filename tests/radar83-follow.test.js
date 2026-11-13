import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {followDecision} from '../public/radar83-logic.mjs';

/* Radar 8.4 - the 3D camera has to follow the vehicle it shows.
 *
 * Before this release the cinematic camera stayed where the opening flight
 * ended. The Three.js model kept the live feed position, so a moving train
 * simply drove out of the picture while the camera stood still. Because the
 * Leaflet map underneath kept following the marker, returning to the 2D map
 * ("2D" button) also left the marker outside the visible centre.
 *
 * The follow is deliberately conservative:
 * - a deliberate user gesture always wins and is never overridden,
 * - small GPS jitter must not move the camera,
 * - invalid or missing values never produce a camera target.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + 'public/' + name, 'utf8');

const BOZEN = {lat: 46.498, lng: 11.353};

test('the camera moves to the vehicle while the user has not taken over', () => {
  const decision = followDecision({touched: false, center: BOZEN, point: {lat: 46.499, lng: 11.353}});
  assert.ok(decision, 'the camera must follow the vehicle');
  assert.deepEqual(decision.center, [11.353, 46.499]);
  assert.ok(decision.meters > 100 && decision.meters < 130, 'about 111 metres: ' + decision.meters);
});

test('a deliberate user gesture always wins over the follow', () => {
  assert.equal(
    followDecision({touched: true, center: BOZEN, point: {lat: 46.52, lng: 11.353}}),
    null,
    'the camera must not fight a swipe of the user'
  );
});

test('small GPS jitter does not move the camera', () => {
  assert.equal(
    followDecision({touched: false, center: BOZEN, point: {lat: 46.49802, lng: 11.35302}}),
    null,
    'two metres of jitter must not start a camera animation'
  );
});

test('invalid or missing values never produce a camera target', () => {
  assert.equal(followDecision({}), null);
  assert.equal(followDecision({touched: false, center: null, point: BOZEN}), null);
  assert.equal(followDecision({touched: false, center: BOZEN, point: null}), null);
  assert.equal(followDecision({touched: false, center: BOZEN, point: {lat: 'x', lng: 11.353}}), null);
  assert.equal(followDecision({touched: false, center: {lat: 91, lng: 11.35}, point: BOZEN}), null);
  assert.equal(followDecision({touched: false, center: {lat: 46.5}, point: BOZEN}), null);
});

test('the cinematic layer really calls the follow decision and eases the camera', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /followDecision\(/);
  assert.match(src, /this\.map\.easeTo\(\{center:decision\.center/);
  // The follow must never be marked essential, otherwise a user swipe
  // could not interrupt it.
  assert.match(src, /essential:false/);
});

test('the camera module imports the current logic version', () => {
  const src = read('radar83-map.mjs');
  assert.match(src, /radar83-logic\.mjs\?v=\d+\.\d+\.\d+/);
});
