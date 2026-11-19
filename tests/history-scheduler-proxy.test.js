import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('history API reads from Render/Turso when Cloudflare has no D1 binding',async()=>{
 const oldFetch=globalThis.fetch;let calledUrl='',calledMethod='';
 globalThis.fetch=async(url,init)=>{calledUrl=String(url);calledMethod=init.method;return new Response(JSON.stringify({enabled:true,stopUpdates:{total:138}}),{status:200,headers:{'content-type':'application/json'}})};
 try{
  const response=await worker.fetch(new Request('https://radar.test/api/history/analytics?trip=16685&source=trains&hours=168'),{HISTORY_API_ORIGIN:'https://history.example'});
  assert.equal(response.status,200);assert.equal(calledUrl,'https://history.example/api/history/analytics?trip=16685&source=trains&hours=168');assert.equal(calledMethod,'GET');
  assert.equal((await response.json()).stopUpdates.total,138);assert.equal(response.headers.get('cache-control'),'no-store');
 }finally{globalThis.fetch=oldFetch}
});

test('Cloudflare scheduled collector forwards the protected request to Render',async()=>{
 const oldFetch=globalThis.fetch;let calledUrl='',authorization='';
 globalThis.fetch=async(url,init)=>{calledUrl=String(url);authorization=init.headers.authorization;return new Response(JSON.stringify({ok:true,vehicleRecordsProcessed:6,stopUpdateRecordsProcessed:30}),{status:200,headers:{'content-type':'application/json'}})};
 try{
  const pending=[];
  await worker.scheduled({cron:'*/5 * * * *'},{HISTORY_API_ORIGIN:'https://history.example',HISTORY_COLLECTOR_SECRET:'test-only-secret'},{waitUntil(promise){pending.push(promise)}});
  await Promise.all(pending);
  assert.equal(calledUrl,'https://history.example/internal/collect-history');assert.equal(authorization,'Bearer test-only-secret');
 }finally{globalThis.fetch=oldFetch}
});

test('scheduled collector fails closed when the shared secret is missing',async()=>{
 const oldFetch=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;throw new Error('must not fetch')};
 try{const pending=[];await worker.scheduled({cron:'*/5 * * * *'},{},{waitUntil(promise){pending.push(promise)}});await Promise.all(pending);assert.equal(called,false)}finally{globalThis.fetch=oldFetch}
});
