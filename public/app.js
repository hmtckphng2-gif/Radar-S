import {
  SOURCES, UPDATE_SOURCES, BBOX, txt, gtfsNumber, parseVehicles, parseUpdates, formatDelay,
  feedAgeSeconds, shapeProject, pointAtDistance, stopRows, formatClock, delayForVehicle
} from './core.js';

const $ = id => document.getElementById(id);
const ENDPOINTS = [...SOURCES, ...UPDATE_SOURCES];
const state = {
  map: null, layer: null, selectedLayer: null, activeSheet: null, selectedKey: null,
  filter: 'all', query: '', busy: false, statuses: {},
  vehicles: new Map(), markers: new Map(), jobs: new Map(), updates: new Map(),
  indexes: {}, details: {}, shapes: {}, models: {}, counts: {}, lastSuccess: {},
  stationChoice: null, stationList: [], fetchedAt: 0, failCount: 0, scheduledSearch: null
};
let frameId = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DETAIL_MAX_AGE = 120000;
const VEHICLE_KEEP_MS = 90000;
const MARKER_MAX_AGE_SEC = 12 * 60;
const AVERAGE_POLL_MS = 20000;
const MAX_INTERPOLATION_METERS = 3000;
const snapMaxMeters = 350;
const manualRefreshDelayMs=3000;
const RT_MAX_AGE_SEC=15*60;

function safeText(value) { return txt(value); }
function duration(ms) {return Math.round(ms/1000)}
function escapeHtml(value) { return safeText(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setNotice(message, visible=true) {
  $('notice').hidden=!visible;
  if(message) $('notice').innerHTML='<button class="info-close" id="noticeClose" aria-label="Hinweis schließen">×</button>'+message;
  $('noticeClose').onclick=()=> $('notice').hidden=true;
}
async function fetchJson(url, timeout=12500) {
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeout);
  try {
    const r=await fetch(url,{signal:ctl.signal,cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status+' · '+url);
    const json=await r.json();
    if(json?.error)throw new Error(json.error+' · '+url);
    return json;
  } finally {clearTimeout(timer);}
}

function gtfsLocalDate() {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return [values.year,values.month,values.day].join('-');
}
function indexReady(source){
  const db=state.indexes[source];
  if(!db?.meta?.ready)return false;
  // A stale static database can map a reused trip ID to the wrong destination or bus line.
  return Array.isArray(db.meta.days)&&db.meta.days.includes(gtfsLocalDate());
}
function freshness(feed){
  const stamp=Number(feed?.header?.timestamp ?? feed?.header?.timeStamp);
  if(!Number.isFinite(stamp)||stamp<1000000000)return 'ok'; // unknown generation age: do not invent freshness
  return Date.now()/1000-stamp>RT_MAX_AGE_SEC?'old':'ok';
}
function allSourceCount(){return Object.values(state.statuses).filter(s=>s==='ok').length}
function statusLabel() {
  const good=allSourceCount(), vehicleGood=SOURCES.filter(s=>state.statuses[s]==='ok').length;
  const status=$('statusBtn');status.classList.toggle('ok',good===ENDPOINTS.length);
  status.classList.toggle('error',vehicleGood===0);
  $('statusText').textContent=good===ENDPOINTS.length?'FEEDS OK':vehicleGood===0?'OFFLINE':good+'/'+ENDPOINTS.length;
}
function showSourceStatus(){
  const lines=ENDPOINTS.map(ep=>'<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0"><b>'+escapeHtml(ep)+'</b><span>'+ (state.statuses[ep]==='ok'?'✓ Antwort':'↻ '+(state.statuses[ep]==='old'?'veraltet':'Fehler'))+'</span></div>').join('');
  const g=SOURCES.filter(indexReady).length;
  setNotice('<strong>Datenquellen · Südtirol Radar 3.0</strong><div style="margin:7px 0">'+lines+'</div><div>GTFS-Fahrplandaten: <b>'+g+'/3</b> Regionen geladen.</div><div style="margin-top:5px">Trenitalia/Trentino: geschätzte Fahrzeugpositionen. RFI ist nicht angeschlossen. Feed-Erreichbarkeit bedeutet nicht echtes GPS.</div>');
}
async function loadIndexes(){
  await Promise.all(SOURCES.map(async source => {
    try {
      const db=await fetchJson('/data/'+source+'-index.json',15000);
      state.indexes[source]=db;
      if(!indexReady(source)) {
        console.warn('GTFS index missing or outside its validity dates:',source);
        state.indexes[source]={meta:{ready:false,note:'Veralteter GTFS-Index'}};
      }
    }
    catch(e){state.indexes[source]={}; console.warn('GTFS index unavailable:',source,e)}
  }));
  try {
    const db=await fetchJson('/vehicle-models.json',8000);
    state.models=db.by_train||{};
  } catch(e){console.warn('Vehicle models unavailable:',e)}
  const present=SOURCES.filter(indexReady);
  if(present.length<3)setNotice('<strong>GTFS-Import ausstehend:</strong> '+present.length+'/3 Regionen haben Fahrplandaten. Die Karte funktioniert, aber Buslinien und Fahrtziele bleiben ohne Zuordnung unbekannt. Starte die GitHub-Action „Update GTFS timetable indexes“.');
}
async function loadRailShapes(){
  await Promise.all(SOURCES.map(async source=>{
    try {state.shapes[source]=await fetchJson('/data/'+source+'-shapes.json',16000)}
    catch(e){console.warn('Train geometry not loaded:',source,e)}
  }));
}
async function loadDetails(source){
  if(state.details[source])return state.details[source];
  // Cache the in-flight promise as well: repeated tapping does not fetch several times.
  if(!state.detailPending)state.detailPending={};
  if(!state.detailPending[source])state.detailPending[source]=fetchJson('/data/'+source+'-details.json',20000)
    .then(d=>{state.details[source]=d;return d})
    .catch(e=>{console.warn('GTFS trip details unavailable',source,e);return null})
    .finally(()=>delete state.detailPending[source]);
  return state.detailPending[source];
}
// OSM Standard tile service: no CARTO API key. Dark mode is a CSS treatment of tiles only.
// Usage policy: https://operations.osmfoundation.org/policies/tiles/
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function changeTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  $('themeToggle').textContent=theme==='dark'?'☀':'☾';
  try{localStorage.setItem('sr-theme',theme)}catch(e){}
  // No URL change/re-download required when switching modes.
}
function initMap(){
  if(!window.L){setNotice('<strong>Kartenbibliothek nicht erreichbar.</strong> Prüfe die Internetverbindung oder den Leaflet-CDN.');return false;}
  const map=L.map('map',{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([46.64,11.35],9);
  state.map=map;
  state.tiles=L.tileLayer(OSM_TILES,{
    minZoom:3,maxZoom:19,maxNativeZoom:19,
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a>'
  }).addTo(map);
  let tileFailures=0;
  state.tiles.on('tileload',()=>{tileFailures=0});
  state.tiles.on('tileerror',()=>{
    if(++tileFailures===7){
      setNotice('<strong>Karte vorübergehend nicht erreichbar.</strong> Die OpenStreetMap-Kacheln konnten nicht geladen werden. Prüfe deine Internetverbindung und aktualisiere die Seite.');
    }
  });
  state.layer=L.layerGroup().addTo(map);
  L.control.zoom({position:'bottomleft'}).addTo(map);
  map.on('zoomend',()=>$('map').classList.toggle('map-zoomed-out',map.getZoom()<11));
  $('map').classList.toggle('map-zoomed-out',map.getZoom()<11);
  return true;
}
function visible(v){
  if(state.filter==='trains'&&v.kind!=='train'||state.filter==='buses'&&v.kind!=='bus')return false;
  if(state.query&&!`${v.name} ${v.headsign} ${v.vehicleId} ${v.tripId} ${v.routeLongName}`.toLocaleLowerCase('de').includes(state.query))return false;
  return true;
}
function markerIcon(v){
  const train=v.kind==='train',label=v.name.startsWith('Linie unbekannt')||v.name==='Zugnummer unbekannt'?'':v.name;
  const cls='marker-wrap '+(train?'train':'bus')+(label?'':' unverified')+(state.selectedKey===v.key?' selected':'');
  const icon=`<div class="${cls}"><div class="marker-label">${escapeHtml(label)}</div><div class="marker-circle">${train?'🚆':'🚌'}</div></div>`;
  return L.divIcon({className:'radar-custom',html:icon,iconSize:[30,43],iconAnchor:[15,38]});
}
function shapeOf(v){return v.kind==='train'&&v.shapeId ? state.shapes[v.source]?.shapes?.[v.shapeId] : null;}
function mapTarget(v){
  const path=shapeOf(v);
  if(!path)return {lat:v.lat,lon:v.lon,path:null,along:null};
  const snapped=shapeProject(path,v.lat,v.lon);
  if(!snapped||snapped.distance>snapMaxMeters)return {lat:v.lat,lon:v.lon,path:null,along:null};
  return {lat:snapped.lat,lon:snapped.lon,path,along:snapped.along};
}
function stopJob(key){state.jobs.delete(key);}
function animationLoop(now){
  frameId=0;
  for(const [key,job] of state.jobs){
    const marker=state.markers.get(key)?.marker;
    if(!marker){state.jobs.delete(key);continue;}
    const f=Math.min(1,(now-job.start)/job.duration);
    let pos;
    if(job.path && job.fromAlong!==null && job.toAlong!==null){
      pos=pointAtDistance(job.path,job.fromAlong+(job.toAlong-job.fromAlong)*f,job.latReference);
    }else pos={lat:job.from.lat+(job.to.lat-job.from.lat)*f,lon:job.from.lng+(job.to.lon-job.from.lng)*f};
    marker.setLatLng([pos.lat,pos.lon]);
    if(f>=1)state.jobs.delete(key);
  }
  if(state.jobs.size)frameId=requestAnimationFrame(animationLoop);
}
function animateTo(key,entry,target){
  const marker=entry.marker, current=marker.getLatLng(), dest=L.latLng(target.lat,target.lon);
  const dist=current.distanceTo(dest);
  stopJob(key);
  if(dist<1.5)return;
  if(dist>MAX_INTERPOLATION_METERS||reducedMotion.matches||document.hidden){marker.setLatLng(dest);return;}
  const oldAlong=entry.target?.along;
  const shapeCompatible=Boolean(target.path && entry.target?.path === target.path &&
    Number.isFinite(oldAlong) && Number.isFinite(target.along) &&
    Math.abs(target.along-oldAlong)<5000);
  // For on-track updates, project the CURRENT displayed location back onto the same shape.
  const fromSnap=shapeCompatible?shapeProject(target.path,current.lat,current.lng):null;
  const followShape=shapeCompatible && fromSnap && fromSnap.distance<60;
  state.jobs.set(key,{start:performance.now(),duration:AVERAGE_POLL_MS-500,
    from:current,to:{lat:target.lat,lon:target.lon},
    path:followShape?target.path:null,fromAlong:followShape?fromSnap.along:null,
    toAlong:followShape?target.along:null,latReference:current.lat});
  if(!frameId)frameId=requestAnimationFrame(animationLoop);
}
function refreshMarkers(){
  if(!state.map)return;
  const active=new Set();
  for(const [key,v] of state.vehicles){
    if(!visible(v))continue;
    active.add(key);
    const target=mapTarget(v);
    const iconKey=`${v.kind}|${v.name}|${state.selectedKey===key}`;
    let entry=state.markers.get(key);
    if(!entry){
      const marker=L.marker([target.lat,target.lon],{icon:markerIcon(v),keyboard:true,title:v.name}).addTo(state.layer);
      marker.on('click',()=>selectVehicle(key));
      entry={marker,iconKey,target};state.markers.set(key,entry);
    }else{
      if(iconKey!==entry.iconKey){entry.marker.setIcon(markerIcon(v));entry.iconKey=iconKey;}
      if(entry.target.lat!==target.lat||entry.target.lon!==target.lon){
        animateTo(key,entry,target);entry.target=target;
      }
    }
    entry.marker.setOpacity(v.stale?.75:1);
  }
  for(const [key,entry] of state.markers)if(!active.has(key)){
    stopJob(key);state.layer.removeLayer(entry.marker);state.markers.delete(key);
  }
}
function displayStats(){
  const all=[...state.vehicles.values()];
  $('countAll').textContent=all.length;$('countTrains').textContent=all.filter(v=>v.kind==='train').length;
  $('countBuses').textContent=all.filter(v=>v.kind==='bus').length;
  $('lastUpdate').textContent=state.fetchedAt?'Abfrage '+new Date(state.fetchedAt).toLocaleTimeString('de-IT',{hour:'2-digit',minute:'2-digit'}):'Noch keine Daten';
}
async function refreshFeeds(){
  if(state.busy)return;
  state.busy=true;$('statusText').textContent='LÄDT ...';
  try{
    const results=await Promise.allSettled(ENDPOINTS.map(name=>fetchJson('/api/'+name)));
    const ok={};
    for(let i=0;i<results.length;i++){
      const name=ENDPOINTS[i],result=results[i];
      const fresh=result.status==='fulfilled' ? freshness(result.value) : 'error';
      state.statuses[name]=fresh;
      if(fresh==='ok')ok[name]=result.value;
      else console.warn('Feed unavailable or outdated',name,result.reason || fresh);
    }
    const now=Date.now();state.fetchedAt=now;
    for(const source of SOURCES){
      if(!ok[source])continue;
      const parsed=parseVehicles(ok[source],source,state.indexes,now);
      state.counts[source]=parsed;
      const latest=new Map(parsed.vehicles.filter(v=>!v.timestamp || (now/1000-v.timestamp)<MARKER_MAX_AGE_SEC).map(v=>[v.key,v]));
      for(const [key,old] of state.vehicles){
        if(old.source!==source)continue;
        if(latest.has(key))continue;
        if(now-old.lastRealSeen<VEHICLE_KEEP_MS)state.vehicles.set(key,{...old,stale:true});
        else state.vehicles.delete(key);
      }
      for(const [key,v] of latest)state.vehicles.set(key,{...v,lastRealSeen:now,stale:false});
    }
    for(const [key,v] of state.vehicles){
      if(state.statuses[v.source]!=='ok'){
        if(now-v.lastRealSeen>VEHICLE_KEEP_MS)state.vehicles.delete(key);
        else state.vehicles.set(key,{...v,stale:true});
      }
    }
    for(const source of SOURCES){
      const name=source+'_updates';if(!ok[name])continue;
      for(const key of [...state.updates.keys()])if(key.startsWith(source+':'))state.updates.delete(key);
      for(const [key,upd] of parseUpdates(ok[name],source,now))state.updates.set(key,upd);
    }
    // Existing updates age out if no feed responds.
    for(const [key,upd] of state.updates)if(now-upd.fetchedAt>DETAIL_MAX_AGE)state.updates.delete(key);
    state.failCount=ENDPOINTS.filter(s=>state.statuses[s]!=='ok').length;
    statusLabel();refreshMarkers();displayStats();refreshScheduleMatches();
    if(state.selectedKey && state.activeSheet==='vehicle'){
      if(state.vehicles.has(state.selectedKey))drawVehicleDetails(state.selectedKey,false);
      else {closeSheets();setNotice('<strong>Fahrzeug verschwunden:</strong> Dieser Zug oder Bus wird nicht mehr im aktuellen Positionsfeed gemeldet. Es wird keine Position erfunden.');}
    }
  }catch(e){
    console.error('Unexpected refresh error',e);
    $('statusText').textContent='FEHLER';$('statusBtn').classList.add('error');
  }finally{state.busy=false;}
}
function setFilter(which){state.filter=which;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===which));refreshMarkers();refreshScheduleMatches();}
function openSheet(which){
  closeSheets(false);
  state.activeSheet=which;
  const id=which==='station'?'stationSheet':'sheet';
  const sheet=$(id);
  const scroller=sheet.querySelector('.sheet-scroll');
  if(scroller)scroller.scrollTop=0;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  $('scrim').classList.add('show');
}
function closeSheets(resetSelection=true){
  for(const id of ['sheet','stationSheet']){$(id).classList.remove('open');$(id).setAttribute('aria-hidden','true');}
  $('scrim').classList.remove('show');state.activeSheet=null;
  if(resetSelection){state.selectedKey=null;refreshMarkers();}
}
function badge(text,style=''){const el=document.createElement('span');el.className='mini-badge '+style;el.textContent=text;return el;}
function detail(name,value){const el=document.createElement('div');el.className='detail';const small=document.createElement('small');small.textContent=name;const strong=document.createElement('strong');strong.textContent=value;el.append(small,strong);$('details').append(el);}
function modelFor(v){if(v.kind!=='train')return null;
  // Model dictionary is explicitly keyed by real train number or exact GTFS trip ID.
  const model=state.models[v.name]||state.models[v.tripId];
  if(!model||!['confirmed','planned'].includes(model.confidence)||!txt(model.source)||!txt(model.name))return null;
  return model;
}
function urlSafe(href){try{const url=new URL(href);return url.protocol==='https:'}catch{return false}}
function renderModel(v){const model=modelFor(v),card=$('modelCard'),img=$('modelImage');card.hidden=true;img.removeAttribute('src');
  if(!model || !urlSafe(model.image))return;
  $('modelTitle').textContent=model.name;
  $('modelCaption').textContent=(model.confidence==='confirmed'?'Bestätigter Typ':'Geplanter Typ')+' · '+model.source+' · Baureihenfoto (nicht garantiert exakte Einheit)';
  img.onerror=()=>{card.hidden=true;img.removeAttribute('src')};
  img.src=model.image;card.hidden=false;
}
function drawVehicleDetails(key,fetchSchedule){
  const v=state.vehicles.get(key);if(!v)return;
  $('sheetKind').textContent=v.kind==='train'?'ZUGDETAILS · '+v.source.toUpperCase():'BUSDETAILS · '+v.source.toUpperCase();
  $('sheetTitle').textContent=(v.kind==='train'?'🚆 ':'🚌 ')+v.name;
  $('sheetSub').textContent=v.headsign;
  const badges=$('sheetBadges');badges.replaceChildren();
  badges.append(badge(v.kind==='train'?'Zug':'Bus'));
  badges.append(badge(v.stale?'Letzte bekannte Position':'Aktueller Feed',v.stale?'warn':'ok'));
  badges.append(badge(v.positionType,'warn'));
  if(v.kind==='bus') badges.append(badge(v.lineVerified?'GTFS-Linie geprüft':'Linie unbekannt',v.lineVerified?'ok':'warn'));
  renderModel(v);
  $('details').replaceChildren();
  detail('Zug / Linie',v.name);
  const update=state.updates.get(v.source+':'+v.tripId);
  const cancelled=/^(?:CANCELED|CANCELLED|3)$/i.test(update?.scheduleRelationship||'');
  detail('Status',cancelled?'Fahrt entfällt':update?'RT-Fahrtdaten vorhanden':'Keine Fahrtstatusdaten');
  detail('Verspätung (GTFS-RT)',cancelled?'Entfällt':formatDelay(delayForVehicle(update,v)));
  detail('Fahrtziel',v.headsign);
  detail('Fahrzeug-ID',v.vehicleId);
  detail('Fahrt-ID',v.tripId||'Nicht verfügbar');
  detail('Positionsalter',feedAgeSeconds(v)===null?'Unbekannt':duration(feedAgeSeconds(v)*1000)+' Sek.');
  detail('Geschwindigkeit',v.speed===null?'Nicht verfügbar':v.speed+' km/h (Feed)');
  detail('Quelle',v.source.toUpperCase()+' / GTFS-RT');
  let note='Die Kartenposition ist '+(v.source==='sta'?'ein Feed-Messwert, nicht zwingend GPS.':'simuliert/geschätzt, keine GPS-Ortung.')+' ';
  if(v.stale)note+='Dieser Marker ist nur die letzte bekannte Position; der aktuelle Feed enthält ihn nicht. ';
  if(v.kind==='bus'&&!v.lineVerified)note+='Ohne passenden statischen GTFS-Eintrag keine bestätigte Liniennummer. ';
  if(v.kind==='train'&&!v.nameVerified)note+='Die offizielle Zugnummer ist noch nicht zugeordnet. ';
  $('sheetNote').textContent=note;
  if(fetchSchedule)loadSchedule(key);
  else if(state.details[v.source])renderStops(v,state.details[v.source]);
}
function renderStops(v,details){
  const rows=stopRows(details,v.tripId);
  const section=$('scheduleSection'),list=$('stops'),empty=$('emptySchedule');
  list.replaceChildren();section.hidden=!rows.length;empty.hidden=!!rows.length;
  if(!rows.length)return;
  const update=state.updates.get(v.source+':'+v.tripId);
  $('scheduleSource').textContent='GTFS-Fahrplan'+(update?.stops?.length?' + TripUpdates':'');
  const lookup=new Map((update?.stops||[]).map(u=>[txt(u.stopId??u.stop_id),u]));
  for(const row of rows){
    const li=document.createElement('li');li.className='stop';
    const left=document.createElement('div');const name=document.createElement('b');name.textContent=row.name;left.append(name);
    const upd=lookup.get(row.stopId);
    const d=upd?(upd.departure?.delay??upd.arrival?.delay):null;
    const skipped=/^(?:SKIPPED|1)$/i.test(txt(upd?.scheduleRelationship??upd?.schedule_relationship));
    const info=document.createElement('small');info.textContent=skipped?'Halt entfällt':d!=null?'GTFS-RT: '+formatDelay(Number(d)):'Planzeit';left.append(info);
    const time=document.createElement('div');time.className='stop-time';time.textContent=row.departure!=='–'?row.departure:row.arrival;
    li.append(left,time);list.append(li);
  }
}
async function loadSchedule(key){
  const v=state.vehicles.get(key);if(!v)return;
  $('scheduleSection').hidden=true;$('emptySchedule').hidden=false;$('emptySchedule').textContent='Lade GTFS-Fahrplan …';
  const details=await loadDetails(v.source);
  if(state.selectedKey!==key||state.activeSheet!=='vehicle')return;
  if(details)renderStops(v,details);
  else $('emptySchedule').textContent='Keine verifizierten Haltestelleninformationen für diese Fahrt verfügbar.';
}
function selectVehicle(key){
  if(!state.vehicles.has(key))return;
  state.selectedKey=key;
  $('scheduleMatches').hidden=true;openSheet('vehicle');refreshMarkers();drawVehicleDetails(key,true);
}
function fitMap(){
  const locations=[...state.markers.values()].map(e=>e.marker.getLatLng());
  if(locations.length>1)state.map.fitBounds(L.latLngBounds(locations),{paddingTopLeft:[25,155],paddingBottomRight:[25,100],maxZoom:11});
  else if(locations.length===1)state.map.setView(locations[0],12);
  else state.map.setView([46.64,11.35],9);
}
async function showStations(){
  openSheet('station');$('stationBoard').hidden=true;$('stationResults').hidden=false;
  $('stationResults').textContent='Lade Haltestellen …';
  await Promise.all(SOURCES.map(s=>loadDetails(s)));
  if(state.activeSheet!=='station')return;
  const all=[];
  for(const s of SOURCES){for(const [stopId,record] of Object.entries(state.details[s]?.stops||{})){
    if(!record[0])continue;
    const lat=Number(record[1]),lon=Number(record[2]);
    if(lat<BBOX.south||lat>BBOX.north||lon<BBOX.west||lon>BBOX.east)continue;
    all.push({source:s,stopId,name:record[0],lat,lon});
  }}
  state.stationList=all;renderStationResults();
  // No forced iOS keyboard on opening: avoids shrinking the viewport unexpectedly.
}
function renderStationResults(){
  const q=$('stationSearch').value.toLocaleLowerCase('de').trim(),list=$('stationResults');list.replaceChildren();
  const matches=state.stationList.filter(st=>!q||st.name.toLocaleLowerCase('de').includes(q)).slice(0,40);
  if(!state.stationList.length){list.textContent='Keine GTFS-Haltestellendaten geladen. Starte zuerst den automatischen GTFS-Import.';return;}
  for(const st of matches){const btn=document.createElement('button');btn.className='station-result';
    const body=document.createElement('div');const strong=document.createElement('strong');strong.textContent=st.name;
    const small=document.createElement('small');small.textContent=st.source.toUpperCase();body.append(strong,small);
    const chevron=document.createElement('span');chevron.textContent='›';btn.append(body,chevron);
    btn.onclick=()=>showStationBoard(st);list.append(btn);
  }
  if(!matches.length)list.textContent='Keine passende Haltestelle gefunden.';
}
function italySeconds(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(o.hour)*3600+Number(o.minute)*60+Number(o.second);
}
function showStationBoard(st){
  state.stationChoice=st;$('stationResults').hidden=true;$('stationBoard').hidden=false;
  const scroller=$('stationSheet').querySelector('.sheet-scroll');if(scroller)scroller.scrollTop=0;
  $('stationName').textContent='Abfahrten · '+st.name;
  const list=$('stationDepartures');list.replaceChildren();
  const details=state.details[st.source],db=state.indexes[st.source];
  const now=italySeconds(), departures=[];
  for(const [tripId,rows] of Object.entries(details?.times||{})){
    const trip=db?.trips?.[tripId];if(!trip||trip[5]===false)continue;
    for(const [sid,arr,dep] of rows){if(sid!==st.stopId)continue;
      const sec=dep??arr;
      if(sec===null||sec===undefined||sec<now-300)continue;
      const route=db.routes?.[trip[0]];
      const name=st.source==='trains'?txt(trip[3])||'Zug':txt(route?.[0])||'Bus';
      departures.push({tripId,sec,name,headsign:trip[1]||'Ziel unbekannt'});
    }
  }
  departures.sort((a,b)=>a.sec-b.sec);
  for(const d of departures.slice(0,28)){
    const btn=document.createElement('button');btn.className='station-result';
    const body=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small'),clock=document.createElement('span');
    title.textContent=d.name+' · '+d.headsign;sub.textContent='Geplant · '+st.source.toUpperCase();clock.textContent=formatClock(d.sec);
    body.append(title,sub);btn.append(body,clock);list.append(btn);
  }
  if(!departures.length)list.textContent='Keine kommenden GTFS-Abfahrten für den heutigen Tag gefunden. Das ist keine Aussage über aktuelle Zugausfälle.';
  if(state.map&&Number.isFinite(st.lat)&&Number.isFinite(st.lon))state.map.panTo([st.lat,st.lon]);
}

function refreshScheduleMatches(){
  const panel=$('scheduleMatches');panel.replaceChildren();panel.hidden=true;
  const q=state.query.trim();
  if(!q || q.length<2 || state.filter==='buses' || !indexReady('trains'))return;
  if([...state.vehicles.values()].some(v=>visible(v)))return; // found a live marker
  const digits=q.replace(/^(reg|r|rv|re|ec|ic|rj|rjx|zug)\s*/i,'').trim();
  if(!/^\d{2,6}$/.test(digits))return;
  const db=state.indexes.trains;
  const entries=Object.entries(db.trips||{}).filter(([id,t])=>t[5]!==false && txt(t[3])===digits).slice(0,12);
  if(!entries.length)return;
  const title=document.createElement('h3');title.textContent='Im Fahrplan · keine aktuelle Kartenposition gefunden';panel.append(title);
  for(const [tripId,trip] of entries){
    const btn=document.createElement('button');const left=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent='Zug '+digits;
    const small=document.createElement('small');small.textContent=trip[1]||'Fahrtziel nicht verfügbar';
    const icon=document.createElement('span');icon.textContent='→';left.append(strong,small);btn.append(left,icon);
    btn.onclick=()=>selectScheduledTrain(tripId);panel.append(btn);
  }
  panel.hidden=false;
}
async function selectScheduledTrain(tripId){
  const trip=state.indexes.trains?.trips?.[tripId];if(!trip)return;
  $('scheduleMatches').hidden=true;state.selectedKey=null;
  openSheet('vehicle');
  $('sheetKind').textContent='FAHRPLAN · KEINE GEMELDETE FAHRZEUGPOSITION';
  $('sheetTitle').textContent='🚆 '+gtfsNumber('',trip[3]);
  $('sheetSub').textContent=trip[1]||'Fahrtziel unbekannt';
  $('sheetBadges').replaceChildren(badge('Nur GTFS-Fahrplan','warn'));
  $('modelCard').hidden=true;$('details').replaceChildren();
  detail('Fahrt-ID',tripId);detail('Position','Im Echtzeitfeed nicht gefunden');
  detail('Zugnummer',gtfsNumber('',trip[3]));detail('Verspätung','Nicht überprüft');
  $('sheetNote').textContent='Diese Fahrt steht im heutigen GTFS-Fahrplan. Die App hat derzeit keine gemeldete Position dafür. Das beweist weder einen Ausfall noch die tatsächliche Position.';
  $('scheduleSection').hidden=true;$('emptySchedule').hidden=false;$('emptySchedule').textContent='Lade planmäßige Zwischenhalte …';
  const details=await loadDetails('trains');
  if(state.activeSheet==='vehicle'&&state.selectedKey===null){
    if(details)renderStops({source:'trains',tripId},details);
    else $('emptySchedule').textContent='Keine Fahrplandetails verfügbar.';
  }
}
// Safari: keep swipes inside the detail panel, without blocking real scrolling.
function setupSheetTouchGuards(){
  for(const sheet of document.querySelectorAll('.sheet')){
    const scroller=sheet.querySelector('.sheet-scroll');
    if(!scroller)continue;
    let touchY=null;
    scroller.addEventListener('touchstart',event=>{
      if(event.touches.length===1)touchY=event.touches[0].clientY;
      else touchY=null;
    },{passive:true});
    scroller.addEventListener('touchmove',event=>{
      if(touchY===null || event.touches.length!==1 || !event.cancelable)return;
      const y=event.touches[0].clientY;
      const delta=y-touchY;
      const atTop=scroller.scrollTop<=0;
      const atBottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-1;
      if((atTop&&delta>0)||(atBottom&&delta<0))event.preventDefault();
      touchY=y;
    },{passive:false});
    scroller.addEventListener('touchend',()=>{touchY=null},{passive:true});
    scroller.addEventListener('touchcancel',()=>{touchY=null},{passive:true});
  }
}
function setupControls(){
  setupSheetTouchGuards();
  for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>setFilter(b.dataset.filter));
  let debounce=0;$('search').oninput=e=>{clearTimeout(debounce);debounce=setTimeout(()=>{state.query=e.target.value.toLocaleLowerCase('de').trim();refreshMarkers();refreshScheduleMatches()},130)};
  $('statusBtn').onclick=showSourceStatus;
  $('refreshBtn').onclick=()=>{if(Date.now()-state.fetchedAt>=manualRefreshDelayMs)refreshFeeds()};
  $('themeToggle').onclick=()=>changeTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  $('noticeClose').onclick=()=> $('notice').hidden=true;
  $('closeSheet').onclick=()=>closeSheets();$('closeStations').onclick=()=>closeSheets();$('scrim').onclick=()=>closeSheets();
  $('fitBtn').onclick=fitMap;$('stationBtn').onclick=showStations;
  $('stationSearch').oninput=renderStationResults;$('backStations').onclick=()=>{$('stationBoard').hidden=true;$('stationResults').hidden=false};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){for(const [key,job] of state.jobs){const e=state.markers.get(key);if(e)e.marker.setLatLng([job.to.lat,job.to.lon]);}state.jobs.clear();}
    else if(Date.now()-state.fetchedAt>30000)refreshFeeds();
  });
}
async function init(){
  try{changeTheme(localStorage.getItem('sr-theme')==='light'?'light':'dark')}catch{changeTheme('dark')}
  setupControls();if(!initMap())return;
  await loadIndexes();await Promise.allSettled([loadRailShapes(),refreshFeeds()]);
  setInterval(()=>{if(!document.hidden)refreshFeeds()},AVERAGE_POLL_MS);
}
init().catch(e=>{console.error('Startup error',e);setNotice('<strong>Fehler beim Start.</strong> Details in der Browser-Konsole.');});
