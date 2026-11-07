import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../public/radar83.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('Leaflet 2D remains on layer 2 and cinematic 3D is above it on layer 3', () => {
  assert.match(css, /#map\s*\{[^}]*isolation\s*:\s*isolate/s);
  assert.match(css, /#map\s*>\.leaflet-map-pane\s*\{\s*z-index\s*:\s*2\s*!important\s*\}/);
  assert.match(css, /#map\s*>\.leaflet-control-container\s*\{\s*z-index\s*:\s*2\s*!important\s*\}/);
  assert.match(css, /#map\s*>\.sr83-viewport\s*\{\s*z-index\s*:\s*3\s*!important\s*\}/);
  assert.match(css, /body\.sr83-cinematic\s+#map\s*>\.leaflet-control-container\s*\{[^}]*pointer-events\s*:\s*none/s);
  assert.match(html, /radar83\.css\?v=9\.9\.5&layers=2d2-3d3/);
});
