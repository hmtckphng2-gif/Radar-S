import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('nearby panel shows grouped stations with real line, destination and minutes',()=>{
 const app=read('app.js');
 assert.match(app,/groupNearbyStops\(nearest\)/);
 assert.match(app,/buildDepartureRows\(group\.members/);
 assert.match(app,/nextNearbyDepartures\(mergeStationDepartures\(result\.rows\),now,3\)/);
 assert.match(app,/dep\.number.*formatStationName\(dep\.headsign\)/);
 assert.match(app,/in '\+dep\.minutes\+' Min\./);
});
test('nearby panel fits an iPhone Safari width of about 390px',()=>{
 const css=read('radar86-preview-block2.css');
 assert.match(css,/width:min\(330px,calc\(100vw - 24px\)\)/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(css,/sr86-nearby-departures/);
 assert.match(css,/sr86-nearby-departure/);
});
