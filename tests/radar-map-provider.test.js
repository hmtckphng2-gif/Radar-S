import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync('public/app.js','utf8');
const html=readFileSync('public/index.html','utf8');
const css=readFileSync('public/radar-map-base.css','utf8');
test('Leaflet uses OSM as the only basemap and CARTO is removed',()=>{
  assert.match(app,/https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.doesNotMatch(app,/cartocdn|carto\.com|TILE_PROVIDERS|switchTileProvider/);
  assert.match(app,/const MAP_BASE_NAME='OpenStreetMap · S-Radar Dark'/);
  assert.doesNotMatch(html,/id="tileBtn"/);
});
test('dark filter applies only to raster tile pane, not S-Radar overlays',()=>{
  assert.match(css,/#map \.leaflet-tile-pane/);
  assert.match(app,/state\.layer=L\.layerGroup\(\)\.addTo\(map\)/);
  assert.match(app,/state\.trackLayer=L\.layerGroup\(\)\.addTo\(map\)/);
});
test('the custom 3D map overlay remains in the page',()=>{
  assert.match(html,/radar71-camera\.mjs/);
});
