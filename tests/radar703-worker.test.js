import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';

const base='https://radar-s.j9fr2vg4vm.workers.dev';
const payload={question:'Welche Verbindung empfiehlst du?',options:[{
  rank:1,departure:36000,arrival:39000,durationMinutes:50,
  transfers:0,riskyTransfers:0,missedTransfers:0,walkMeters:0,
  legs:[{type:'train',name:'REG 1',from:'Bozen',to:'Meran'}]
}]};
function post(path='/api/ai/journey',origin=base){
 return new Request(base+path,{method:'POST',
  headers:{'content-type':'application/json',origin},
  body:JSON.stringify(payload)});
}
const limiter=(success=true)=>({limit:async()=>({success})});
test('Cloudflare AI binding is declared and OpenRouter config is not required',()=>{
 const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(cfg.ai.binding,'AI');
 assert.ok(cfg.ratelimits.some(x=>x.name==='AI_JOURNEY_LIMITER'));
});
test('AI endpoint falls back safely when Cloudflare AI binding is absent',async()=>{
 const r=await worker.fetch(post(),{AI_JOURNEY_LIMITER:limiter()});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,'AI model not configured');
 assert.match(r.headers.get('cache-control'),/no-store/);
});
test('Cloudflare binding receives bounded timetable, not an OpenRouter request',async()=>{
 let invoked=0;
 const env={AI_JOURNEY_LIMITER:limiter(),AI:{run:async(model,request,options)=>{
  invoked++;assert.equal(model,'@cf/google/gemma-4-26b-a4b-it');
  assert.equal(request.messages.length,2);
  assert.match(request.messages[1].content,/Bozen/);
  assert.ok(request.messages[1].content.length<7000);
  assert.equal(options.rejectIfBusy,true);
  return {choices:[{message:{content:'REG 1 ist laut Fahrplan die einfachste Wahl.'}}]};
 }}};
 const r=await worker.fetch(post(),env),body=await r.json();
 assert.equal(r.status,200);
 assert.equal(body.ai,true);
 assert.match(body.answer,/REG 1/);
 assert.equal(invoked,1);
});
test('legacy journey-chat alias still supports conversation context',async()=>{
 const request=new Request(base+'/api/ai/journey-chat',{
  method:'POST',headers:{'content-type':'application/json',origin:base},
  body:JSON.stringify({...payload,history:[{role:'user',content:'Ich möchte wenig umsteigen.'}]})
 });
 const r=await worker.fetch(request,{AI_JOURNEY_LIMITER:limiter(),AI:{run:async(_model,body)=>{
  assert.match(body.messages[1].content,/wenig umsteigen/);
  return {choices:[{message:{content:'Direktzug bevorzugen.'}}]};
 }}});
 assert.equal(r.status,200);
});
test('rejects cross-origin requests and rate-limited callers',async()=>{
 const env={AI_JOURNEY_LIMITER:limiter(),AI:{run:async()=>{throw Error('Must not run')}}};
 assert.equal((await worker.fetch(post('/api/ai/journey','https://other.example'),env)).status,403);
 const r=await worker.fetch(post(),{...env,AI_JOURNEY_LIMITER:limiter(false)});
 assert.equal(r.status,429);
});
test('provider errors give a temporary status without inventing AI answers',async()=>{
 const r=await worker.fetch(post(),{AI_JOURNEY_LIMITER:limiter(),AI:{run:async()=>{throw Error('Quota reached')}}});
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/Cloudflare AI/);
});
