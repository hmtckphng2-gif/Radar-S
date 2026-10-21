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
test('the 3D toolbar is not covered by the fixed launch button', () => {
  // .sr40-launch sits at z-index 1060 and would cover the "2D" button of the
  // 3D view, which lives inside #sr83Viewport at z-index 835.
  const css = get('radar83.css');
  assert.match(css, /body\.sr83-cinematic \.sr40-launch\{[^}]*opacity:0/);
});

test('the 3D toolbar fits on a narrow phone', () => {
  // 9.1: Auf 390 px Breite lag der "2D"-Knopf hinter dem Werkzeugknopf.
  const css = get('radar83.css');
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /#map \.sr83-replay,#map \.sr83-back\{min-height:44px/);
});

test('the 3D layer only redraws when something changed', () => {
  // 9.2: MapLibre ruft den Layer in jedem Frame auf.
  const src = get('radar83-map.mjs');
  assert.match(src, /if\(key===this\.renderKey\)return;/);
  assert.match(src, /this\.renderKey=key;/);
});
test('the detail panel can take and give back the focus', () => {
  // 9.5
  const html = get('index.html');
  assert.match(html, /id="sheet" class="sheet" tabindex="-1"/);
  assert.match(html, /aria-labelledby="sheetTitle"/);
  assert.match(html, /id="map" role="application" tabindex="0"/);
  const src = get('app.js');
  assert.match(src, /sheet\.focus\(\{preventScroll:true\}\)/);
  assert.match(src, /\$\('map'\)\?\.focus\(\{preventScroll:true\}\)/);
});