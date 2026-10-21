import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get = name => readFileSync(new URL('../public/'+name, import.meta.url), 'utf8');
test('5.7 station monitor never overrides map/home at startup', () => {
  const src=get('radar57.js');
  assert.match(src, /const is=location\.hash==='#departures'/);
  assert.doesNotMatch(src, /original\('departures'\)/);
});
test('7.0 navigation starts independently of the old 6.0 UI', () => {
  const src=get('radar70.js');
  assert.doesNotMatch(src, /!document\.body\.classList\.contains\('sr60'\)/);
  assert.match(src, /\['home','Home','home'\].*\['departures','Abfahrten','train'\]/);
});
test('camera retains focus without rendering a fake floating vehicle model', () => {
  const src=get('radar71-camera.mjs');
  assert.doesNotMatch(src, /new Vehicle3DOverlay|import \{Vehicle3DOverlay\}/);
  assert.match(src, /map\.flyTo\(/);
  assert.match(get('radar82.css'), /#map \.sr82-model-canvas\{display:none!important\}/);
});
