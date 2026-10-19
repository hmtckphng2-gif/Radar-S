/* Südtirol Radar 5.9 — RailCam Network and train observation hub.
   Only authorized, verified railway-facing cameras may be activated.
   Vehicle feed observations are NOT webcam or GPS evidence. */
(()=>{'use strict';
const POINTS=[
 {id:'bolzano',name:'Bozen / Bolzano',q:['bozen','bolzano']},
 {id:'ora',name:'Auer / Ora',q:['auer','ora']},
 {id:'egnal',name:'Neumarkt / Egna',q:['neumarkt','egna']},
 {id:'salorno',name:'Salurn / Salorno',q:['salurn','salorno']},
 {id:'mezzocorona',name:'Mezzocorona',q:['mezzocorona']},
 {id:'lavis',name:'Lavis',q:['lavis']},
 {id:'trento',name:'Trient / Trento',q:['trient','trento']}
];
const KEY='sr59_hub_station',OBS_KEY='sr59_observations_v1';
const el=(tag,cls='',value)=>{const n=document.createElement(tag);n.className=cls;if(value!==undefined)n.textContent=String(value);return n};
const button=(label,handler,cls='sr59-button')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',handler);return n};
let chosen='salorno',panel,content,bridge,stations=[],view='cameras',feedStamp=0,observations=[];
try{const id=localStorage.getItem(KEY);if(POINTS.some(p=>p.id===id))chosen=id; const a=JSON.parse(localStorage.getItem(OBS_KEY)||'[]');if(Array.isArray(a))observations=a.filter(x=>x&&typeof x==='object'&&Number.isFinite(x.t)).slice(-120)}catch{}
function station(){return POINTS.find(p=>p.id===chosen)||POINTS[3]}
function age(t){if(!Number.isFinite(t)||!t)return 'Zeit unbekannt';const ms=Date.now()-t;return ms<0?'Zeit unklar':ms<60000?'gerade eben':Math.floor(ms/60000)+' Min. zuvor'}
function txt(parent,tag,klass,value){const n=el(tag,klass,value);parent.append(n);return n}
function save(){try{localStorage.setItem(KEY,chosen)}catch{}}
function feedVehicles(){const vs=bridge?.state?.vehicles;return vs?.values?[...vs.values()].filter(v=>v.kind==='train'):[]}
function snapshot(){if(!bridge)return;const t=Number(bridge.state?.fetchedAt)||0;if(!t||t===feedStamp)return;feedStamp=t;const available=feedVehicles().filter(v=>!v.stale).slice(0,160);let count=0;for(const v of available){const id=String(v.key||v.tripId||'');if(!id)continue;const previous=observations[observations.length-1];if(previous?.key===id&&t-previous.t<180000)continue;if(count++>=25)break;observations.push({t,key:id,line:String(v.name||v.tripId||'Zug').slice(0,65),source:String(v.source||'Feed').slice(0,35)});} observations=observations.slice(-120);try{localStorage.setItem(OBS_KEY,JSON.stringify(observations))}catch{}
}
function fresh(){const t=Number(bridge?.state?.fetchedAt)||0;return t>0&&Date.now()-t<180000}
function openStation(){const s=station();const matches=stations.filter(x=>s.q.some(q=>String(x.name||'').toLocaleLowerCase('de').includes(q)));const exact=matches.find(x=>s.q.includes(String(x.name||'').toLocaleLowerCase('de').trim()))||matches[0];if(exact&&window.SuedtirolRadar57?.openStation){panel.close();window.SuedtirolRadar57.openStation(exact)}else{const info=el('p','sr59-note','Für diesen Ort ist aktuell keine passende Haltestelle aus den geladenen Fahrplandaten verfügbar.');content.prepend(info)}}
function render(){if(!panel||!panel.open)return;snapshot();content.replaceChildren();
 const head=el('div','sr59-head');txt(head,'span','sr59-kicker','RAILCAM NETWORK · 5.9');txt(head,'h2','','Zugbeobachtung');txt(head,'p','sr59-note','Öffentliche Kameraquellen nur nach Sicht- und Nutzungsprüfung. Keine simulierte KI-Erkennung.');content.append(head);
 const options=el('div','sr59-stations');for(const p of POINTS){const b=button(p.name,()=>{chosen=p.id;save();render()},'sr59-station');b.setAttribute('aria-pressed',String(chosen===p.id));options.append(b)}content.append(options);
 const tabs=el('nav','sr59-tabs');for(const [id,label] of [['cameras','Kameras'],['trains','Zugdaten'],['history','Beobachtungen'],['quality','Datenqualität']]){const b=button(label,()=>{view=id;render()},'sr59-tab');b.setAttribute('aria-pressed',String(view===id));tabs.append(b)}content.append(tabs);
 if(view==='cameras')renderCameras();if(view==='trains')renderTrains();if(view==='history')renderHistory();if(view==='quality')renderQuality();
}
function renderCameras(){const s=station();const status=el('div','sr59-card');txt(status,'span','sr59-status','● Keine verifizierte Gleiskamera');txt(status,'h3','',s.name);txt(status,'p','sr59-note','Kameraplatz vorbereitet. Noch kein rechtmäßig nutzbarer Bild-Feed mit bestätigter Gleissicht und ausreichender Bildfrequenz.');status.append(button('Bahnhofsabfahrten ansehen ↗',openStation));content.append(status);
 const quality=el('div','sr59-card');txt(quality,'strong','','Prüfschritte vor Aktivierung');for(const line of ['Gleise und Züge sichtbar','Aktualisierungsrate ausreichend','Automatische Analyse vom Betreiber erlaubt','Kennzeichen: Kamerabeobachtung ≠ Zugnummer','Bildquelle und Aufnahmezeit dokumentiert'])txt(quality,'div','sr59-check','○ '+line);content.append(quality);
 txt(content,'p','sr59-note','Unterstützte Ausbauorte: Bozen, Auer, Neumarkt, Salurn, Mezzocorona, Lavis und Trient. Die Anzahl aktiver Kameras ist derzeit 0.');
 const directories=[['APDT · Lavis und Zambana','https://www.apdt.it/webcams'],['iLMeteo · Lavis','https://www.ilmeteo.it/webcam/Lavis'],['A22 · Brennerautobahn','https://www.autobrennero.it/it/informazioni-per-il-viaggio/webcam/']];
 const sources=el('div','sr59-card');txt(sources,'h3','','Kamera-Kandidaten · ungeprüft');txt(sources,'p','sr59-note','Externe Verzeichnisse zur manuellen Sichtprüfung. Keine bestätigten Gleiskameras; keine automatisierte Bildauswertung.');
 for(const [name,url] of directories){const a=el('a','sr59-source',name+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';sources.append(a)}content.append(sources);
 
}
function renderTrains(){const ok=fresh();const box=el('div','sr59-card');txt(box,'span','sr59-status '+(ok?'good':''),ok?'● Fahrzeug-Feeds kürzlich aktualisiert':'● Fahrzeug-Feeds nicht aktuell bestätigt');txt(box,'h3','',station().name);txt(box,'p','sr59-note','Die Liste zeigt Zugmeldungen des gesamten verbundenen Netzes – keine auf den gewählten Bahnhof eingeschränkten Ankünfte. Für Bahnhofsdaten die Abfahrtstafel öffnen.');box.append(button('Bahnhofstafel öffnen ↗',openStation));content.append(box);
 const trains=feedVehicles().filter(v=>!v.stale).slice(0,45);if(!trains.length){txt(content,'p','sr59-note','Derzeit keine aktiven Züge mit verwertbaren Feed-Daten.');return}
 for(const v of trains){const item=el('div','sr59-train');txt(item,'strong','',v.name||v.tripId||'Zug');txt(item,'small','',[(v.headsign||'Ziel unbekannt'),(v.source||'Quelle unbekannt')].join(' · '));item.append(button('Auf Karte ↗',()=>{panel.close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr59-mini'));content.append(item)}
}
function renderHistory(){const card=el('div','sr59-card');txt(card,'h3','','Beobachtungsprotokoll');txt(card,'p','sr59-note','Nur auf diesem Gerät gespeicherte Sichtungen aus Fahrzeug-Feeds seit Version 5.9. Keine Webcam-Erkennungen, kein historisches Archiv und keine gemessenen Bahnhofspassagen.');card.append(button('Lokale Einträge löschen',()=>{observations=[];try{localStorage.removeItem(OBS_KEY)}catch{}render()},'sr59-mini'));content.append(card);
 if(!observations.length){txt(content,'p','sr59-note','Noch keine Beobachtungen gespeichert.');return}
 for(const item of observations.slice(-30).reverse()){const row=el('div','sr59-train');txt(row,'strong','',item.line);txt(row,'small','',item.source+' · '+new Date(item.t).toLocaleString('de-DE')+' · '+age(item.t));content.append(row)}
}
function renderQuality(){
 const st=bridge?.state||{},vehicles=feedVehicles(),updated=Number(st.fetchedAt)||0;
 const box=el('div','sr59-card');txt(box,'h3','','Quellen- und Plausibilitätscheck');
 txt(box,'p','sr59-note','Letzte Feed-Synchronisierung: '+(updated?new Date(updated).toLocaleTimeString('de-DE'):'nicht bekannt')+' · '+(fresh()?'kürzlich aktualisiert':'nicht als aktuell bestätigt'));
 txt(box,'div','sr59-check','Gemeldete Züge: '+vehicles.length);
 txt(box,'div','sr59-check','Als veraltet markiert: '+vehicles.filter(v=>v.stale).length);
 txt(box,'div','sr59-check','Fahrzeuge ohne Positionskoordinaten: '+vehicles.filter(v=>{const a=Number(v.lat??v.latitude??v.position?.lat),b=Number(v.lon??v.lng??v.longitude??v.position?.lon);return !Number.isFinite(a)||!Number.isFinite(b)}).length);
 txt(box,'p','sr59-note','Eine Ist/Soll-Abweichung beweist keine Verspätung. Dieser Check verändert weder Positionen noch die vorhandene Ist/Soll-Anzeige.');
 box.append(button('Datenanalyse 5.8 öffnen',()=>{panel.close();window.SuedtirolRadar58?.open?.('health')}));content.append(box);
 const con=el('div','sr59-card');txt(con,'h3','','Anschluss-Intelligence');txt(con,'p','sr59-note','Anschlüsse im vorhandenen Radar-Modul basieren auf den verfügbaren Feed-Daten. Sie sind nicht garantiert.');con.append(button('Anschlussanalyse öffnen',()=>{panel.close();window.SuedtirolRadar58?.open?.('connections')}));content.append(con);
}
function open(){if(!panel){panel=el('dialog','sr59-modal');const shell=el('div','sr59-shell');const close=button('✕',()=>panel.close(),'sr59-close');close.setAttribute('aria-label','RailCam schließen');shell.append(close);content=el('div','sr59-content');shell.append(content);panel.append(shell);panel.addEventListener('click',ev=>{if(ev.target===panel)panel.close()});document.body.append(panel)}panel.showModal();render()}
let waits=0;function init(){if(document.getElementById('sr59Launch'))return;bridge=window.SuedtirolRadar37;if(!bridge?.state?.vehicles){if(waits++<80)setTimeout(init,250);return}const launch=button('◎ RailCam',open,'sr59-launch');launch.id='sr59Launch';launch.setAttribute('aria-label','RailCam Netzwerk und Zugbeobachtung öffnen');document.body.append(launch);bridge.getStationList?.().then(items=>{stations=Array.isArray(items)?items:[]}).catch(()=>{});document.addEventListener('sr37:feeds',()=>{snapshot();if(panel?.open&&view==='trains')render()});snapshot();window.SuedtirolRadar59={version:'5.9',open,getCameraCount:()=>0,getSelectedStation:station};document.title='Südtirol Radar 5.9 · RailCam Network';document.querySelectorAll('.brand-title em,.sr57-version').forEach(n=>n.textContent='5.9')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
