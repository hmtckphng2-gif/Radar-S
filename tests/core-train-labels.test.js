import test from 'node:test';
import assert from 'node:assert/strict';
import {gtfsNumber,parseVehicles} from '../public/core.js';

test('official REG train labels are recognized even when the trip ID is not in the static index',()=>{
  assert.equal(gtfsNumber('REG 10227',''),'REG 10227');
  assert.equal(gtfsNumber('REG 16685',''),'REG 16685');
  assert.equal(gtfsNumber('', '16685'),'Zug 16685');
  const now=Date.now();
  const feed={header:{timestamp:String(Math.floor(now/1000))},entity:[{id:'veh-reg-10227',vehicle:{
    trip:{tripId:'not-in-static-index',routeId:'unknown-route',startDate:'20261113'},
    vehicle:{id:'10227',label:'REG 10227'},
    position:{latitude:46.64,longitude:11.35},timestamp:String(Math.floor(now/1000))
  }}]};
  const parsed=parseVehicles(feed,'trains',{},now);
  assert.equal(parsed.vehicles.length,1);
  assert.equal(parsed.vehicles[0].kind,'train');
  assert.equal(parsed.vehicles[0].name,'REG 10227');
  assert.equal(parsed.vehicles[0].nameVerified,true);
});
