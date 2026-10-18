import test from 'node:test';
import assert from 'node:assert/strict';
const logic=await import('../public/train-platforms-logic.mjs').catch(()=>({}));
const day='2026-10-18', stamp=Date.parse('2026-10-18T17:15:00Z');
const raw={numeroTreno:17270,fermate:[{id:'S02026',stazione:'BOLZANO',partenza_teorica:Date.parse('2026-10-18T17:02:00Z'),arrivo_teorico:Date.parse('2026-10-18T16:59:00Z'),binarioProgrammatoPartenzaDescrizione:'3',binarioEffettivoPartenzaDescrizione:'4'},{id:'S02001',stazione:'BRENNERO',arrivo_teorico:Date.parse('2026-10-18T18:22:00Z'),binarioProgrammatoArrivoDescrizione:'7'}]};
const context={number:'17270',serviceDay:day,source:'trains',stopId:'02026',stopName:'BOLZANO',departure:19*3600+120,arrival:19*3600-60};
test('official autocomplete resolves the exact train and Rome service day',()=>{
 const s='1727 - WRONG|1727-S00001-1792274400000\n17270 - MERANO|17270-S02216-1792274400000\n';
 assert.deepEqual(logic.resolveTrain?.(s,'17270',day),{number:'17270',origin:'S02216',start:'1792274400000'});
 assert.equal(logic.resolveTrain?.(s,'17270','2026-10-19'),null);
});
test('official actual track overrides planned track only for matched train, station and planned time',()=>{
 const data=logic.normalizeTrain?.(raw,'17270',day,stamp);
 const p=logic.matchPlatform?.(data,context,stamp);
 assert.equal(p?.current,'4');assert.equal(p?.planned,'3');assert.equal(p?.changed,true);assert.equal(p?.live,true);
});
test('destination uses arrival track and keeps planned status honest',()=>{
 const d=logic.normalizeTrain?.(raw,'17270',day,stamp);
 const p=logic.matchPlatform?.(d,{...context,stopId:'02001',stopName:'BRENNERO',arrival:22*3600+22*60-2*3600,departure:null},stamp);
 assert.equal(p?.current,'7');assert.equal(p?.live,false);
});
test('STA station names match exactly without confusing Bolzano with Bolzano Sud',()=>{
 const d=logic.normalizeTrain?.(raw,'17270',day,stamp);
 assert.equal(logic.matchPlatform?.(d,{...context,source:'sta',stopId:'it:22021:1',stopName:'Bolzano, Stazione di Bolzano'},stamp)?.current,'4');
 assert.equal(logic.matchPlatform?.(d,{...context,source:'sta',stopId:'it:22021:2',stopName:'Bolzano Sud'},stamp),null);
});
test('wrong time, date, train and stale response never supply a track',()=>{
 const d=logic.normalizeTrain?.(raw,'17270',day,stamp);
 for(const c of [{...context,departure:5000},{...context,number:'16707'},{...context,serviceDay:'2026-10-19'}])assert.equal(logic.matchPlatform?.(d,c,stamp),null);
 assert.equal(logic.matchPlatform?.(d,context,stamp+180001),null);
});
test('missing display track is not replaced with an internal platform code',()=>{
 const d=logic.normalizeTrain?.({...raw,fermate:[{...raw.fermate[0],binarioProgrammatoPartenzaDescrizione:null,binarioEffettivoPartenzaDescrizione:null,binarioEffettivoPartenzaCodice:'hidden-internal-id'}]},'17270',day,stamp);
 assert.equal(logic.matchPlatform?.(d,context,stamp),null);
});
test('ambiguous origins and a provider train number mismatch are rejected',()=>{
 assert.equal(logic.resolveTrain?.('17270 - A|17270-S02216-1792274400000\n17270 - B|17270-S02026-1792274400000','17270',day),null);
 assert.equal(logic.normalizeTrain?.({...raw,numeroTreno:16707},'17270',day,stamp),null);
});
test('city prefixes cannot misidentify a different station in the same town',()=>{
 const d=logic.normalizeTrain(raw,'17270',day,stamp);
 assert.equal(logic.matchPlatform(d,{...context,source:'sta',stopId:'it:22021:2',stopName:'Bolzano, Stazione di Bolzano Sud'},stamp),null);
});
import worker from '../worker.js';
test('worker resolves official current-day train and returns display platform fields',async()=>{
 const original=globalThis.fetch,dayNow=logic.romeTime(Date.now()).day;
 const start=Date.now(); // Resolver checks the Rome calendar date, not UTC midnight.
 const requested=[];
 globalThis.fetch=async url=>{requested.push(String(url));return requested.length===1?new Response(`17270 - MERANO|17270-S02216-${start}\n`):Response.json(raw)};
 try{
  const response=await worker.fetch(new Request('https://radar.test/api/train-platforms/17270?day='+dayNow),{});
  assert.equal(response.status,200);const d=await response.json();assert.equal(d.stops[0].plannedDeparture,'3');
  assert.match(requested[0],/^https:\/\/www\.viaggiatreno\.it\/infomobilita\/resteasy\/viaggiatreno\//);
 }finally{globalThis.fetch=original}
});
test('worker rejects malformed train or historical date without upstream requests',async()=>{
 for(const path of ['train-platforms/not-a-number?day=2026-10-18','train-platforms/17270?day=2020-01-01']){
  const r=await worker.fetch(new Request('https://radar.test/api/'+path),{});assert.equal(r.status,400);
 }
});
test('GTFS terminal departure placeholder still uses the official arrival platform',()=>{
 const d=logic.normalizeTrain(raw,'17270',day,stamp);
 const p=logic.matchPlatform(d,{...context,stopId:'02001',stopName:'BRENNERO',arrival:73320,departure:73320},stamp);
 assert.equal(p?.current,'7');
});
test('official Roman track numbers are supported without inventing a change from numeric notation',()=>{
 const d=logic.normalizeTrain({...raw,fermate:[{...raw.fermate[0],binarioProgrammatoPartenzaDescrizione:'4',binarioEffettivoPartenzaDescrizione:'IV'}]},'17270',day,stamp);
 const p=logic.matchPlatform(d,context,stamp);assert.equal(p?.current,'IV');assert.equal(p?.changed,false);
});
test('verified local station alias Ponte Adige matches official Ponte d’Adige',()=>{
 const d=logic.normalizeTrain({...raw,fermate:[{...raw.fermate[0],id:'S02225',stazione:"PONTE D'ADIGE"}]},'17270',day,stamp);
 assert.equal(logic.matchPlatform(d,{...context,source:'sta',stopId:'it:22021:1',stopName:'Ponte Adige'},stamp)?.current,'4');
});
