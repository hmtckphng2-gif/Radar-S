import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../public/'+name, import.meta.url),'utf8');
test('FLIRT cinematic loads real MapLibre 3D, never old floating 2D model',()=>{
 const camera=read('radar71-camera.mjs'),index=read('index.html');
 assert.match(camera,/import \{Radar83Cinematic\} from '\.\/radar83-map\.mjs(?:\?v=[0-9.]+)?'/);
 assert.match(camera,/new Radar83Cinematic\(map/);
 assert.match(camera,/cinema3d\.open\(/);
 assert.match(camera,/map\.flyTo\(/);
 assert.doesNotMatch(camera,/new Vehicle3DOverlay|import \{Vehicle3DOverlay\}/);
 assert.match(index,/radar83\.css\?v=/);
 assert.match(read('radar83-map.mjs'),/class Radar83Cinematic/);
 assert.match(read('radar83-map.mjs'),/type:'custom',renderingMode:'3d'/);
 assert.match(read('radar83-model.mjs'),/FLIRT-inspiriertes 3D-Modell/);
});
