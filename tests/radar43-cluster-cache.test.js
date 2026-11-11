import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/radar43.js',import.meta.url),'utf8');
const render=src.slice(src.indexOf('function renderClusters(){'),src.indexOf('function updateMini(){'));
test('stable cluster renderer remains active after safe rollback',()=>{
 assert.match(render,/resolveClusterCollisions\(grouped\.clusters/);
 assert.match(render,/clusters\.clearLayers\(\)/);
 assert.doesNotMatch(render,/clusterCache/);
});
