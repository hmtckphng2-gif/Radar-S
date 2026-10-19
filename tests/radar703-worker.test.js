import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
const url='https://radar-s.j9fr2vg4vm.workers.dev/api/ai/journey';
const payload={question:'Welche Verbindung empfiehlst du?',options:[{rank:1,departure:36000,arrival:39000,durationMinutes:50,transfers:0,riskyTransfers:0,missedTransfers:0,walkMeters:0,legs:[{type:'train',name:'REG 1',from:'Bozen',to:'Meran'}]}]};
const post=()=>new Request(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://radar-s.j9fr2vg4vm.workers.dev'},body:JSON.stringify(payload)});
test('AI endpoint stays disabled without server secret',async()=>{
 const r=await worker.fetch(post(),{});assert.equal(r.status,503);assert.equal((await r.json()).error,'AI model not configured');assert.match(r.headers.get('cache-control'),/no-store/);
});
test('configured endpoint sends only bounded timetable context',async()=>{
 const orig=globalThis.fetch;let called=false;
 try{
  globalThis.fetch=async(input,opts)=>{called=true;assert.equal(String(input),'https://openrouter.ai/api/v1/chat/completions');const body=JSON.parse(opts.body);assert.equal(body.messages.length,2);assert.match(body.messages[1].content,/Bozen/);return new Response(JSON.stringify({choices:[{message:{content:'Ich empfehle REG 1 laut Fahrplan.'}}]}),{status:200,headers:{'content-type':'application/json'}})};
  const r=await worker.fetch(post(),{OPENROUTER_API_KEY:'example-non-secret',OPENROUTER_MODEL:'test-model',AI_JOURNEY_LIMITER:{limit:async()=>({success:true})}});const data=await r.json();assert.equal(r.status,200);assert.equal(data.ai,true);assert.match(data.answer,/REG 1/);assert.equal(called,true);
 }finally{globalThis.fetch=orig}
});
test('rejects cross-origin chat requests',async()=>{
 const req=new Request(url,{method:'POST',headers:{'content-type':'application/json',origin:'https://another.example'},body:JSON.stringify(payload)});
 const r=await worker.fetch(req,{OPENROUTER_API_KEY:'example-non-secret',OPENROUTER_MODEL:'test-model',AI_JOURNEY_LIMITER:{limit:async()=>({success:true})}});assert.equal(r.status,403);
});
