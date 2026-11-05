import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeVehicleMesh,makeContactShadow,modelCreditText,normalizeModel,VEHICLE_SPECS,frontAxisYaw,modelYawRadians} from '../public/radar83-model.mjs';
import {modelWorldBearing,modelWorldDirection} from '../public/radar83-logic.mjs';

/* Radar 8.5 - the 3D model must be right in every respect.
 *
 * Three real findings are locked down here:
 *
 * 1. The GLTFLoader imports "three" as a bare specifier. It only works
 *    because the import map in index.html points it at exactly the same
 *    three build the app loads. Two different copies would break every
 *    instanceof check inside the loader.
 *
 * 2. X, Y and Z all need the mercator meter factor. Scaling Z with 1
 *    instead makes the model disappear completely, scaling it wrongly
 *    flattens the model to a painted stripe on the ground.
 *
 * 3. A downloaded model is measured, never assumed. It is scaled to the
 *    real dimensions, put on the ground and centred. And because CC BY
 *    requires the author to be named, every real model carries a credit.
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
  class Box3 {
    setFromObject(o) {
      const s = o.userData.size, m = o.userData.min;
      this.min = new Vector3(m.x, m.y, m.z);
      this.max = new Vector3(m.x + s.x, m.y + s.y, m.z + s.z);
      return this;
    }
    getSize(t) { t.set(this.max.x - this.min.x, this.max.y - this.min.y, this.max.z - this.min.z); return t; }
    getCenter(t) { t.set((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, (this.min.z + this.max.z) / 2); return t; }
  }
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
    constructor() {
      this.children = []; this.position = new Vector3();
      this.rotation = {x: 0, y: 0, z: 0};
      this.scale = {setScalar(v) { this.v = v; return this; }};
      this.userData = {};
    }
    add(c) { this.children.push(c); return c; }
    traverse(fn) { for (const c of this.children) { fn(c); c.traverse?.(fn); } }
  }
  return {Vector3, Quaternion, Box3, BoxGeometry, CylinderGeometry, MeshStandardMaterial: Material, Mesh, Group};
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
  assert.equal(JSON.parse(map[1]).imports.three, threeUrl[1], 'app and loader must load the same three build');
});

test('the GLTFLoader is loaded from the same package as three', () => {
  const model = read('public/radar83-model.mjs');
  const loader = model.match(/const GLTF_URL='([^']+)'/);
  assert.ok(loader, 'radar83-model.mjs must declare const GLTF_URL');
  assert.ok(loader[1].includes('three@0.160.1'), 'the loader must match the three version');
  assert.ok(!loader[1].includes('+esm'), 'the +esm build would pull a second copy of three');
});

test('the loader gets the Meshopt decoder for the compressed models', () => {
  const model = read('public/radar83-model.mjs');
  assert.match(model, /setMeshoptDecoder/);
  assert.match(model, /meshopt_decoder\.module\.js/);
});

test('all three axes use the mercator meter factor', () => {
  const src = read('public/radar83-map.mjs');
  assert.match(src, /\.scale\(new T\.Vector3\(scale,-scale,scale\)\)/,
    'X, Y and Z are mercator units and all three need the meter factor');
  assert.doesNotMatch(src, /\.scale\(new T\.Vector3\(scale,-scale,1\)\)/,
    'a Z of 1 hides the model completely');
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
    assert.ok(['length', 'height'].includes(entry.scaleBy), kind + ' needs a valid scaleBy');
  }
});

test('a downloaded model is measured, not guessed: it is scaled to the real length', () => {
  const T = fakeThree();
  const object = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const result = normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, scaleBy: 'length', yawOffset: 0}, T);
  assert.ok(result);
  assert.ok(Math.abs(result.scale - 44.5 / 40) < 1e-6, 'scale follows the real length');
  assert.equal(result.rotated, false, 'the long axis already runs along Z');
  assert.equal(result.scaledBy, 'length');
});

test('a model that is too flat can be scaled by its height instead', () => {
  const T = fakeThree();
  // The FLIRT model: 31.96 m long, 1.53 m wide, 2.03 m high - too flat.
  const object = fakeModel({x: 1.53, y: 2.03, z: 31.96}, {x: -0.98, y: -1.17, z: -2.91});
  const result = normalizeModel(object, {lengthMeters: 44.5, heightMeters: 3.85, scaleBy: 'height', yawOffset: 0}, T);
  assert.equal(result.scaledBy, 'height');
  assert.ok(Math.abs(result.scale - 3.85 / 2.03) < 1e-6, 'the height is the reference');
  // 31.96 m * 1.896 = about 60 m, which is a FLIRT.
  assert.ok(31.96 * result.scale > 55 && 31.96 * result.scale < 65);
});

test('a model authored along X is turned so that it runs along Z', () => {
  const T = fakeThree();
  const object = fakeModel({x: 40, y: 4, z: 2}, {x: -20, y: 1, z: -1});
  const result = normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, scaleBy: 'length', yawOffset: 0}, T);
  assert.equal(result.rotated, true, 'the model must be rotated');
  assert.ok(Math.abs(result.scale - 44.5 / 40) < 1e-6);
});

test('the model stands on the ground and is centred', () => {
  const T = fakeThree();
  const object = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  normalizeModel(object, {lengthMeters: 44.5, heightMeters: 4.1, scaleBy: 'length', yawOffset: 0}, T);
  assert.equal(object.position.y, -1, 'the lowest point must end up at y = 0');
  assert.equal(object.position.x, 0, 'the model must be centred in X');
  assert.equal(object.position.z, 0, 'the model must be centred in Z');
});

test('a model that cannot be measured is rejected instead of being shown wrong', () => {
  const T = fakeThree();
  assert.equal(normalizeModel(fakeModel({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0}), {lengthMeters: 44.5}, T), null);
  assert.equal(normalizeModel(fakeModel({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: 0}), {lengthMeters: 0}, T), null);
  assert.equal(normalizeModel(null, {lengthMeters: 44.5}, T), null);
});

test('CC BY requires the author to be named, so a real model always shows a credit', () => {
  const without = modelCreditText(null, false);
  assert.match(without, /schematisch/, 'without a model the view stays labelled as schematic');
  const withCredit = modelCreditText({title: 'RABe 523', author: 'hotdoghans', license: 'CC BY 4.0'}, true);
  assert.match(withCredit, /hotdoghans/, 'the author must be visible');
  assert.match(withCredit, /CC BY 4\.0/, 'the license must be visible');
  assert.match(withCredit, /Datenfeed/, 'the feed origin must stay visible');
  // A credit without author or license is not usable and must not be shown.
  assert.match(modelCreditText({title: 'RABe 523'}, true), /schematisch/);
});

test('the schematic model stays available as the fallback', () => {
  const T = fakeThree();
  const train = makeVehicleMesh(T, 'train');
  assert.equal(train.userData.schematic, true);
  assert.equal(train.userData.kind, 'train');
  assert.equal(makeVehicleMesh(T, 'bus').userData.kind, 'bus');
  const map = read('public/radar83-map.mjs');
  assert.match(map, /this\.object=makeVehicleMesh\(T,kind\);this\.scene\.add\(this\.object\);/);
  assert.match(map, /loadVehicleModel\(kind,T\)/);
  assert.match(map, /modelKind='schematic'/);
  assert.match(map, /modelKind='real'/);
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

test('every configured model file exists and is a valid GLB', () => {
  const config = JSON.parse(read('public/models/models.json'));
  for (const [kind, entry] of Object.entries(config.models)) {
    if (!entry.file) continue;
    const path = root + 'public/models/' + entry.file;
    assert.ok(existsSync(path), kind + ': ' + entry.file + ' fehlt');
    const head = readFileSync(path).subarray(0, 4).toString('ascii');
    assert.equal(head, 'glTF', kind + ': ' + entry.file + ' ist kein gueltiges GLB');
  }
});

test('a real model carries the credit that CC BY requires', () => {
  const config = JSON.parse(read('public/models/models.json'));
  for (const [kind, entry] of Object.entries(config.models)) {
    if (!existsSync(root + 'public/models/' + entry.file)) continue;
    assert.ok(entry.credit, kind + ' braucht einen Credit');
    assert.ok(entry.credit.author, kind + ' braucht einen Autor');
    assert.ok(entry.credit.license, kind + ' braucht eine Lizenzangabe');
    assert.match(entry.credit.license, /CC|Creative Commons/i, kind + ': die Lizenz muss eine Namensnennung erlauben');
    assert.ok(entry.credit.source, kind + ' braucht die Quelle');
  }
});

test('a model authored the wrong way round can be turned with frontAxis', () => {
  const T = fakeThree();
  const straight = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const flipped = fakeModel({x: 2, y: 4, z: 40}, {x: -1, y: 1, z: -20});
  const a = normalizeModel(straight, {lengthMeters: 44.5, heightMeters: 4.1, scaleBy: 'length', yawOffset: 0}, T);
  const b = normalizeModel(flipped, {lengthMeters: 44.5, heightMeters: 4.1, scaleBy: 'length', yawOffset: 0, frontAxis: '+z'}, T);
  assert.equal(a.object.rotation.y, 0, 'ohne frontAxis bleibt die Ausrichtung');
  assert.ok(Math.abs(b.object.rotation.y - Math.PI) < 1e-9, 'frontAxis +z dreht um 180 Grad');
});

test('the contact shadow is flat, transparent and free of textures', () => {
  const T = fakeThree();
  T.CircleGeometry = class { constructor(r, s) { this.radius = r; this.segments = s; } };
  T.MeshBasicMaterial = class { constructor(o) { this.opts = o; } };
  T.Mesh = class { constructor(g, m) { this.geometry = g; this.material = m; this.position = new T.Vector3(); this.rotation = {x: 0, y: 0, z: 0}; } };
  const shadow = makeContactShadow(T, 14);
  assert.equal(shadow.children.length, 2, 'zwei Scheiben fuer einen weichen Verlauf');
  for (const disc of shadow.children) {
    assert.equal(disc.material.opts.transparent, true, 'der Schatten muss transparent sein');
    assert.equal(disc.material.opts.depthWrite, false, 'der Schatten darf nichts verdecken');
    assert.equal(disc.material.opts.map, undefined, 'keine Textur, das waere auf dem Handy zu teuer');
    assert.equal(disc.rotation.x, -Math.PI / 2, 'der Schatten liegt flach auf der Karte');
  }
});
test('the bus is turned around because its front points to +z', () => {
  // Aus den GLB-Knoten abgeleitet: das Armaturenbrett sitzt bei z = +4,00,
  // der Auspuff bei z = -7,05. Die Nase zeigt nach +z, die App erwartet -z.
  const config = JSON.parse(read('public/models/models.json'));
  assert.equal(config.models.bus.frontAxis, '+z', 'der Citaro muss um 180 Grad gedreht werden');
  // Der FLIRT hat zwei Fuehrerhaus, seine Ausrichtung ist ohne Bedeutung.
  assert.equal(config.models.train.frontAxis, '-z');
});
/* 9.7 - the direction of the model is proved with the real files.
 *
 * The 3D transform of the vehicle layer is
 *   translate * scale(s,-s,s) * rotateX(90) * rotateY(-heading)
 * A model whose nose sits at -z therefore points exactly along the heading,
 * that is along the direction of travel. The Citaro is authored the other way
 * round (the dashboard sits at z = +4.0, the exhaust at z = -7.05), so it has
 * to be turned by 180 degrees. Without that turn the bus drives backwards.
 */
function glbNodes(file){
  const buf=readFileSync(root+'public/models/'+file);
  const len=buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20,20+len).toString('utf8')).nodes||[];
}
function nodePosition(nodes,name){
  const node=nodes.find(n=>n.name===name);
  return node?(node.translation||[0,0,0]):null;
}
function turnY(v,yaw){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  return [c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];
}
function angleDiff(a,b){
  return Math.abs(((a-b+540)%360)-180);
}

test('a nose at -z points along the heading', () => {
  for (const heading of [0,45,90,137,180,270,359]) {
    const bearing=modelWorldBearing([0,0,-1],heading);
    assert.ok(angleDiff(bearing,heading)<0.001,
      'bei '+heading+' Grad zeigt die Nase auf '+bearing+' Grad');
  }
});

test('the bus shows its nose in the direction of travel', () => {
  const nodes=glbNodes('bus.glb');
  const dash=nodePosition(nodes,'Object020_dash_Base_Color_0');
  const exhaust=nodePosition(nodes,'exhaust0_Material__25_0');
  assert.ok(dash&&exhaust,'die Teile des Busses wurden nicht gefunden');
  assert.ok(dash[2]>0&&exhaust[2]<0,'das Armaturenbrett muss vorne und der Auspuff hinten liegen');
  const nose=[dash[0]-exhaust[0],dash[1]-exhaust[1],dash[2]-exhaust[2]];
  const config=JSON.parse(read('public/models/models.json'));
  const turned=turnY(nose,frontAxisYaw(config.models.bus));
  for (const heading of [0,37,90,180,275]) {
    const bearing=modelWorldBearing(turned,heading);
    assert.ok(angleDiff(bearing,heading)<5,
      'bei '+heading+' Grad zeigt die Nase auf '+Math.round(bearing)+' Grad');
  }
});

test('without the turn the bus would drive backwards', () => {
  const nodes=glbNodes('bus.glb');
  const dash=nodePosition(nodes,'Object020_dash_Base_Color_0');
  const exhaust=nodePosition(nodes,'exhaust0_Material__25_0');
  const nose=[dash[0]-exhaust[0],dash[1]-exhaust[1],dash[2]-exhaust[2]];
  for (const heading of [0,37,90,180,275]) {
    const bearing=modelWorldBearing(nose,heading);
    assert.ok(angleDiff(bearing,heading)>170,
      'ohne die Drehung zeigt die Nase gegen die Fahrtrichtung');
  }
});

test('the 3D transform still matches the direction reference', () => {
  // Wenn sich die Reihenfolge der Drehungen aendert, stimmt die Referenz
  // nicht mehr. Dieser Test haelt beides zusammen.
  const src=read('public/radar83-map.mjs');
  assert.match(src,/\.scale\(new T\.Vector3\(scale,-scale,scale\)\)/);
  assert.match(src,/makeRotationX\(Math\.PI\/2\)/);
  assert.match(src,/makeRotationY\(modelYawRadians\(heading\)\)/);
  assert.equal(modelYawRadians(90),-Math.PI/2,'die Drehung ist -heading');
  const up=modelWorldDirection([0,1,0],0);
  assert.ok(Math.abs(up.up-1)<1e-9,'die Hoehe bleibt oben');
});