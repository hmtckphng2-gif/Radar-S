import test from 'node:test';
import assert from 'node:assert/strict';
import {findStations} from '../public/radar51-logic.mjs';
import {groupStationChoices,formatConnectionStationChoice,findItineraries} from '../public/radar692-journey.mjs';
import {sourceLabel} from '../public/radar92-details.mjs';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('German Bozen query finds Italian Bolzano station names',()=>{
 const stations=[{source:'trains',stopId:'rail',name:'BOLZANO',lat:46.498,lon:11.354},{source:'sta',stopId:'bus',name:'Bolzano',lat:46.4981,lon:11.3541}];
 const matches=findStations(stations,'bozen',stations.length);
 assert.ok(matches.some(s=>s.name==='BOLZANO'));
 assert.ok(matches.some(s=>s.name==='Bolzano'));
});

test('identical nearby stop names group by source and retain every stop ID',()=>{
 const stations=[
  {source:'sta',stopId:'s1',name:'BOLZANO',lat:46.498,lon:11.354},
  {source:'sta',stopId:'s2',name:'Bolzano',lat:46.4982,lon:11.3541},
  {source:'sta',stopId:'s3',name:'Bolzano, Stazione di Bolzano',lat:46.4981,lon:11.354},
  {source:'sta',stopId:'s4',name:'Bolzano',lat:46.504,lon:11.354},
  {source:'trains',stopId:'rail',name:'BOLZANO',lat:46.498,lon:11.354}
 ];
 const groups=groupStationChoices(stations);
 assert.equal(groups.length,3);
 const local=groups.find(g=>g.source==='sta'&&g.stopIds.includes('s1'));
 assert.deepEqual(local.stopIds,['s1','s2','s3']);
 assert.equal(local.stopCount,3);
 assert.equal(groups.find(g=>g.source==='trains').stopIds.length,1);
});

test('Bolzano train station and source use clear German names',()=>{
 const label=formatConnectionStationChoice({source:'trains',name:'BOLZANO',stopIds:['rail']});
 assert.equal(label,'Bolzano/Bozen Bahnhof · Zug');
 assert.equal(sourceLabel('trains'),'Zug');
});

test('STA duplicates are represented as one choice with a stop count',()=>{
 const group=groupStationChoices([
  {source:'sta',stopId:'s1',name:'Bolzano',lat:46.498,lon:11.354},
  {source:'sta',stopId:'s2',name:'Bolzano',lat:46.4981,lon:11.354}
 ])[0];
 assert.equal(formatConnectionStationChoice(group),'Bolzano · STA · 2 Haltestellen');
});

test('journey search accepts grouped origin and destination stop IDs',()=>{
 const index={meta:{ready:true},trips:{t1:['r','','','R 1','',true]},routes:{r:['R1','',2]}};
 const details={times:{t1:[['o2',36000,36000],['x',36600,36600],['d2',37200,37200] ]}};
 const result=findItineraries({index,details,origin:['o1','o2'],destination:['d1','d2'],nowSeconds:35000});
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].legs[0].id,'t1');
});

test('connection search uses all grouped stop IDs and has bottom-safe scrolling',()=>{
 const app=read('radar692.js'),css=read('radar692.css');
 assert.ok(app.includes('groupStationChoices(matches).slice(0,7)'));
 assert.ok(app.includes('origin:a.stopIds?.length?a.stopIds:a.stopId'));
 assert.ok(css.includes('padding-bottom:calc(104px + env(safe-area-inset-bottom,0px))'));
 assert.ok(css.includes('max-height:min(42dvh,320px)'));
});

test('the function page is named Verbindungen in every active bottom navigation',()=>{
 const native=read('radar50.js'),compact=read('radar60.js'),home=read('radar70-redesign.mjs');
 assert.ok(native.includes("['stats','↔','Verbindungen']"));
 assert.ok(compact.includes("['stats','Verbindungen']"));
 assert.ok(home.includes("['stats','Verbindungen','route']"));
});
