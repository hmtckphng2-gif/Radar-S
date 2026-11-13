import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTimetable,searchJourneys,transferAssessment,nearbyStops} from '../public/radar70-route.mjs';
const day='2026-10-19';
function sample(){
 const indexes={trains:{meta:{ready:true,days:[day]},routes:{r:['REG','','2']},trips:{t:['r','Transfer Town','','17120','',true]}},sta:{meta:{ready:true,days:[day]},routes:{b:['8','','3']},trips:{u:['b','Destination','','','',true]}}};
 const details={trains:{stops:{A:['Start',46.5,11.30,'2'],X:['Rail Station',46.52,11.32,'1']},times:{t:[['A',36000,36000,1],['X',37200,37200,2]]}},sta:{stops:{Y:['Bus Station',46.5207,11.3205,'E'],B:['Destination',46.54,11.35,'']},times:{u:[['Y',37680,37680,1],['B',38880,38880,2]]}}};
 return buildTimetable(indexes,details,day);
}
test('finds rail-bus transfer across GTFS sources',()=>{const n=sample();const r=searchJourneys(n,{source:'trains',stopId:'A'},{source:'sta',stopId:'B'},35900,{maxLegs:2});assert.ok(r.results.length>0,r.reason);assert.equal(r.results[0].legs.length,2);assert.equal(r.results[0].legs[0].source,'trains');assert.equal(r.results[0].legs[1].source,'sta');});
test('rejects departures before walking and boarding buffer',()=>{const n=sample();n.trips[1].calls[0].departure=37230;for(const rows of n.departures.values())for(const v of rows)if(v.idx===1)v.time=37230;const r=searchJourneys(n,{source:'trains',stopId:'A'},{source:'sta',stopId:'B'},35900,{maxLegs:2});assert.equal(r.results.length,0);});
test('requires both forecasts before a live transfer decision',()=>{const p=transferAssessment({arrival:1800,departure:2100,walkSeconds:120});assert.equal(p.live,false);assert.equal(p.status,'possible');const l=transferAssessment({arrival:1800,departure:2100,walkSeconds:120,liveArrival:2080,liveDeparture:2100});assert.equal(l.live,true);assert.equal(l.status,'missed');});
test('refuses single-leg cross-source route and distant stops',()=>{const n=sample();assert.equal(nearbyStops(n,{lat:48,lon:13}).length,0);assert.equal(searchJourneys(n,{source:'trains',stopId:'A'},{source:'sta',stopId:'B'},35900,{maxLegs:1}).results.length,0);});
