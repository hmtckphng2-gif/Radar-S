import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/radar43.js',import.meta.url),'utf8');
const render=src.slice(src.indexOf('function renderClusters(){'),src.indexOf('function updateMini(){'));
test('vehicle cluster groups are cached instead of destroyed on every pan or zoom',()=>{
 assert.match(src,/const clusterCache=new Map\(\)/);
 assert.doesNotMatch(render,/clusters\.clearLayers\(\)/);
 assert.match(render,/clusterCache\.get\(signature\)/);
 assert.match(render,/clusterCache\.set\(signature,record\)/);
 assert.match(render,/clusters\.removeLayer\(record\.marker\)/);
});
test('vehicle groups are prepared beyond the visible map viewport',()=>{
 assert.match(render,/map\.getBounds\(\)\.pad\(\.9\)/);
 assert.match(render,/const outside=grouped\.clusters\.filter/);
 assert.match(render,/\.\.\.outside/);
});
test('zooming in hides the cluster layer without destroying its markers',()=>{
 assert.match(render,/if\(zoom>10\)\{[\s\S]*?clusters\.remove\(\)/);
 assert.match(render,/clusters\.addTo\(map\)/);
});
