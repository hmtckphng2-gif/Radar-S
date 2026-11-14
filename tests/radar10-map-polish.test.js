import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('the 2D map uses one darkened OSM Leaflet basemap and preserves S-Radar overlays',()=>{
 const app=read('app.js');
 assert.match(app,/MAP_BASE_URL='https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png'/);
 assert.doesNotMatch(app,/cartocdn|carto\.com|CARTO|TILE_PROVIDERS|switchTileProvider/);
 assert.match(app,/state\.layer=L\.layerGroup\(\)\.addTo\(map\)/);
 assert.match(app,/state\.trackLayer=L\.layerGroup\(\)\.addTo\(map\)/);
});
test('the map incident ticker and delay legend do not cover the live map',()=>{
 const css=read('radar94-preview-block1.css');
 assert.match(css,/#alertTicker,\.sr-delay-legend\{display:none!important\}/);
});
test('changed map and overlay assets have fresh cache keys',()=>{
 const html=read('index.html');
 assert.ok(html.includes('rev6=osm-leaflet-base-1'));
 assert.ok(html.includes('rev=dark-map-clean-ui-2'));
 assert.ok(html.includes('radar-map-base.css?v=9.9.5&rev=osm-dark-1'));
});
