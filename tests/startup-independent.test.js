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
test('the offline shell never caches live data', () => {
  // 9.4: Ein Service Worker darf niemals /api/ cachen. Sonst wuerden alte
  // Positionen als aktuell angezeigt.
  const sw = get('sw.js');
  assert.match(sw, /if\(isApi\(url\)\)return;/);
  // Die API-Pruefung muss vor der ersten Antwortbehandlung stehen, sonst
  // wuerde fuer /api/ doch eine Cache-Antwort gebaut.
  const guard = sw.indexOf('if(isApi(url))return;');
  const firstRespond = sw.indexOf('event.respondWith');
  assert.ok(guard > 0, 'die API-Pruefung fehlt');
  assert.ok(guard < firstRespond, 'die API-Pruefung muss vor jeder Antwortbehandlung kommen');
  // Nur GET wird behandelt, POST bleibt unangetastet.
  assert.match(sw, /if\(request\.method!=='GET'\)return;/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /clients\.claim/);
  const src = get('app.js');
  assert.match(src, /navigator\.serviceWorker\.register\('\/sw\.js\?v=[0-9.]+',\{scope:'\/'\}\)/,
    'der Worker muss versionsfest und mit Scope / registriert werden');
});
test('der Update-Toast und der Service-Worker-Update-Handler sind eingebaut', () => {
  // 9.7: Wenn eine neuere Version ausgeliefert wird, soll die App das
  // sagen und zum Neu-Laden einladen.
  const app = get('app.js');
  assert.match(app, /function updateToast\(\)/);
  assert.match(app, /addEventListener\('updatefound'/);
  assert.match(app, /postMessage\(\{type:'SKIP_WAITING'\}\)/);
  const sw = get('sw.js');
  assert.match(sw, /self\.addEventListener\('message'/);
  assert.match(sw, /event\.data\.type==='SKIP_WAITING'/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  const css = get('radar84.css');
  assert.match(css, /\.sr-update-toast/);
  assert.match(css, /\.sr-update-toast button/);
  assert.match(app, /#sr-update-reload/);
});