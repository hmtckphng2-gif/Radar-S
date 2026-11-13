import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseVehicles, nextStopFromRows, SOURCES} from '../public/core.js';
import {sourceLabel} from '../public/radar92-details.mjs';
import {groupNearby, resolveClusterCollisions} from '../public/radar44-logic.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('GTFS route type distinguishes buses and trains independently of the feed name',()=>{
  const now=Date.now();
  const feed={entity:[
    {id:'rail-entity',vehicle:{position:{latitude:46.5,longitude:11.3},trip:{tripId:'rail-trip',routeId:'rail-route'},vehicle:{id:'ETR-1'},timestamp:now/1000}},
    {id:'bus-entity',vehicle:{position:{latitude:46.6,longitude:11.4},trip:{tripId:'bus-trip',routeId:'bus-route'},vehicle:{id:'BUS-1'},timestamp:now/1000}}
  ]};
  const indexes={trentino:{trips:{'rail-trip':['rail-route','Bozen','','',''],'bus-trip':['bus-route','Zentrum','','','']},routes:{'rail-route':['R','Regionalzug',2],'bus-route':['5','Bus',3]}}};
  const vehicles=parseVehicles(feed,'trentino',indexes,now).vehicles;
  assert.deepEqual(vehicles.map(v=>v.kind),['train','bus']);
});

test('next stop uses current_status semantics and refuses mismatched stop identity',()=>{
  const rows=[{stopId:'A',name:'Start',seq:1},{stopId:'B',name:'Mitte',seq:2},{stopId:'C',name:'Ziel',seq:3}];
  assert.equal(nextStopFromRows(rows,{currentStatus:'IN_TRANSIT_TO',currentStopSequence:2,currentStopId:'B'}).name,'Mitte');
  assert.equal(nextStopFromRows(rows,{currentStatus:'STOPPED_AT',currentStopSequence:2,currentStopId:'B'}).name,'Ziel');
  assert.equal(nextStopFromRows(rows,{currentStatus:'INCOMING_AT',currentStopSequence:3,currentStopId:'C'}).name,'Ziel');
  assert.equal(nextStopFromRows(rows,{currentStatus:'STOPPED_AT',currentStopSequence:2,currentStopId:'A'}),null);
  assert.equal(nextStopFromRows(rows,{currentStopSequence:2}),null);
});

test('source labels identify the operator and feed transport accurately',()=>{
  assert.equal(sourceLabel('sta'),'südtirolmobil (STA · BusOne)');
  assert.equal(sourceLabel('sta_direct'),'südtirolmobil (STA · Open Data Hub)');
  assert.equal(sourceLabel('trentino'),'Trentino Trasporti (BusOne)');
  assert.equal(sourceLabel('trains'),'Trenitalia (BusOne)');
});

test('all requested realtime feed families are wired once through the current endpoints',()=>{
  const worker=read('../worker.js');
  for(const endpoint of [
    'proxy.busone.app/sta/gtfs-rt/vehicle-positions.json',
    'gtfs.api.opendatahub.com/v1/realtime/sta-time-tables/vehicle-positions',
    'proxy.busone.app/trentino/gtfs-rt/vehicle-positions.json',
    'proxy.busone.app/trenitalia/gtfs-rt/vehicle-positions.json'
  ])assert.ok(worker.includes(endpoint),endpoint);
  assert.deepEqual(SOURCES,['sta','trentino','trains']);
  assert.ok(read('../public/app.js').includes("const DIRECT_POSITION_SOURCES=['sta_direct']"));
});

test('train and bus markers keep distinct blue and orange visual identities',()=>{
  const styles=read('../public/styles.css');
  const app=read('../public/app.js');
  assert.ok(styles.includes('background:linear-gradient(150deg,#45a5ff,#1e62d8)'));
  assert.ok(styles.includes('background:linear-gradient(160deg,#ffb94b,#d57900)')); 
  assert.ok(app.includes("(train?'train':'bus')"));
});

test('zoom clustering separates vehicle kinds nearby and merges safely at far zoom',()=>{
  const points=[{key:'train',x:100,y:100,kind:'train'},{key:'bus',x:110,y:105,kind:'bus'}];
  const separated=groupNearby(points,44,null,'kind');
  assert.equal(separated.clusters.length,0);
  assert.equal(separated.singles.length,2);
  const mixed=groupNearby(points,44,null,'all');
  assert.equal(mixed.clusters.length,1);
  assert.equal(mixed.clusters[0].count,2);
  const placed=resolveClusterCollisions([
    {keys:['a'],count:1,buses:1,trains:0,staleCount:0,x:100,y:100},
    {keys:['b'],count:1,buses:0,trains:1,staleCount:0,x:102,y:101}
  ],{width:300,height:300},{markerWidth:58,markerHeight:34,gap:8,padding:40});
  assert.equal(placed.length,1);
  assert.equal(placed[0].count,2);
});

test('vehicle details expose a next-stop row without inventing a missing stop',()=>{
  const app=read('../public/app.js');
  assert.ok(app.includes("detail('Nächster Halt',nextStop?formatStationName(nextStop.name):'Unbekannt')"));
  assert.ok(app.includes('nextStopFromRows(stopRows(details,v.tripId),v)'));
});
