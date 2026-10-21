import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeVehicleMesh,VEHICLE_SPECS} from '../public/radar83-model.mjs';

/* Radar 8.5 - the model must have height and real proportions.
 *
 * Two real bugs came out of looking at the live 3D view:
 *
 * 1. The model must have the right scale on all three axes. X, Y and Z are
 *    mercator units, so all three need the meter factor. MercatorCoordinate.z
 *    is already in mercator units (mercator_coordinate.ts:
 *    mercatorZfromAltitude), and the custom layer matrix rescales it with
 *    worldSize/pixelsPerMeter. Scaling Z with 1 instead makes the model
 *    disappear completely.
 *
 * 2. The schematic train was a rough box. It now follows the proportions of
 *    a modern regional EMU: 44.5 m long, 2.80 m wide, about 3.5 m high.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + name, 'utf8');

function fakeThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    // three.js semantics: these change the vector in place and return it.
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() { return this; }
    length() { return Math.hypot(this.x, this.y, this.z); }
  }
  class Quaternion { setFromUnitVectors() {} }
  class BoxGeometry { constructor(w, h, d) { this.w = w; this.h = h; this.d = d; this.isBox = true; } }
  class CylinderGeometry { constructor(r1, r2, h) { this.w = r1 * 2; this.h = h; this.d = r1 * 2; this.radius = r1; this.isCylinder = true; } }
  class Material { constructor(opts) { this.opts = opts; } }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry; this.material = material;
      this.position = new Vector3(); this.rotation = {x: 0, y: 0, z: 0};
      this.quaternion = new Quaternion();
    }
  }
  class Group {
    constructor() { this.children = []; this.position = new Vector3(); this.rotation = {x: 0, y: 0, z: 0}; this.userData = {}; }
    add(c) { this.children.push(c); return c; }
    traverse(fn) { for (const c of this.children) { fn(c); c.traverse?.(fn); } }
  }
  return {Vector3, Quaternion, BoxGeometry, CylinderGeometry, MeshStandardMaterial: Material, Mesh, Group};
}

// The body is measured from the boxes. Cylinders (wheels, pantograph rods) are
// rotated in space, which the fake cannot follow, so they are measured
// separately: only the wheels decide how deep the model reaches below y = 0.
function measure(object) {
  const box = {minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity};
  let wheelBottom = Infinity;
  object.traverse(node => {
    const g = node.geometry;
    if (!g) return;
    if (g.isBox) {
      const p = node.position;
      box.minX = Math.min(box.minX, p.x - g.w / 2); box.maxX = Math.max(box.maxX, p.x + g.w / 2);
      box.minY = Math.min(box.minY, p.y - g.h / 2); box.maxY = Math.max(box.maxY, p.y + g.h / 2);
      box.minZ = Math.min(box.minZ, p.z - g.d / 2); box.maxZ = Math.max(box.maxZ, p.z + g.d / 2);
    } else if (g.isCylinder && g.radius >= 0.3) {
      wheelBottom = Math.min(wheelBottom, node.position.y - g.radius);
    }
  });
  return {
    length: box.maxZ - box.minZ,
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    maxY: box.maxY,
    minY: box.minY,
    wheelBottom,
  };
}

test('all three axes use the mercator meter factor', () => {
  const src = read('public/radar83-map.mjs');
  assert.match(src, /\.scale\(new T\.Vector3\(scale,-scale,scale\)\)/,
    'X, Y and Z are mercator units and all three need the meter factor');
  assert.doesNotMatch(src, /\.scale\(new T\.Vector3\(scale,-scale,1\)\)/,
    'a Z of 1 hides the model completely');
});

test('the schematic train has the proportions of a modern regional EMU', () => {
  const T = fakeThree();
  const m = measure(makeVehicleMesh(T, 'train'));
  assert.ok(m.length > 42 && m.length < 47, 'train length in metres: ' + m.length.toFixed(1));
  assert.ok(m.width > 2.85 && m.width < 3.15, 'train width in metres: ' + m.width.toFixed(2));
  // Measured from the rail head to the roof: a FLIRT is about 3.85 m, the
  // raised pantograph adds roughly 0.6 m on top of that.
  const hoehe = m.maxY - m.wheelBottom;
  assert.ok(hoehe > 3.4 && hoehe < 3.95, 'train height over the rail in metres: ' + hoehe.toFixed(2));
  assert.ok(m.minY > 0.5 && m.minY < 1.0, 'the body must start above the wheel axles, minY=' + m.minY.toFixed(2));
  assert.ok(Math.abs(m.wheelBottom) < 0.05, 'the wheels must touch the ground, bottom=' + m.wheelBottom.toFixed(2));
});

test('the schematic bus has the proportions of a 12 m city bus', () => {
  const T = fakeThree();
  const m = measure(makeVehicleMesh(T, 'bus'));
  assert.ok(m.length > 11 && m.length < 13, 'bus length in metres: ' + m.length.toFixed(1));
  assert.ok(m.width > 2.6 && m.width < 2.95, 'bus width in metres: ' + m.width.toFixed(2));
  const hoehe = m.maxY - m.wheelBottom;
  assert.ok(hoehe > 2.85 && hoehe < 3.25, 'bus height over the road in metres: ' + hoehe.toFixed(2));
  assert.ok(m.minY > 0.4 && m.minY < 0.9, 'the body must start above the wheel axles, minY=' + m.minY.toFixed(2));
  assert.ok(Math.abs(m.wheelBottom) < 0.05, 'the wheels must touch the ground, bottom=' + m.wheelBottom.toFixed(2));
});

test('the real dimensions are documented in the model specification', () => {
  assert.equal(VEHICLE_SPECS.train.length, 44.5);
  assert.equal(VEHICLE_SPECS.train.width, 2.8);
  assert.equal(VEHICLE_SPECS.bus.length, 12);
});

test('the model still says that it is schematic', () => {
  const T = fakeThree();
  const train = makeVehicleMesh(T, 'train');
  assert.equal(train.userData.schematic, true);
  assert.equal(train.userData.kind, 'train');
  assert.equal(makeVehicleMesh(T, 'bus').userData.kind, 'bus');
});
