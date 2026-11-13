import test from 'node:test';import assert from 'node:assert/strict';
const l=await import('../public/rfi-platforms-logic.mjs').catch(()=>({}));
const now=Date.parse('2026-10-18T17:00:00Z');
const html='<div id="lastUpdateId">aggiornato il <span>18/10/2026</span> alle ore 19:00:00</div><h1 id="nomeStazioneId">BOLZANO</h1><table><tr><td id="RTreno">17270</td><td id="ROrario">19:02</td><td id="RBinario"><div>3</div></td></tr><tr><td id="RTreno">16707</td><td id="ROrario">19:06</td><td id="RBinario">1A</td></tr></table>';
const c={number:'17270',serviceDay:'2026-10-18',source:'trains',stopId:'02026',stopName:'BOLZANO',departure:68520,arrival:68400,terminal:false};
test('RFI resolves verified station IDs and exact bilingual names, not city prefixes',()=>{
 assert.equal(l.resolveStation?.(c)?.placeId,'685');assert.equal(l.resolveStation?.({...c,source:'sta',stopId:'other',stopName:'Bozen'})?.placeId,'685');
 assert.notEqual(l.resolveStation?.({...c,source:'sta',stopId:'other',stopName:'Bolzano, Stazione di Bolzano Sud'})?.placeId,'685');
});
test('official monitor HTML yields displayed tracks and source update time',()=>{
 const d=l.parseMonitor?.(html,'685',false,now);assert.equal(d?.rows[0].platform,'3');assert.equal(d?.rows[1].platform,'1A');assert.equal(d?.updatedLocal,'2026-10-18T19:00:00');
});
test('matching RFI train and plan time returns a source-labelled reported track',()=>{
 const p=l.matchRFI?.(l.parseMonitor?.(html,'685',false,now),c,now);assert.equal(p?.current,'3');assert.equal(p?.source,'RFI');assert.equal(p?.live,true);
});
test('wrong train, time, station, arrival board, day or stale monitor never match',()=>{
 const d=l.parseMonitor?.(html,'685',false,now);
 for(const changed of [{number:'99999'},{departure:68000},{stopId:'02038',stopName:'TRENTO'},{serviceDay:'2026-10-19'},{terminal:true}])assert.equal(l.matchRFI?.(d,{...c,...changed},now),null);
 assert.equal(l.matchRFI?.(d,c,now+180000),null);
});
test('missing and malformed official boards do not fabricate platform records',()=>{
 assert.equal(l.parseMonitor?.('<html>Forbidden</html>','685',false,now),null);
 assert.equal(l.parseMonitor?.(html.replace('BOLZANO','TRENTO'),'685',false,now),null);
 assert.equal(l.parseMonitor?.(html.replace('<div>3</div>','&nbsp;'),'685',false,now)?.rows.some(r=>r.number==='17270'),false);
});
import worker from '../worker.js';
test('worker serves only whitelisted RFI station boards',async()=>{
 const before=globalThis.fetch;globalThis.fetch=async()=>new Response(html);
 try{const r=await worker.fetch(new Request('https://radar.test/api/station-platforms/685'),{});assert.equal(r.status,200);assert.equal((await r.json()).rows[0].platform,'3');
 const bad=await worker.fetch(new Request('https://radar.test/api/station-platforms/999999'),{});assert.equal(bad.status,400);}finally{globalThis.fetch=before}
});
test('a strongly delayed train still listed on a fresh monitor keeps its actual track',()=>{
 const later=now+40*60000;const d=l.parseMonitor(html.replace('19:00:00','19:40:00'),'685',false,later);
 assert.equal(l.matchRFI(d,c,later)?.current,'3');
});
