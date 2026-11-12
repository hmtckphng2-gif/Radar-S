import test from 'node:test';
import assert from 'node:assert/strict';
import {groupNearbyStops,nextNearbyDepartures} from '../public/radar93-nearby.mjs';
const station=(name,lat,lon,source='sta',stopId='1',distance=100)=>({name,lat,lon,source,stopId,distance});
test('nearby stops with same name and close coordinates are grouped across feeds',()=>{
 const groups=groupNearbyStops([station('Pochi',46,11,'sta','1'),station('POCHI',46.00005,11,'trentino','2',120)]);
 assert.equal(groups.length,1);assert.equal(groups[0].members.length,2);
});
test('same-name stops at distinct locations remain separate for direction labels',()=>{
 const groups=groupNearbyStops([station('Pochi',46,11,'sta','1'),station('Pochi',46.003,11,'sta','2',250)]);
 assert.equal(groups.length,2);assert.notEqual(groups[0].station.stopId,groups[1].station.stopId);
});
test('different stop names are not merged just because their coordinates are close',()=>{
 assert.equal(groupNearbyStops([station('Pochi',46,11),station('Montan',46.00001,11,'sta','2')]).length,2);
});
test('nearby departures use live forecast when supplied and schedule otherwise',()=>{
 const rows=nextNearbyDepartures([
  {sec:36120,forecast:36060,delaySec:-60,number:'16685',headsign:'Meran'},
  {sec:36240,forecast:null,delaySec:null,number:'5',headsign:'Bozen'},
  {sec:35900,forecast:null,delaySec:null,number:'6',headsign:'Auer'},
  {sec:36300,forecast:36300,delaySec:0,number:'7',headsign:'Kalter'},
 ],36000,3);
 assert.deepEqual(rows.map(x=>x.number),['16685','5','7']);
 assert.equal(rows[0].minutes,1);assert.equal(rows[0].live,true);
 assert.equal(rows[1].minutes,4);assert.equal(rows[1].live,false);
});
test('nearby departure list is capped at three and missing times are excluded',()=>{
 const rows=nextNearbyDepartures([{sec:36100},{sec:36200},{sec:36300},{sec:36400},{sec:null}],36000,3);
 assert.equal(rows.length,3);
});
