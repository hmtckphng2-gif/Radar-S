import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveScheduleTripId,stopRows} from '../public/core.js';
import {trainScheduledPosition} from '../public/radar51-logic.mjs';
const now=new Date('2026-10-27T06:00:00+01:00');
function fixture(){
 const indexes={trains:{meta:{ready:true,days:['2026-10-27']},trips:{'static-trip-16709':['route-a','Bozen - Trient','shape-a','16709','service-a',true,'0']}}};
 const details={trains:{stops:{'stop-a':['Bozen',46.6,11.3,'1',''],'stop-b':['Trient',46.61,11.31,'2','']},times:{'static-trip-16709':[['stop-a',21400,21500,1],['stop-b',22500,22600,2]]}}};
 const shapes={trains:{shapes:{'shape-a':[[46.6,11.3],[46.61,11.31],[46.62,11.32]]}}};
 const vehicle={kind:'train',source:'trains',tripId:'realtime-trip-id',routeId:'route-a',shapeId:'shape-a',directionId:'0',name:'Zug 16709',headsign:'Bozen - Trient',tripStartDate:'20261027',rawLat:46.605,rawLon:11.305,lat:46.605,lon:11.305};
 return {indexes,details,shapes,vehicle};
}
test('resolves a uniquely matching active GTFS trip when realtime trip ID differs',()=>{const f=fixture();assert.equal(resolveScheduleTripId(f.vehicle,f.indexes,f.details,now),'static-trip-16709');assert.equal(stopRows(f.details.trains,'static-trip-16709').length,2)});
test('does not guess when more than one static trip matches',()=>{const f=fixture();f.indexes.trains.trips['static-trip-16709-alt']=['route-a','Bozen - Trient','shape-b','16709','service-b',true,'0'];f.details.trains.times['static-trip-16709-alt']=[['stop-a',21400,21500,1],['stop-b',22500,22600,2]];f.vehicle.shapeId='';assert.equal(resolveScheduleTripId(f.vehicle,f.indexes,f.details,now),'')});
test('calculates train Soll position from the resolved static trip',()=>{const f=fixture();const result=trainScheduledPosition(f.vehicle,f.indexes,f.details,f.shapes,now);assert.ok(result);assert.equal(result.from,'Bozen');assert.equal(result.to,'Trient');assert.ok(Number.isFinite(result.differenceKm))});

test('the vehicle sheet always includes an Ist/Soll row and refreshes after GTFS data loads',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.match(app,/detail\('Ist \/ Soll'/);
 assert.match(app,/resolveScheduleTripId\(v,state\.indexes,details\)/);
 assert.match(app,/Promise\.all\(\[indexes,rail\]\)/);
 assert.match(sw,/radar-shell-v9\.9\.0-vehicle-schedule-fix/);
});
