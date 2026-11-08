import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {romeServiceDay} from '../public/radar-assistant-logic.mjs';

const base='https://radar-preview.test',now=Date.now(),stamp=Math.floor(now/1000),day=romeServiceDay(now);
const positionFeed={header:{timestamp:stamp},entity:[{id:'train-1',vehicle:{vehicle:{id:'train-1',label:'REG 16685'},trip:{tripId:'T16685',routeId:'R1',startDate:day.replaceAll('-','')},timestamp:stamp,position:{latitude:46.5,longitude:11.35}}}]};
const updateFeed={header:{timestamp:stamp},entity:[{tripUpdate:{trip:{tripId:'T16685',startDate:day.replaceAll('-','')},timestamp:stamp,stopTimeUpdate:[{stopId:'S1',stopSequence:5,arrival:{delay:480}}]}}]};
const emptyFeed={header:{timestamp:stamp},entity:[]};
const index={meta:{ready:true,days:[day]},routes:{R1:['REG','Regionale','2']},trips:{T16685:['R1','Meran','shape','16685','service',true]}};
const limiter={limit:async()=>({success:true})};
function request(path='/api/assistant',body={question:'Wie ist der Status von Zug 16685?'},headers={}){return new Request(base+path,{method:path.endsWith('/status')?'GET':'POST',headers:{origin:base,'content-type':'application/json',...headers},body:path.endsWith('/status')?undefined:JSON.stringify(body)})}
function mockAssets(){return {fetch:async req=>{const url=new URL(req.url);return new Response(JSON.stringify(url.pathname.includes('trains-index')?index:{meta:{ready:true,days:[day]},routes:{},trips:{}}),{headers:{'content-type':'application/json'}})}}}
function mockFetch(groqStatus=429){const old=globalThis.fetch;let groqCalls=0;globalThis.fetch=async url=>{const u=String(url);if(u.includes('api.groq.com')){groqCalls++;return new Response('quota',{status:groqStatus})}if(u.includes('service-alerts'))return new Response(JSON.stringify(emptyFeed),{headers:{'content-type':'application/json'}});if(u.includes('trip-updates'))return new Response(JSON.stringify(u.includes('trenitalia')?updateFeed:emptyFeed),{headers:{'content-type':'application/json'}});return new Response(JSON.stringify(u.includes('trenitalia')?positionFeed:emptyFeed),{headers:{'content-type':'application/json'}})};return {restore:()=>{globalThis.fetch=old},groqCalls:()=>groqCalls}}

test('assistant status is off by default and lists only explicitly free-enabled providers',async()=>{
 const off=await worker.fetch(request('/api/assistant/status'),{});assert.equal((await off.json()).enabled,false);
 const on=await worker.fetch(request('/api/assistant/status'),{ASSISTANT_ENABLED:'true',GROQ_FREE_TIER_ONLY:'true',GROQ_API_KEY:'key',CLOUDFLARE_AI_FREE_TIER_ONLY:'true',AI:{run:async()=>({})}});const body=await on.json();assert.equal(body.enabled,true);assert.deepEqual(body.providers,['groq','cloudflare']);assert.equal(body.mode,'free-only');
});

test('assistant uses fresh live facts, falls back from Groq quota to Cloudflare, and validates IDs',async()=>{
 const mocks=mockFetch();let cloudflareCalls=0;
 const ai={run:async(_model,request)=>{cloudflareCalls++;const prompt=JSON.parse(request.messages[1].content);assert.ok(prompt.facts.some(f=>f.id==='position:trains:16685:T16685'));assert.ok(prompt.facts.some(f=>f.id==='delay:trains:16685:T16685:5:arrival'));assert.equal(prompt.facts.some(f=>f.text.includes('46.5')),false);const answer={summary:'Zug 16685 ist im aktuellen Feed sichtbar.',evidence:['position:trains:16685:T16685'],reasons:[{text:'GTFS-RT meldet +8 Minuten an Sequenz 5.',evidence:['delay:trains:16685:T16685:5:arrival'],confidence:'high'}],options:[]};return {choices:[{message:{content:JSON.stringify(answer)}}]}}};
 const env={ASSISTANT_ENABLED:'true',GROQ_FREE_TIER_ONLY:'true',GROQ_API_KEY:'test-key',CLOUDFLARE_AI_FREE_TIER_ONLY:'true',AI_JOURNEY_LIMITER:limiter,ASSETS:mockAssets(),AI:ai};
 try{const response=await worker.fetch(request(),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.provider,'cloudflare');assert.equal(mocks.groqCalls(),1);assert.equal(cloudflareCalls,1);assert.equal(body.evidenceFacts.length,2)}finally{mocks.restore()}
});

test('assistant does not call a model when no current GTFS evidence exists',async()=>{
 const mocks=mockFetch();let calls=0;const env={ASSISTANT_ENABLED:'true',GROQ_FREE_TIER_ONLY:'true',GROQ_API_KEY:'key',AI_JOURNEY_LIMITER:limiter,ASSETS:{fetch:async()=>new Response(JSON.stringify({meta:{ready:true,days:['2026-11-07']},routes:{},trips:{}}))},AI:{run:async()=>{calls++;throw Error('must not call')}}};
 try{const response=await worker.fetch(request(),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.provider,null);assert.equal(calls,0);assert.equal(body.evidenceFacts.length,0)}finally{mocks.restore()}
});

test('assistant validates same-origin, content type and bounded request body before upstream work',async()=>{
 const env={ASSISTANT_ENABLED:'true',GROQ_FREE_TIER_ONLY:'true',GROQ_API_KEY:'key',AI_JOURNEY_LIMITER:limiter};
 const wrongOrigin=await worker.fetch(request('/api/assistant',{question:'Status?'},{origin:'https://other.example'}),env);assert.equal(wrongOrigin.status,403);
 const wrongType=await worker.fetch(request('/api/assistant',{question:'Status?'},{'content-type':'text/plain'}),env);assert.equal(wrongType.status,415);
 const oversized=new Request(base+'/api/assistant',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:' '.repeat(4501)});assert.equal((await worker.fetch(oversized,env)).status,413);
});


test('assistant never invents a delay cause when no official alert supports it',async()=>{
 const mocks=mockFetch();let groqCalls=0,cloudflareCalls=0;
 const oldFetch=globalThis.fetch;globalThis.fetch=async url=>{const u=String(url);if(u.includes('api.groq.com'))groqCalls++;return mocksFetch(u)};
 function mocksFetch(u){if(u.includes('service-alerts'))return new Response(JSON.stringify(emptyFeed),{headers:{'content-type':'application/json'}});if(u.includes('trip-updates'))return new Response(JSON.stringify(u.includes('trenitalia')?updateFeed:emptyFeed),{headers:{'content-type':'application/json'}});return new Response(JSON.stringify(u.includes('trenitalia')?positionFeed:emptyFeed),{headers:{'content-type':'application/json'}})}
 const env={ASSISTANT_ENABLED:'true',GROQ_FREE_TIER_ONLY:'true',GROQ_API_KEY:'test-key',CLOUDFLARE_AI_FREE_TIER_ONLY:'true',AI_JOURNEY_LIMITER:limiter,ASSETS:mockAssets(),AI:{run:async()=>{cloudflareCalls++;throw Error('Model must not be called for unsupported cause')}}};
 try{const response=await worker.fetch(request('/api/assistant',{question:'Warum ist Zug 16685 verspätet?'}),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.provider,null);assert.equal(body.mode,'rule-based');assert.match(body.summary,/keine bestätigte Ursache/);assert.equal(groqCalls,0);assert.equal(cloudflareCalls,0)}finally{globalThis.fetch=oldFetch;mocks.restore()}
});
