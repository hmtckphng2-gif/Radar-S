/* Radar 5.9 – additive Rail Network Lab. Never assert camera detection without verified observations. */
(()=>{'use strict';
const VERSION='5.9.0', HISTORY_KEY='sr59_observations_v1', PREF_KEY='sr59_prefs_v1';
const CORRIDOR=[['Bozen / Bolzano',46.4967,11.3580],['Auer / Ora',46.3476,11.2975],['Neumarkt / Egna',46.3136,11.2724],['Salurn / Salorno',46.2397,11.2081],['Mezzocorona',46.2156,11.1200],['Lavis',46.1405,11.1101],['Trient / Trento',46.0731,11.1195]];
const CAMERAS=CORRIDOR.map(([name,lat,lng],i)=>({id:'corridor-'+i,name,lat,lng,status:'unverified',url:null,railView:false,permission:false}));
const $=(s)=>document.querySelector(s), el=(tag,cls,txt)=>{const a=document.createElement(tag);if(cls)a.className=cls;if(txt!==undefined)a.textContent=String(txt);return a};
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let prefs={trace:true,station:'Salurn / Salorno',delayThreshold:15,...load(PREF_KEY,{})}, history=load(HISTORY_KEY,[]), seen=new Map(), traces=new Map(), lineGroup=null, modal=null, content=null, current='overview';
const state=()=>window.SuedtirolRadar37?.state;
const vehicles=()=>{const v=state()?.vehicles;return v instanceof Map?[...v.values()]:Array.isArray(v)?v:[]};
function isTrain(v){return v?.kind==='train'&&!v.stale}
function num(v,...names){for(const n of names){const z=Number(v?.[n]);if(Number.isFinite(z)&&Math.abs(z)>0)return z}return null}
function coordinates(v){const lat=num(v,'lat','latitude'),lng=num(v,'lng','lon','longitude');return lat!==null&&lng!==null&&lat>=45.7&&lat<=47.5&&lng>=10.2&&lng<=12.6?[lat,lng]:null}
function name(v){return String(v.name||v.tripId||v.vehicleId||v.key||'Unbekannter Zug')}
function record(){const t=Date.now(),vs=vehicles().filter(isTrain);for(const v of vs){const point=coordinates(v),key=String(v.key||v.tripId||v.vehicleId||'');if(!key||!point)continue;let arr=traces.get(key)||[];const last=arr[arr.length-1];if(!last||Math.hypot(last[0]-point[0],last[1]-point[1])>0.0002){arr.push(point);if(arr.length>70)arr.shift();traces.set(key,arr)}if(!seen.has(key))seen.set(key,t)}
 const issues=window.SuedtirolRadar58?.getIssues?.()||[];for(const x of issues){if(!x||!x.id)continue;const id=String(x.id),prior=history.find(z=>z.id===id);if(prior)continue;history.push({id,time:t,line:String(x.line||''),title:String(x.title||''),minutes:Number.isFinite(Number(x.minutes))?Number(x.minutes):null,severity:String(x.severity||''),source:String(x.source||'')})}
 history=history.filter(x=>t-x.time<7*86400000).slice(-350);save(HISTORY_KEY,history);drawTraces();if(modal?.open&&current==='overview')render()}
function drawTraces(){const map=state()?.map;if(!map||!window.L)return;if(!lineGroup){lineGroup=window.L.layerGroup().addTo(map)}lineGroup.clearLayers();if(!prefs.trace)return;let count=0;for(const [key,pts] of traces){if(pts.length<2||count++>=60)continue;window.L.polyline(pts,{color:'#5bbcfb',weight:2,opacity:.55,interactive:false,dashArray:'4 5'}).addTo(lineGroup)}}
function button(label,fn,cls='sr59-button'){const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b}
function text(message,cls='sr59-muted'){content.append(el('p',cls,message))}
function panel(title,description){const card=el('section','sr59-card');card.append(el('strong','',title));if(description)card.append(el('p','',description));content.append(card);return card}
function open(tab='overview'){current=tab;if(!modal){modal=el('dialog','sr59-modal');modal.setAttribute('aria-label','Radar 5.9 Rail Network');const header=el('header','sr59-header');header.append(el('strong','','RADAR 5.9 · RAIL NETWORK'),button('✕',()=>modal.close(),'sr59-close'));content=el('div','sr59-content');modal.append(header,content);document.body.append(modal)}render();if(!modal.open)modal.showModal()}
function render(){content.replaceChildren();const nav=el('nav','sr59-tabs');for(const [key,label] of [['overview','Übersicht'],['cameras','RailCam'],['history','Verlauf'],['stations','Bahnhöfe'],['settings','Einstellungen']]){const b=button(label,()=>{current=key;render()},'sr59-tab');b.setAttribute('aria-pressed',String(key===current));nav.append(b)}content.append(nav);
 if(current==='overview'){
 const trains=vehicles().filter(isTrain),positioned=trains.filter(v=>coordinates(v));panel('🚆 Zugübersicht',`${trains.length} aktive Zugdatensätze · ${positioned.length} mit gültiger Position. Datensätze sind nicht automatisch GPS-live.`);
 const nearby=positioned.filter(v=>{const c=coordinates(v);return Math.hypot((c[0]-46.2397)*111,(c[1]-11.2081)*77)<18}).slice(0,15);
 const box=panel('Salurn · Umgebung','Züge mit gemeldeter Position in ca. 18 km Luftlinie. Keine Ankunftsprognose aus der Position ableiten.');if(!nearby.length)box.append(el('p','','Aktuell keine passenden Positionsmeldungen.'));for(const v of nearby){const row=button('🚆 '+name(v)+' · '+(v.headsign||v.source||'Position vorhanden'),()=>{modal.close();window.SuedtirolRadar50?.openVehicle?.(v.key);if(!window.SuedtirolRadar50?.openVehicle){state()?.map?.setView(coordinates(v),12)}},'sr59-train');box.append(row)}
 const trace=panel('Streckenverlauf aus Beobachtungen','Gestrichelte Linien zeigen ausschließlich Positionen, die dieses Gerät während der geöffneten App empfangen hat. Keine prognostizierte Strecke.');const toggle=button(prefs.trace?'✓ Spuren auf Karte aktiviert':'Spuren auf Karte aktivieren',()=>{prefs.trace=!prefs.trace;save(PREF_KEY,prefs);drawTraces();render()});trace.append(toggle);
 const quality=window.SuedtirolRadar58?.getFeedHealth?.()||[];panel('Daten-Plausibilität',`${quality.filter(x=>x.ok).length}/${quality.length} überprüfte Feed-Statusmeldungen OK. Feed-Status allein beweist weder GPS noch Pünktlichkeit.`);
 }
 if(current==='cameras'){
 panel('📷 RailCam AI · Quellenprüfung','7 Suchgebiete, 0 bestätigte Kameras. Es wird kein Bild abgerufen und keine automatische Zugerkennung behauptet. Nur genehmigte Kameras mit direkter Gleissicht und ausreichender Bildrate dürfen später aktiviert werden.');
 for(const cam of CAMERAS){const c=panel('○ '+cam.name,'Kameraquelle nicht verifiziert · Gleissicht unbekannt · KI-Erkennung inaktiv');c.append(el('small','sr59-detail','Status: nicht angeschlossen'))}
 panel('Erkennungslogik (vorbereitet)','Kamerabild → Zug sichtbar? → Fahrzeugtyp → Zeit und Richtung mit Fahrplandaten abgleichen → Zugnummer nur bei ausreichender Evidenz zuordnen. Noch kein trainiertes Modell oder Live-Bild angeschlossen.');
 }
 if(current==='history'){
 panel('Lokaler Beobachtungsverlauf','Erfasst Störungsmeldungen ausschließlich während dieses Gerät Radar nutzt. Keine historische amtliche Verspätungsstatistik. Speicherung max. 7 Tage, lokal im Browser.');
 if(!history.length)text('Noch keine Störungsmeldungen lokal beobachtet.');for(const x of history.slice().reverse().slice(0,75)){const c=panel(x.title||x.line,new Date(x.time).toLocaleString('de-DE')+' · '+(x.minutes!==null?'gemeldet +'+x.minutes+' min · ':'')+(x.source||'Quelle unbekannt'));c.classList.add('sr59-history')}
 content.append(button('Lokalen Verlauf löschen',()=>{history=[];save(HISTORY_KEY,history);render()},'sr59-button sr59-danger'));
 }
 if(current==='stations'){
 panel('Bahnhofs-Schnellzugriff','Öffnet vorhandene Bahnhofs- und Abfahrtsfunktionen, sofern eine passende Haltestelle im geladenen GTFS-Verzeichnis gefunden wird.');const grid=el('div','sr59-stations');content.append(grid);
 for(const [nm] of CORRIDOR){grid.append(button('⌖ '+nm,async()=>{const api=window.SuedtirolRadar37;let list=[];try{list=await api?.getStationList?.()||[]}catch{}const terms=nm.toLowerCase().split(' / ');const match=list.find(x=>terms.some(t=>String(x.name||'').toLowerCase().includes(t)));if(match&&window.SuedtirolRadar57?.openStation){modal.close();window.SuedtirolRadar50?.switchTab?.('departures');window.SuedtirolRadar57.openStation(match)}else{panel('Nicht verfügbar',nm+': derzeit kein eindeutiger Bahnhofseintrag aus den geladenen Daten verfügbar.')}},'sr59-station'))}
 }
 if(current==='settings'){
 panel('Daten & Datenschutz','RailCam-Anschlüsse sind deaktiviert, bis Kameraansicht, Aktualisierungsrate und Bildnutzungsrechte geprüft sind. Keine biometrische Erkennung.');
 const c=panel('Kartenspuren','Die Linien sind lokale Verlaufsbeobachtungen, keine Soll-Positionen.');c.append(button(prefs.trace?'Spuren ausschalten':'Spuren einschalten',()=>{prefs.trace=!prefs.trace;save(PREF_KEY,prefs);drawTraces();render()}));
 const a=panel('Benachrichtigungen','Nutze die bereits vorhandenen Alarme in Traffic Intelligence. Bei geschlossener App werden keine Hintergrund-Pushs versendet.');a.append(button('Alarme öffnen',()=>{modal.close();window.SuedtirolRadar58?.open?.('alerts')}));
 content.append(button('Lokale Spuren löschen',()=>{traces.clear();seen.clear();drawTraces();render()},'sr59-button sr59-danger'));
 }
}
function init(){if($('#sr59Launcher'))return;const b=button('🚆 Rail 5.9',()=>open(),'sr59-launcher');b.id='sr59Launcher';b.setAttribute('aria-label','Rail Network 5.9 öffnen');document.body.append(b);let prev=0;function update(){if(Date.now()-prev>12000){prev=Date.now();record()}}document.addEventListener('sr37:feeds',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});setInterval(()=>{if(!document.hidden)update()},30000);update();const ver=$('.brand-title em');if(ver)ver.textContent=VERSION;document.title='Südtirol Radar '+VERSION+' · Rail Network';window.SuedtirolRadar59={version:VERSION,open,cameras:CAMERAS.map(({id,name,status})=>({id,name,status})),getHistory:()=>history.slice()}}
let attempts=0;function boot(){if($('#sr59Launcher'))return;if(window.SuedtirolRadar37?.state?.map){init();return}if(attempts++<120)setTimeout(boot,250)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();document.addEventListener('sr37:ready',boot);
})();