import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const get=n=>readFileSync(new URL('../public/'+n,import.meta.url),'utf8');
test('map-ready fires before awaiting feeds',()=>{
 const map=src.indexOf("bootPhase('map-ready')");
 const event=src.indexOf("document.dispatchEvent(new Event('sr37:ready'))");
 const feeds=src.indexOf('await feeds;',event);
 assert.ok(map>=0&&map<event&&event<feeds);
});
test('static data waits do not gate ready phase',()=>{
 assert.ok(src.indexOf("bootPhase('ready')")<src.indexOf('Promise.allSettled([indexes,rail,buses])'));
});

test('offline state and search jump are wired up', () => {
  // 9.3 + 9.4
  const src = get('app.js');
  assert.match(src, /function offlineState\(/);
  assert.match(src, /window\.addEventListener\('offline'/);
  assert.match(src, /window\.addEventListener\('online'/);
  assert.match(src, /function jumpToFirstHit\(/);
  assert.match(src, /e\.key==='Enter'/);
  const html = get('index.html');
  assert.match(html, /id="offlineBanner"/);
  assert.match(html, /role="status"/);
});