import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {modelCreditText,normalizeModel,VEHICLE_SPECS,vehicleKind} from '../public/radar83-model.mjs';

/* Radar 8.5 - the 3D model may be a real downloaded file.
 *
 * Two things must never break:
 * 1. The 3D view must work without any download. The schematic model is the
 *    fallback and is always there.
 * 2. The GLTFLoader must use the SAME three build as the app. It imports
 *    "three" as a bare specifier, which only works because of the import map
 *    in index.html. Two different three copies would break every instanceof
 *    check inside the loader.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + name, 'utf8');

// A minimal stand-in for the three parts the normalizer uses.
function fakeThree(size, min) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy() { return new Vector3(this.x, this.y, this.z); }
  }
  class Box3 {
    setFromObject(o) {
      const s = o.userData.size, m = o.userData.min;
      this.min = new Vector3(m.x, m.y, m.z);
      this.max = new Vector3(m.x + s.x, m.y + s.y, m.z + s.z);
      return this;
    }
    getSize(t) { t.set(this.max.x - this.min.x, this.max.y - this.min.y, this.max.z - this.min.z); return t; }
    getCenter(t) {
      t.set((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, (this.min.z + this.max.z) / 2);
      return t;
    }
  }
  class Group {
    constructor() { this.children = []; this.position = new Vector3(); this.rotation = {x: 0, y: 0, z: 0}; this.scale = {setScalar(v) { this.v = v; return this; }}; }
    add(c) { this.children.push(c); return c; }
  }
  return {Vector3, Box3, Group};
}

const fakeModel = (size, min) => ({
  userData: {size, min},
  position: {x: 0, y: 0, z: 0},
});

test('the import map points the GLTFLoader at the same three build as the app', () => {
  const model = read('public/radar83-model.mjs');
  const html = read('public/index.html');
  const threeUrl = model.match(/const THREE_URL='([^']+)'/);
  assert.ok(threeUrl, 'radar83-model.mjs must declare const THREE_URL');
  const map = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(map, 'index.html needs an import map for the GLTFLoader');
  const parsed = JSON.parse(map[1]);
  assert.equal(parsed.imports.three, threeUrl[1], 'app and loader must load the same three build');
});

test('the GLTFLoader is loaded from the same package as three', () => {
  const model = read('public/radar83-model.mjs');
  const loader = model.match(/const GLTF_URL='([^']+)'/);
  assert.ok(loader, 'radar83-model.mjs must declare const GLTF_URL');
  assert.ok(loader[1].includes('three@0.160.1'), 'the loader must match the three version');
  assert.ok(!loader[1].includes('+esm'), 'the +esm build would pull a second copy of three');
});

test('the model configuration is valid and covers both vehicle kinds', () => {
  const config = JSON.parse(read('public/models/models.json'));
  assert.ok(config.models.train, 'a train model must be configurable');
  assert.ok(config.models.bus, 'a bus model must be configurable');
  for (const kind of ['train', 'bus']) {
    const entry = config.models[kind];
    assert.ok(entry.file, kind + ' needs a file name');
    assert.ok(Number.isFinite(entry.lengthMeters) && entry.lengthMeters > 0, kind + ' needs a real length');
    assert.ok(Number.isFinite(entry.heightMeters) && entry.heightMeters > 0, kind + ' needs a real height');
  }
  // The real lengths must match the schematic model, otherwise the two would
  // visibly jump when the real model replaces the fallback.
  assert.equal(config.models.train.lengthMeters, VEHICLE_SPECS.train.length);
  assert.equal(config.models.bus.lengthMeters, VEHICLE_SPECS.bus.length);
});

test('a downloaded model is measured, not guessed: it is scaled to the real length', () => {
  const T = fakeThree({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const object = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const result = normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, yawOffset: 0}, T);
  assert.ok(result, 'a measurable model must be accepted');
  assert.ok(Math.abs(result.scale - 44.5 / 40) < 1e-6, 'scale follows the real length');
  assert.equal(result.rotated, false, 'the long axis already runs along Z');
});

test('a model authored along X is turned so that it runs along Z', () => {
  const T = fakeThree({x: 40, y: 4, z: 2}, {x: -20, y: 1, z: -1});
  const object = fakeModel({x: 40, y: 4, z: 2}, {x: -20, y: 1, z: -1});
  const result = normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, yawOffset: 0}, T);
  assert.equal(result.rotated, true, 'the model must be rotated');
  assert.ok(Math.abs(result.scale - 44.5 / 40) < 1e-6);
});

test('the model stands on the ground and is centred', () => {
  const T = fakeThree({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const object = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, yawOffset: 0}, T);
  assert.equal(object.position.y, -1, 'the lowest point must end up at y = 0');
  assert.equal(object.position.x, 0, 'the model must be centred in X');
  assert.equal(object.position.z, 0, 'the model must be centred in Z');
});

test('a model that cannot be measured is rejected instead of being shown wrong', () => {
  const T = fakeThree({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0});
  assert.equal(normalizeModel(fakeModel({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0}), {lengthMeters: 44.5}, T), null);
  assert.equal(normalizeModel(fakeModel({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: 0}), {lengthMeters: 0}, T), null);
  assert.equal(normalizeModel(null, {lengthMeters: 44.5}, T), null);
});

test('CC BY requires the author to be named, so a real model always shows a credit', () => {
  const without = modelCreditText(null, false);
  assert.match(without, /schematisch/, 'without a model the view stays labelled as schematic');
  const withCredit = modelCreditText({title: 'FLIRT', author: 'hotdoghans', license: 'CC BY 4.0'}, true);
  assert.match(withCredit, /hotdoghans/, 'the author must be visible');
  assert.match(withCredit, /CC BY 4\.0/, 'the license must be visible');
  assert.match(withCredit, /Datenfeed/, 'the feed origin must stay visible');
  // A credit without author or license is not usable and must not be shown.
  assert.match(modelCreditText({title: 'FLIRT'}, true), /schematisch/);
});

test('the schematic model stays available as the fallback', () => {
  const model = read('public/radar83-model.mjs');
  assert.match(model, /export function makeVehicleMesh/);
  assert.equal(vehicleKind({kind: 'bus'}), 'bus');
  assert.equal(vehicleKind({kind: 'train'}), 'train');
  // The 3D map must always add the schematic model first, so something is
  // visible before - or without - any download.
  const map = read('public/radar83-map.mjs');
  assert.match(map, /this\.object=makeVehicleMesh\(T,kind\);this\.scene\.add\(this\.object\);/);
  assert.match(map, /loadVehicleModel\(kind,T\)/);
  assert.match(map, /modelKind='schematic'/);
  assert.match(map, /modelKind='real'/);
});

test('no real model file is shipped yet, so the fallback is what runs', () => {
  const models = root + 'public/models/';
  for (const name of ['train.glb', 'bus.glb']) {
    assert.equal(existsSync(models + name), false, name + ' is not part of the repository yet');
  }
});
