import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicDir=join(root,'public');
const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
const read=name=>readFileSync(join(publicDir,name),'utf8');
const exists=p=>{try{return statSync(p).isFile()}catch{return false}};

// A relative import of a local file, with the query it carries.
const SPEC=/((?:import\s+(?:[^'";]*?\s+from\s+)?|import\s*\(|export\s+[^'";]*?\s+from\s*)['"])((?:\.{1,2}\/|\/)[^'"?#]+)(\?[^'"]*)?(['"])/g;

// The app graph: what index.html loads and what those files import.
function appGraph(){
  const html=read('index.html');
  const queue=[];
  for(const m of html.matchAll(/(?:src|href)\s*=\s*["'](\/[^"'#?]+)(?:\?[^"']*)?["']/g)){
    const rel=decodeURIComponent(m[1].slice(1));
    if(/\.(js|mjs)$/.test(rel))queue.push(rel);
  }
  const graph=new Set();
  while(queue.length){
    const rel=queue.shift();
    if(!rel||graph.has(rel))continue;
    if(!/\.(js|mjs)$/.test(rel))continue;
    // A worker entry point is resolved from the disk, a buster would break it.
    if(/worker/i.test(rel))continue;
    if(!exists(join(publicDir,rel)))continue;
    graph.add(rel);
    for(const m of read(rel).matchAll(SPEC)){
      queue.push(m[2].startsWith('/')?m[2].slice(1):resolve(dirname(rel),m[2]).replaceAll('\\','/').replace(/^public\//,''));
    }
  }
  return graph;
}

test('every import inside the app carries the version', () => {
  // After a release the browser could otherwise mix a new index.html with an
  // old core.js. The offline shell makes that mix visible.
  const graph=appGraph();
  assert.ok(graph.size>20,'der App-Graph wurde nicht gefunden');
  const ohne=[];
  for(const rel of graph){
    for(const m of read(rel).matchAll(SPEC)){
      if(m[3]&&m[3].includes('?v='))continue;
      ohne.push(rel+' -> '+m[2]);
    }
  }
  assert.deepEqual(ohne,[],'Imports ohne Versionsangabe: '+ohne.join(', '));
});

test('the version in the imports is the version in package.json', () => {
  for(const rel of appGraph()){
    for(const m of read(rel).matchAll(SPEC)){
      if(!m[3]||!m[3].includes('?v='))continue;
      const benutzt=m[3].replace('?v=','');
      assert.equal(benutzt,version,rel+' nutzt die falsche Version: '+benutzt);
    }
  }
});

test('the worker entry point keeps plain paths', () => {
  // The worker resolves its imports from the disk, where "?v=" is no file.
  const src=read('radar-history-worker.mjs');
  for(const m of src.matchAll(SPEC)){
    assert.ok(!m[3],'der Worker darf keine Versionsangabe im Pfad haben: '+m[2]);
  }
});

test('the service worker never stores a broken page', () => {
  // A 502 as a cached start page would show the proxy error instead of the app.
  const sw=read('sw.js');
  assert.match(sw,/if\(!response\.ok\)throw new Error/);
  assert.match(sw,/status:200,headers:\{'content-type':'text\/html/);
  // Only good answers are written into the cache.
  const puts=[...sw.matchAll(/cache\.put\([^)]*\)/g)].map(m=>m[0]);
  assert.ok(puts.length>0,'der Service Worker muss überhaupt etwas cachen');
  assert.match(sw,/if\(response&&response\.ok\)\{cache\.put/);
});

test('the live data is never answered from the cache', () => {
  const sw=read('sw.js');
  const guard=sw.indexOf('if(isApi(url))return;');
  const first=sw.indexOf('event.respondWith');
  assert.ok(guard>0&&guard<first,'die API-Pruefung muss vor jeder Antwortbehandlung kommen');
  // Die API-Pruefung muss auch vor dem Zweig fuer Fahrplandaten stehen,
  // sonst wuerde /api/ dort hineinlaufen.
  const datenZweig=sw.indexOf("startsWith('/data/')");
  assert.ok(guard>0&&guard<datenZweig,'die API-Pruefung muss vor dem Datenzweig kommen');
  // Und die Live-Daten duerfen in keinem Zweig in den Cache geschrieben werden.
  assert.ok(!/isApi[\s\S]{0,200}cache\.put/.test(sw),'ein API-Zweig schreibt in den Cache');
});
