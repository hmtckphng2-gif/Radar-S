import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('the 2D map defaults to a dark basemap and retains two manual fallbacks',()=>{
 const app=read('app.js');
 const start=app.indexOf('const TILE_PROVIDERS=['),end=app.indexOf('];',start)+2;
 const providers=app.slice(start,end);
 assert.ok(providers.indexOf("name:'CARTO Dark'")<providers.indexOf("name:'OpenStreetMap'"));
 assert.ok(providers.includes('basemaps.cartocdn.com/dark_all/'));
 assert.ok(providers.includes("name:'OSM HOT'"));
 assert.match(app,/let tileProviderIndex=0;/);
});
test('the map incident ticker and delay legend do not cover the live map',()=>{
 const css=read('radar94-preview-block1.css');
 assert.match(css,/#alertTicker,\.sr-delay-legend\{display:none!important\}/);
});
test('changed map and overlay assets have fresh cache keys',()=>{
 const html=read('index.html');
 assert.ok(html.includes('rev6=dark-base-map-2'));
 assert.ok(html.includes('rev=dark-map-clean-ui-2'));
});
