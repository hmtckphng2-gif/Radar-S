/* Radar 9.6 - offline faehige App-Huelle.
 *
 * Regeln, die hier nicht verhandelbar sind:
 *
 * 1. **Live-Daten werden nie zwischengespeichert.** Alles unter /api/ laeuft
 *    ausschliesslich ueber das Netz. Eine alte Position als "aktuell" anzuzeigen
 *    waere eine erfundene Angabe - genau das verbietet das Projekt.
 * 2. **Die App-Huelle wird zwischengespeichert**, damit die Karte auch ohne
 *    Verbindung startet. Die Cache-URLs enthalten die Versionsnummer (?v=),
 *    deshalb ist ein neues Release automatisch ein neuer Cache.
 * 3. **Nichts wird im Voraus geladen.** Der Cache waechst nur mit dem, was
 *    tatsaechlich benutzt wurde. Das haelt den Speicherbedarf klein.
 */
const CACHE='radar-shell-v9.6.0';
const SHELL='/index.html';

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([SHELL,'/manifest.webmanifest'])).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

function isApi(url){
  return url.pathname.startsWith('/api/');
}
function isAsset(url){
  return url.origin===self.location.origin &&
    /\.(?:js|mjs|css|png|jpg|jpeg|svg|webp|ico|json|glb|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  // 1. Live-Daten: immer aus dem Netz, nie cachen.
  if(isApi(url))return;
  // 2. Datenbanken mit Fahrplan und Modellen duerfen gecacht werden, sie
  //    aendern sich nur mit dem Release.
  if(url.pathname.startsWith('/data/')||url.pathname.startsWith('/models/')){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const hit=await cache.match(request);
      const net=fetch(request).then(response=>{
        if(response&&response.ok){cache.put(request,response.clone());return response}
        // Eine Fehlerseite ist kein Inhalt. Lieber die alte, versionierte
        // Datei zeigen als eine kaputte.
        return hit||response;
      }).catch(()=>hit);
      return hit||net;
    }));
    return;
  }
  // 3. Navigationen: Netz zuerst, Cache als Rueckfall.
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      // Eine Fehlerseite (502, 404) ist keine App. Sie darf weder gezeigt
      // noch gespeichert werden - sonst zeigt die App offline eine
      // Proxy-Fehlermeldung statt der Huelle.
      if(!response.ok)throw new Error('Antwort nicht gut: '+response.status);
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(SHELL,copy));
      return response;
    }).catch(()=>caches.match(SHELL).then(hit=>hit||new Response(
      '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Südtirol Radar - offline</title></head>'+
      '<body style="font:16px system-ui;background:#0b1220;color:#e8f0fa;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px">'+
      '<div><h1 style="font-size:20px;margin:0 0 8px">Offline</h1><p style="margin:0;color:#9fb3c8">Der Radar ist gerade nicht erreichbar. Fahrplan und gespeicherte Daten bleiben erhalten.</p></div></body></html>',
      {status:200,headers:{'content-type':'text/html; charset=utf-8'}}
    ))));
    return;
  }
  // 4. Statische Dateien: Cache zuerst, im Hintergrund auffrischen.
  if(isAsset(url)){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const hit=await cache.match(request);
      const net=fetch(request).then(response=>{
        if(response&&response.ok){cache.put(request,response.clone());return response}
        // Eine Fehlerseite ist kein Inhalt. Lieber die alte, versionierte
        // Datei zeigen als eine kaputte.
        return hit||response;
      }).catch(()=>hit);
      return hit||net;
    }));
  }
});
