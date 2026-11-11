import {state,bootPhase,loadFavorites,saveFavorites,toggleFavorite,isFavorite,loadLineFavorites,saveLineFavorites,toggleLineFavorite,isLineFavorite,loadJourneyFavorites,saveJourneyFavorites,toggleJourneyFavorite,isJourneyFavorite,addTrackPoint,getTrackPoints,clearTrack,loadDismissedAlerts,saveDismissedAlerts,dismissAlert} from './app-state.js?v=9.9.5';
import {motionDuration,platformInfo} from './radar54-logic.mjs?v=9.9.5';
import {boundedMotionDuration,feedDiagnostics} from './radar66-logic.mjs?v=9.9.5';
import {selectRepresentatives,observationQuality} from './radar64-logic.mjs?v=9.9.5';
import {enrichTrainPlatform} from './train-platforms.js?v=9.9.5';
import {
  SOURCES, UPDATE_SOURCES, BBOX, txt, gtfsNumber, parseVehicles, parseUpdates, delayPresentation,
  feedAgeSeconds, shapeProject, pointAtDistance, routeOnlySnap, stopRows, formatClock, delayForVehicle,
  vehicleDelayInfo, bufferedAlong, departureDelay, isLiveUpdate, normalizeStopId
} from './core.js?v=9.9.5&rev=delay-copy-2';
import {playbackLag} from './radar45-logic.mjs?v=9.9.5';
import {trainReplayDuration} from './radar705-motion.mjs?v=9.9.5';
import {deriveCandidates,withinShapeBounds,chooseVerifiedCandidate} from './radar451-logic.mjs?v=9.9.5';
import {buildDepartureRows,romeSeconds} from './radar51-logic.mjs?v=9.9.5';
import {mergeStationDepartures} from './radar53-logic.mjs?v=9.9.5';
import {groupNearbyStops,nextNearbyDepartures} from './radar93-nearby.mjs?v=9.9.5';
import {formatStationName,formatRelativeAge,sourceLabel,expectedStopTime,hasKnownPlatform} from './radar92-details.mjs?v=9.9.5&rev=station-labels-2';
import {buildFeedStatus, processPositionFeed, mergePositionVehicles, pruneStaleVehicles, processUpdates, parseAlerts} from './feed-process.mjs?v=9.9.5';
import {t, setLocale, getLocale, initLocale} from './translations.mjs?v=9.9.5';

const $ = id => document.getElementById(id);
const DIRECT_POSITION_SOURCES=['sta_direct'];
const POSITION_SOURCES=[...SOURCES,...DIRECT_POSITION_SOURCES];
const DIRECT_UPDATE_SOURCES=['sta_direct_updates'];
const ALL_UPDATE_SOURCES=[...UPDATE_SOURCES,...DIRECT_UPDATE_SOURCES];
const ALERT_SOURCES=['sta_alerts'];
const ENDPOINTS=[...POSITION_SOURCES,...ALL_UPDATE_SOURCES,...ALERT_SOURCES];
let lastMotionFrame = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DETAIL_MAX_AGE = 120000;
const VEHICLE_KEEP_MS = 30 * 60 * 1000; // Keep a clearly labelled last-known marker during an outage.
const STALE_MAX_AGE_SEC = 60 * 60; // Never show observations older than 1 hour.
const MARKER_MAX_AGE_SEC = 12 * 60;
const AVERAGE_POLL_MS = 20000;
const BUS_PLAYBACK_LAG_MS = 38000; // Fallback lag for irregular updates, never predict ahead.
const BUS_TRACK_MAX_GAP_MS = 140000;
const MAX_INTERPOLATION_METERS = 3000;
const snapMaxMeters = 350;
const manualRefreshDelayMs=3000;
let selectionRenderToken=0; // Invalidates stale async timetable renders after a new selection.
let tileErrorCount=0;
let tileLoadedCount=0;
let fallbackTilesUsed=false;
let tileLastHealthyAt=0;
let initiallyLocated=false;
const MAP_PLACES={
  sterzing:[46.895,11.433,12], bozen:[46.498,11.354,12], brixen:[46.717,11.485,12],
  meran:[46.670,11.160,12], bruneck:[46.797,11.940,12], trento:[46.068,11.122,12]
};
const TILE_PROVIDERS=[
  {name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',options:{attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a>'}},
  {name:'OSM HOT',url:'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',options:{subdomains:'abc',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a> · Tiles © Humanitarian OpenStreetMap Team'}}
];
let tileProviderIndex=0;
const RT_MAX_AGE_SEC=15*60;

function safeText(value) { return txt(value); }
function duration(ms) {return Math.round(ms/1000)}
function escapeHtml(value) { return safeText(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function E(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function B(cls,txt,fn){const b=E('button',cls,txt);b.type='button';if(fn)b.addEventListener('click',fn);return b}
function setNotice(message, visible=true) {
  $('notice').hidden=!visible;
  if(message) $('notice').innerHTML='<button class="info-close" id="noticeClose" aria-label="Hinweis schließen">×</button>'+message;
  $('noticeClose').onclick=()=> $('notice').hidden=true;
}
async function fetchJson(url, timeout=12500) {
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeout);
  try {
    const r=await fetch(url,{signal:ctl.signal,cache:url.startsWith('/api/')?'no-store':'default'});
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
function allSourceCount(){return Object.values(state.statuses).filter(s=>s==='ok').length}
function statusLabel() {
  const good=allSourceCount(), vehicleGood=POSITION_SOURCES.filter(s=>state.statuses[s]==='ok').length;
  const favCount=state.favorites.size;
  const status=$('statusBtn');status.classList.toggle('ok',good===ENDPOINTS.length);
  status.classList.toggle('error',vehicleGood===0);
  const favText=favCount>0?' · '+favCount+' '+t('misc.favorites')+'★':'';
  $('statusText').textContent=good===ENDPOINTS.length?t('status.feedsOk'):vehicleGood===0?t('status.offline'):good+'/'+ENDPOINTS.length+favText;
  const favBtn=$('favBtnTop');if(favBtn){const dot=favBtn.querySelector('.status-dot');if(dot){dot.className='status-dot'+(favCount>0?' fav-active':'');}}
}
function isFeedHealthy(){
  return POSITION_SOURCES.some(s=>state.statuses[s]==='ok'||state.statuses[s]==='old');
}
function updateFeedHealthBanner(){
  const banner=$('feedHealthBanner');
  if(!banner)return;
  banner.hidden=isFeedHealthy();
}
function updateHealthPanel(){
  const panel=$('healthPanel');
  if(!panel||panel.hidden)return;
  const good=allSourceCount();
  const vehicleGood=POSITION_SOURCES.filter(s=>state.statuses[s]==='ok').length;
  const g=SOURCES.filter(indexReady).length;
  const now=Date.now();
  const lastUpd=state.fetchedAt?new Date(state.fetchedAt).toLocaleTimeString(getLocale()==='it'?'it-IT':'de-IT',{hour:'2-digit',minute:'2-digit'}):'Noch keine Daten';
  $('healthFeeds').textContent=good+'/'+ENDPOINTS.length;
  $('healthFeeds').className='health-val '+(good===ENDPOINTS.length?'ok':good>0?'warn':'bad');
  $('healthVehicles').textContent=state.vehicles.size+' ('+vehicleGood+' '+t('misc.live')+')';
  $('healthVehicles').className='health-val '+(vehicleGood>0?'ok':vehicleGood===0?'bad':'warn');
  $('healthRegions').textContent=g+'/3';
  $('healthRegions').className='health-val '+(g===3?'ok':g>0?'warn':'bad');
  $('healthUpdated').textContent=lastUpd;
  $('healthTiles').textContent=tileLoadedCount+' '+t('misc.loaded')+(tileErrorCount>0?' · '+tileErrorCount+' '+t('misc.errors'):'');
  $('healthTiles').className='health-val '+(tileErrorCount===0?'ok':'warn');
}
function updateFavPanel(){
  const panel=$('favPanel');
  const body=$('favBody');
  if(!panel||!body||panel.hidden)return;
  const favs=[...state.favorites].filter(k=>state.vehicles.has(k));
  body.innerHTML='';
  if(favs.length===0){
    body.innerHTML='<div class="fav-empty" data-t="fav.empty">Keine favorisierten Fahrzeuge. Tippe in einem Fahrzeug-Detail auf „★ Favorit“.</div>';
    return;
  }
  for(const key of favs){
    const v=state.vehicles.get(key);
    if(!v)continue;
    const item=document.createElement('div');
    item.className='fav-item';
    const info=document.createElement('div');
    info.className='fav-info';
    const name=document.createElement('div');
    name.className='fav-name';
    name.textContent=v.name;
    const sub=document.createElement('div');
    sub.className='fav-sub';
    sub.textContent=v.headsign||t('detail.trainLineUnverified')+' · '+sourceLabel(v.source);
    const delay=document.createElement('div');
    delay.className='fav-delay';
    const info2=currentVehicleDelay(v);
    const d=info2?Number(info2.delay):null;
    const dMinutes=d===null?null:Math.round(d/60);
    delay.textContent=dMinutes===null?'Keine Daten':dMinutes>0?'+'+dMinutes+' '+t('misc.minutes'):dMinutes<0?Math.abs(dMinutes)+' Min. früher':t('lines.onTimeShort');
    delay.className='fav-delay '+(dMinutes===null?'unknown':dMinutes>=15?'bad':dMinutes>=1?'warn':'ok');
    info.append(name,sub,delay);
    const remove=document.createElement('button');
    remove.className='fav-remove';
    remove.textContent='✕';
    remove.title='Aus Favoriten entfernen';
    remove.onclick=(e)=>{e.stopPropagation();toggleFavorite(v.key);updateFavPanel();refreshMarkers();statusLabel();};
    item.append(info,remove);
    item.onclick=()=>{selectVehicle(v.key);$('favPanel').hidden=true;};
    body.appendChild(item);
  }
}
function buildLineStatus(){
  const lines=new Map();
  for(const v of state.vehicles.values()){
    if(!v.routeId)continue;
    const key=v.source+':'+v.routeId;
    if(!lines.has(key))lines.set(key,{routeId:v.routeId,source:v.source,name:v.name,vehicles:[],maxDelay:0,delayed:0});
    const l=lines.get(key);
    l.vehicles.push(v);
    const info=currentVehicleDelay(v);
    const d=info?Math.max(0,Math.round(Number(info.delay)/60)):0;
    l.maxDelay=Math.max(l.maxDelay,d);
    if(d>=1)l.delayed++;
  }
  // Störungs-Alerts pro Linie einbeziehen
  for(const source of Object.keys(state.alerts||{})){
    for(const a of state.alerts[source]||[]){
      if(a.routeId){
        const key=source+':'+a.routeId;
        if(!lines.has(key))lines.set(key,{routeId:a.routeId,source,name:a.routeId,vehicles:[],maxDelay:0,delayed:0});
        const l=lines.get(key);
        if(a.cause===3||a.cause===4||a.effect===2||a.effect===4)l.maxDelay=Math.max(l.maxDelay,15);
      }
    }
  }
  return [...lines.values()].map(l=>{
    let status='unknown';
    if(l.maxDelay>=15)status='disturbed';
    else if(l.maxDelay>=1)status='delayed';
    else if(l.maxDelay>0)status='delayed';
    else if(l.vehicles.length>0)status='ok';
    return {...l,status};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderLinesPanel(){
  const panel=$('linesPanel');
  const body=$('linesBody');
  if(!panel||!body)return;
  const q=$('linesSearch')?$('linesSearch').value.toLowerCase():'';
  const filter=$('linesFilter')?document.querySelector('.lines-filters .chip.active')?.dataset?.lineFilter:'all';
  const lines=buildLineStatus().filter(l=>{
    if(q&&!l.name.toLowerCase().includes(q)&&!l.routeId.toLowerCase().includes(q))return false;
    if(filter==='onTime'&&l.status!=='ok')return false;
    if(filter==='delayed'&&l.status!=='delayed')return false;
    if(filter==='disturbed'&&l.status!=='disturbed')return false;
    return true;
  });
  body.innerHTML='';
  if(lines.length===0){
    body.innerHTML='<div class="lines-empty">Keine Linien gefunden.</div>';
    return;
  }
  for(const l of lines){
    const item=document.createElement('div');
    item.className='lines-item';
    const name=document.createElement('div');
    name.className='line-name';
    name.textContent=l.name||l.routeId;
    const info=document.createElement('div');
    info.className='line-info';
    info.textContent=l.vehicles.length+' Fahrzeug'+(l.vehicles.length>1?'en':'')+' · '+sourceLabel(l.source);
    const status=document.createElement('div');
    status.className='line-status '+l.status;
    status.textContent=l.status==='ok'?t('lines.onTimeShort'):l.status==='delayed'?t('lines.delayedBy'):l.status==='disturbed'?t('lines.status.disturbed'):t('lines.status.unknown');
    const favorite=document.createElement('button');
    favorite.type='button';favorite.className='sr88-line-favorite'+(isLineFavorite(l.source+':'+l.routeId)?' active':'');
    favorite.textContent=isLineFavorite(l.source+':'+l.routeId)?'★':'☆';
    favorite.setAttribute('aria-label',isLineFavorite(l.source+':'+l.routeId)?'Linien-Favorit entfernen':'Linie zu Favoriten hinzufügen');
    favorite.title=favorite.getAttribute('aria-label');
    favorite.onclick=(e)=>{e.stopPropagation();toggleLineFavorite(l.source+':'+l.routeId);refreshMarkers();renderLinesPanel();};
    const chevron=document.createElement('div');
    chevron.className='line-chevron';chevron.textContent='›';
    item.append(name,info,status,favorite,chevron);
    item.onclick=()=>{highlightLine(l.routeId);$('linesPanel').hidden=true;};
    body.appendChild(item);
  }
}
function highlightLine(routeId){
  for(const [key,entry] of state.markers){
    const el=entry.marker.getElement?.();
    const v=state.vehicles.get(key);
    if(v&&v.routeId===routeId){el.classList.add('lines-item-line-highlight');}
    else if(el)el.classList.remove('lines-item-line-highlight');
  }
}
function updateAlertTicker(){
  const ticker=$('alertTicker');
  const countEl=ticker.querySelector('.alert-count');
  const listEl=ticker.querySelector('.alert-list');
  if(!ticker)return;
  const all=[];
  for(const source of Object.keys(state.alerts)){
    for(const a of state.alerts[source]){
      all.push({...a, source});
    }
  }
  if(all.length===0){ticker.hidden=true;return;}
  ticker.hidden=false;
  countEl.textContent=all.length+' Störung'+(all.length>1?'en':'')+' im System';
  listEl.innerHTML='';
  const causeNames={1:'Verspätung',2:'Verspätung',3:'Ausfall',4:'Ausfall',5:'Verspätung',6:'Verspätung',7:'Verspätung',8:'Störung',9:'Störung'};
  const nowSec=Date.now()/1000;
  for(const a of all.slice(0,8)){
    const item=document.createElement('div');
    item.className='alert-item';
    const cName=causeNames[a.cause]||'Störung';
    const effName=a.effect===1?'Verspätung':a.effect===2?'Ausfall':a.effect===3?'Verspätung':a.effect===4?'Ausfall':a.effect===5?'Verspätung':a.effect===6?'Verspätung':'Störung';
    // Datenaktualität berechnen
    const ageSec=a.fetchedAt?Math.max(0,Math.floor(nowSec-a.fetchedAt/1000)):null;
    const ageStr=ageSec!==null?ageSec<60?'gerade':ageSec<3600?Math.floor(ageSec/60)+' Min.':Math.floor(ageSec/3600)+' Std.':'-';
    // Schweregrad-Farbe
    let sevClass='alert-sev-medium';
    if(a.cause===3||a.cause===4||a.effect===2||a.effect===4)sevClass='alert-sev-high';
    else if(a.cause===1||a.cause===2||a.cause===5||a.effect===1||a.effect===5)sevClass='alert-sev-low';
    // Betroffene Linien aus informed_entity (route_id)
    // route_id aus dem GTFS-RT Feed sind technische IDs, keine lesbaren Liniennummern.
    // Deshalb nur die Anzahl anzeigen, nicht die kryptischen IDs.
    let lineCount=0;
    for(const ent of (a.informed_entity||[])){
      if(ent.route_id)lineCount++;
    }
    const lineStr=lineCount?'Betroffene Linien: '+lineCount:'';
    item.innerHTML='<span class="alert-chip alert-sev '+sevClass+'">'+cName+'</span>'+escapeHtml(a.header)+(a.description?': '+escapeHtml(a.description.substring(0,70)):'')+(lineStr?' <span class="alert-lines">'+lineStr+'</span>':'')+'<span class="alert-age">'+ageStr+' · '+sourceLabel(a.source)+'</span>';
    listEl.appendChild(item);
  }
  // Einzelner Schließen-Button für das gesamte Ticker-Panel
  let closeBtn=ticker.querySelector('.alert-close-all');
  if(!closeBtn){
    closeBtn=document.createElement('button');
    closeBtn.className='alert-close-all';
    closeBtn.textContent=t('alert.closeAll');
    closeBtn.title='Störungs-Ticker schließen';
    closeBtn.onclick=()=>{
      // Aktuelle Alert-IDs merken damit sie beim nächsten Refresh nicht wieder auftauchen
      for(const source of Object.keys(state.alerts)){
        for(const a of state.alerts[source]){
          if(a.id)dismissAlert(a.id);
        }
      }
      state.alerts={};
      ticker.hidden=true;
      updateAlertTicker();
    };
    ticker.insertBefore(closeBtn, listEl);
  }
}
function showSourceStatus(){
  const lines=ENDPOINTS.map(ep=>'<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0"><b>'+escapeHtml(ep)+'</b><span>'+ (state.statuses[ep]==='ok'?'✓ '+t('status.feedsOk'):'↻ '+(state.statuses[ep]==='old'?t('status.old'):t('status.error')))+'</span></div>').join('');
  const g=SOURCES.filter(indexReady).length;
  setNotice('<strong>Datenquellen · Südtirol Radar '+(window.SuedtirolRadar80?.version?.()||'')+'</strong><div style="margin:7px 0">'+lines+'</div><div>GTFS-Fahrplandaten: <b>'+g+'/3</b> Regionen geladen.</div><div style="margin-top:5px">'+mapMetrics().inside+' Fahrzeuge hier, '+state.markers.size+' Marker geladen, '+state.vehicles.size+' Positionen im Feed. Kartenanbieter: '+escapeHtml(TILE_PROVIDERS[tileProviderIndex].name)+' ('+tileLoadedCount+' Kacheln geladen, '+tileErrorCount+' Fehler).</div><div style="margin-top:5px">Kartenebenen: <b>'+escapeHtml(leafletLayoutHealth())+'</b>.</div><div style="margin-top:5px">STA Open Data Hub: direkter offizieller Positions- und Trip-Update-Feed. Trenitalia/Trentino: teilweise geschätzte Positionen. RFI-Daten sind nur in speziellen Stationsfunktionen verfügbar. Feed-Erreichbarkeit bedeutet nicht echtes GPS.</div>');
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
  state.indexes.sta_direct=state.indexes.sta;
  const present=SOURCES.filter(indexReady);
  if(present.length<3)setNotice('<strong>GTFS-Import ausstehend:</strong> '+present.length+'/3 Regionen haben Fahrplandaten. Die Karte funktioniert, aber Buslinien und Fahrtziele bleiben ohne Zuordnung unbekannt. Starte die GitHub-Action „Update GTFS timetable indexes“.');
}
async function loadRailShapes(){
  await Promise.all(SOURCES.map(async source=>{
    try {state.shapes[source]=await fetchJson('/data/'+source+'-shapes.json',16000)}
    catch(e){console.warn('Train geometry not loaded:',source,e)}
  }));
  state.shapes.sta_direct=state.shapes.sta;
}
// Radar 3.7: Matching, verifiable GTFS bus route shapes, generated by tools/build_gtfs.py.
// A manifest failure never blocks live map markers or the existing rail geometry.
// The official STA feed uses exactly the same GTFS timetable context as STA.
async function loadBusShapeManifests(){
  await Promise.all(['sta','trentino'].map(async source=>{
    try{
      const manifest=await fetchJson('/data/'+source+'-bus-index.json',12000);
      if(manifest?.byShape && typeof manifest.byShape==='object')state.busShapeManifests[source]=manifest;
    }catch(e){console.info('Bus-GTFS-Strecken noch nicht importiert:',source)}
  }));
}
async function loadBusShapesForVehicles(){
  const targets=[];
  const bounds=state.map?.getBounds?.();
  for(const v of state.vehicles.values()){
    if(v.kind!=='bus')continue;
    // Prefer loading the exact confirmed trip or actively tracked bus.
    if(bounds && v.key!==state.selectedKey && !bounds.contains([v.lat,v.lon]))continue;
    const manifest=state.busShapeManifests[v.source];
    const shapeIds=v.shapeId?[v.shapeId]:v.routeShapeId?[v.routeShapeId]:v.routeShapeCandidates||[];
    // Legacy manifests lack bounding boxes. Do not fetch multiple huge 7MB
    // shards speculatively over a weak mobile connection; run the 4.5.1 GTFS import first.
    if(shapeIds.length>1 && !manifest?.bounds && !v.shapeId && !v.routeShapeId)continue;
    for(const shapeId of shapeIds){
      if(!withinShapeBounds(manifest?.bounds?.[shapeId],v.lat,v.lon))continue;
      const file=manifest?.byShape?.[shapeId];
      if(!file||!new RegExp('^'+v.source+'-bus-[0-9]+-shapes\\.json$').test(file))continue;
      const key=v.source+'/'+file;
      if(state.busShapeLoaded.has(key)||state.busShapePending.has(key)||state.busShapeFailures.has(key))continue;
      if(!targets.some(t=>t.key===key))targets.push({source:v.source,file,key,priority:v.key===state.selectedKey?0:v.shapeId?1:2});
    }
  }
  // Large region sharding is downloaded on demand, never all at once.
  targets.sort((a,b)=>a.priority-b.priority);
  const saveData=navigator.connection?.saveData || /^(slow-2g|2g)$/.test(navigator.connection?.effectiveType||'');
  await Promise.all(targets.slice(0,saveData?1:3).map(async ({source,file,key})=>{
    state.busShapePending.add(key);
    try{
      const data=await fetchJson('/data/'+file,20000);
      if(!data?.shapes||typeof data.shapes!=='object')throw new Error('Ungültiger GTFS-Streckendatensatz');
      if(!state.shapes[source])state.shapes[source]={shapes:{}};
      if(!state.shapes[source].shapes)state.shapes[source].shapes={};
      Object.assign(state.shapes[source].shapes,data.shapes);
      state.busShapeLoaded.add(key);
      refreshMarkers();document.dispatchEvent(new Event('sr37:shapes'));
    }catch(e){
      // One bad shard should not repeatedly consume 4G on every 20-second poll.
      state.busShapeFailures.add(key);
      console.warn('GTFS-Busstrecke nicht verfügbar:',file,e);
    }finally{state.busShapePending.delete(key)}
  }));
}
async function loadDetails(source){
  if(source==='sta_direct')return loadDetails('sta').then(d=>{if(d)state.details.sta_direct=d;return d});
  if(state.details[source])return state.details[source];
  // Cache the in-flight promise as well: repeated tapping does not fetch several times.
  if(!state.detailPending)state.detailPending={};
  if(!state.detailPending[source])state.detailPending[source]=fetchJson('/data/'+source+'-details.json',20000)
    .then(d=>{state.details[source]=d;if(source==='sta')state.details.sta_direct=d;return d})
    .catch(e=>{console.warn('GTFS trip details unavailable',source,e);return null})
    .finally(()=>delete state.detailPending[source]);
  return state.detailPending[source];
}
// Key-free raster sources. Respect cache headers and provider usage terms.
// Tiles load only for the user's current viewport (no bulk prefetch).
function createTileLayer(which=0){
  const provider=TILE_PROVIDERS[which];
  return L.tileLayer(provider.url,{
    minZoom:3,maxZoom:19,maxNativeZoom:19,
    keepBuffer:2,updateWhenIdle:true,updateWhenZooming:false,
    ...provider.options
  });
}
function switchTileProvider(which,reason='manuell'){
  if(!state.map||which===tileProviderIndex||which<0||which>=TILE_PROVIDERS.length)return;
  const previous=state.tiles;
  // Critical: NEVER overlay two partly loaded basemap layers. Their independent
  // tile containers can create black checkerboard gaps in mobile Safari.
  if(previous&&state.map.hasLayer(previous))state.map.removeLayer(previous);
  tileProviderIndex=which;fallbackTilesUsed=true;
  tileLoadedCount=0;tileErrorCount=0;
  const next=createTileLayer(which);
  next.on('tileload',()=>{tileLoadedCount++;tileLastHealthyAt=Date.now()});
  next.on('tileerror',onTileError);
  state.tiles=next;
  next.addTo(state.map);
  if(state.map.getPane('markerPane'))state.map.getPane('markerPane').style.zIndex='650';
  state.map.invalidateSize({pan:false});
  console.info('Radar Kartenquelle:',TILE_PROVIDERS[which].name,reason);
  setNotice('<strong>Kartenanbieter gewechselt:</strong> '+escapeHtml(TILE_PROVIDERS[which].name)+'. Wenn Kacheln fehlen, tippe auf ↻ oder wechsle mit 🗺 zurück.');
}
function onTileError(){
  tileErrorCount++;
  // Provider changes are only made by the user. Automatic failover previously
  // mixed tiles from separate layers before either provider had fully loaded.
  if(tileErrorCount===5){
    setNotice('<strong>Kartenbilder fehlen.</strong> Der Kartenserver liefert einzelne Kacheln nicht. Tippe auf 🗺, um zum anderen Kartenanbieter zu wechseln. Zug- und Busdaten bleiben unabhängig erreichbar.');
  }
}
function leafletLayoutHealth(){
  if(!state.map)return 'unbekannt';
  const tiles=state.map.getPane('tilePane'),pins=state.map.getPane('markerPane');
  if(!tiles||!pins)return 'fehlende Leaflet-Ebenen';
  const a=getComputedStyle(tiles),b=getComputedStyle(pins);
  return a.position==='absolute'&&b.position==='absolute'&&Number.parseInt(b.zIndex,10)>Number.parseInt(a.zIndex,10)
    ?'OK':'CSS-Positionierung fehlerhaft ('+a.position+'/'+b.position+')';
}
function mapMetrics(){
  if(!state.map)return {inside:0,shown:0,total:state.vehicles.size};
  let inside=0;
  const bounds=state.map.getBounds();
  for(const [,v] of state.vehicles){
    if(visible(v) && bounds.contains([v.lat,v.lon]))inside++;
  }
  return {inside,shown:state.markers.size,total:state.vehicles.size};
}
function updateViewportBadge(){
  const el=$('viewportBadge');if(!el)return;
  const {inside,shown,total}=mapMetrics();
  el.textContent=total?(inside?'📍 '+inside+' hier · '+shown+' angezeigt':'📍 0 hier · '+shown+' anderswo'):'📍 Keine Positionen';
  el.classList.toggle('empty',inside===0 && total>0);
  el.title='Tippen, um alle sichtbaren Fahrzeugpositionen zu finden';
}
function moveToPlace(place){
  if(!state.map)return;
  $('areaPicker').hidden=true;
  if(place==='all'){fitMap();return;}
  const target=MAP_PLACES[place];if(!target)return;
  state.map.setView([target[0],target[1]],target[2],{animate:true});
  updateViewportBadge();
}
function changeTheme(theme){
  document.documentElement.setAttribute('data-theme',theme);
  $('themeToggle').textContent=theme==='dark'?'☀':'☾';
  try{localStorage.setItem('sr-theme',theme)}catch(e){}
  // No URL change/re-download required when switching modes.
}
function initMap(){
  if(window.__radarRecoveryMap){try{window.__radarRecoveryMap.remove()}catch(e){console.warn(e)}window.__radarRecoveryMap=null}
  if(!window.L){setNotice('<strong>Kartenbibliothek nicht erreichbar.</strong> Prüfe die Internetverbindung oder den Leaflet-CDN.');return false;}
  const map=L.map('map',{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([46.64,11.35],9);
  state.map=map;
  state.tiles=createTileLayer().addTo(map);
  state.tiles.on('tileload',()=>{tileLoadedCount++;tileLastHealthyAt=Date.now()});
  state.tiles.on('tileerror',onTileError);
  // Recalculate Leaflet's viewport when Safari's dynamic toolbar or orientation
  // changes the available height. Do not continuously redraw tiles.
  function resizeMap(){ if(state.map && typeof state.map.invalidateSize==='function')state.map.invalidateSize({pan:false,debounceMoveend:true}); }
  window.addEventListener('resize',resizeMap,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(resizeMap,250),{passive:true});
  if(window.visualViewport) window.visualViewport.addEventListener('resize',resizeMap,{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(resizeMap,180),{passive:true});
  setTimeout(resizeMap,450);
  setTimeout(resizeMap,1700);
  // Explicit marker z-index survives broken/blocked external Leaflet CSS.
  const markerPane=map.getPane('markerPane');if(markerPane)markerPane.style.zIndex='650';
  state.layer=L.layerGroup().addTo(map);
  state.trackLayer=L.layerGroup().addTo(map);
  L.control.zoom({position:'bottomleft'}).addTo(map);
  map.on('moveend',()=>{
    updateViewportBadge();updateMapEmptyState();
    clearTimeout(state.shapeViewportTimer);
    state.shapeViewportTimer=setTimeout(()=>loadBusShapesForVehicles().catch(console.warn),650);
  });
  map.on('zoomend',()=>{ $('map').classList.toggle('map-zoomed-out',map.getZoom()<11);updateViewportBadge(); });
  $('map').classList.toggle('map-zoomed-out',map.getZoom()<11);
  return true;
}
function visible(v){
  if(state.filter==='trains'&&v.kind!=='train'||state.filter==='buses'&&v.kind!=='bus')return false;
  if(state.filter==='linefav'){
    const lineKey=v.routeId?(v.source+':'+v.routeId):'';
    if(!lineKey||!isLineFavorite(lineKey))return false;
  }
  if(state.filter==='favorites'&&!isFavorite(v.key))return false;
  if(state.filter==='delayed'){
    const delay=currentVehicleDelay(v);
    if(!delay||!Number.isFinite(delay.delay)||delay.delay<=0)return false;
  }
  if(state.query&&!`${v.name} ${v.headsign} ${v.vehicleId} ${v.tripId} ${v.routeLongName}`.toLocaleLowerCase('de').includes(state.query))return false;
  return true;
}
function markerIcon(v){
  const train=v.kind==='train',label=v.name.startsWith('Linie unbekannt')||v.name==='Zugnummer unbekannt'?'':v.name;
  const isOld=v.stale || (Number.isFinite(v.timestamp) && v.timestamp>1e9 && Date.now()/1000-v.timestamp>300);
  const isEstimated=/simuliert|geschätzt|interpoliert|berechnet/i.test(v.positionType||'');
  const isFav=isFavorite(v.key);
  const lineKey=v.routeId?(v.source+':'+v.routeId):'';
  const lineFav=lineKey&&isLineFavorite(lineKey);
  const zoom=state.map?state.map.getZoom():0;
  const showSpeed=zoom>=13 && v.speed!==null;
  const cls='marker-wrap '+(train?'train':'bus')+(label?'':' unverified')+(state.selectedKey===v.key?' selected':'')+(isOld?' sr43-stale':'')+(isEstimated?' sr86-estimated':' sr86-feed-position')+(isFav?' favorite':'')+(lineFav?' line-favorite':'');
  const speedText=showSpeed?'<div class="marker-speed">'+v.speed+' km/h</div>':'';
  const icon=`<div class="${cls}">${speedText}<div class="marker-label">${escapeHtml(label)}</div><div class="marker-circle">${train?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="17" rx="4"/><path d="M5 10h14M8 16h1m6 0h1M8 19.5l-2 2m10-2 2 2"/></svg>':'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="16" rx="3"/><path d="M3 11h18M7 15h2m6 0h2M7 19l-2 2m14-2 2 2"/></svg>'}${isFav?'<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22l-5-4.87L2 9.27l6.91-1.02L12 2z"/></svg>':''}</div></div>`;
  return L.divIcon({className:'radar-custom',html:icon,iconSize:[30,48],iconAnchor:[15,38]});
}
function shapeOf(v){
  const id=v.shapeId || v.routeShapeId;
  return id ? state.shapes[v.source]?.shapes?.[id] : null;
}
function mapTarget(v){
  const path=shapeOf(v);
  if(path){
    const routeOnly=Boolean(v.routeShapeId && !v.shapeId);
    const snap=routeOnly?routeOnlySnap(path,v.lat,v.lon,v.bearing):shapeProject(path,v.lat,v.lon);
    if(!snap || snap.distance>(v.kind==='bus'?65:snapMaxMeters))
      return {lat:v.lat,lon:v.lon,path:null,along:null};
    return {lat:snap.lat,lon:snap.lon,path,along:snap.along,matchType:routeOnly?'unique':'trip'};
  }
  // 4.5.1: Several official variants may exist for the same line and direction.
  // Choose only one geographically and directionally DISTINCT official GTFS
  // shape. If two variants are equally plausible, show the real feed point.
  if(v.kind==='bus' && Array.isArray(v.routeShapeCandidates) && v.routeShapeCandidates.length){
    const data=state.shapes[v.source]?.shapes||{};
    const hits=[];
    for(const id of v.routeShapeCandidates){
      const candidate=data[id];
      if(!Array.isArray(candidate)||candidate.length<2)continue;
      const snap=routeOnlySnap(candidate,v.lat,v.lon,v.bearing);
      if(snap)hits.push({id,path:candidate,snap});
    }
    const match=chooseVerifiedCandidate(hits);
    if(match)return {lat:match.snap.lat,lon:match.snap.lon,path:match.path,along:match.snap.along,matchType:'candidate',shapeId:match.id};
  }
  return {lat:v.lat,lon:v.lon,path:null,along:null};
}
function stopJob(key){state.jobs.delete(key);}
function requestMotionFrame(){if(!frameId)frameId=requestAnimationFrame(animationLoop);}
function animationLoop(now){
  frameId=0;
  // 30 fps cap on mobile: retain final confirmed point and reduce DOM work.
  const frameGap=window.innerWidth<=600?32:16;
  if(now-lastMotionFrame<frameGap){if(state.jobs.size||state.busTracks.size)requestMotionFrame();return;}
  lastMotionFrame=now;
  // The existing proven rail animation remains unchanged.
  for(const [key,job] of state.jobs){
    const marker=state.markers.get(key)?.marker;
    if(!marker){state.jobs.delete(key);continue;}
    const v=state.vehicles.get(key);
    if(!motionDuration(v,null,Date.now(),reducedMotion.matches)){
      if(v)marker.setLatLng([v.lat,v.lon]);state.jobs.delete(key);continue;
    }
    const raw=Math.min(1,(now-job.start)/job.duration);
    const f=job.replay?raw:raw*raw*(3-2*raw);
    let pos;
    if(job.path && job.fromAlong!==null && job.toAlong!==null){
      pos=pointAtDistance(job.path,job.fromAlong+(job.toAlong-job.fromAlong)*f,job.latReference);
    }else pos={lat:job.from.lat+(job.to.lat-job.from.lat)*f,lon:job.from.lng+(job.to.lon-job.from.lng)*f};
    if(pos&&marker.getLatLng().distanceTo([pos.lat,pos.lon])>0.7)marker.setLatLng([pos.lat,pos.lon]);
    if(raw>=1){marker.setLatLng([job.to.lat,job.to.lon]);state.jobs.delete(key);}
  }
  // Road animation follows a real GTFS shape between TWO received fixes.
  // It intentionally never extrapolates, so sparse feeds may still pause.
  let roadPending=false;
  // Compute viewport bounds once per frame rather than once for each bus.
  const busViewportBounds=state.map?.getBounds?.();
  for(const [key,track] of state.busTracks){
    const entry=state.markers.get(key), marker=entry?.marker;
    if(!marker || now-track.lastSeen>BUS_TRACK_MAX_GAP_MS){state.busTracks.delete(key);continue;}
    const v=state.vehicles.get(key);
    if(!motionDuration(v,null)){
      if(v)marker.setLatLng([v.lat,v.lon]);state.busTracks.delete(key);continue;
    }
    if(track.samples.length<2)continue;
    const newest=track.samples.at(-1);
    const newestPos=pointAtDistance(track.path,newest.along,track.latReference);
    // Offscreen vehicles stay on their last confirmed point; don't animate
    // hundreds of hidden Leaflet DOM nodes on a battery-powered phone.
    const inView=!busViewportBounds || key===state.selectedKey ||
      busViewportBounds.contains(marker.getLatLng()) || (newestPos && busViewportBounds.contains([newestPos.lat,newestPos.lon]));
    if(!inView){
      if(newestPos && marker.getLatLng().distanceTo([newestPos.lat,newestPos.lon])>1)
        marker.setLatLng([newestPos.lat,newestPos.lon]);
      continue;
    }
    const showAt=now-playbackLag(track.samples);
    const along=bufferedAlong(track.samples,showAt);
    const pos=along===null?null:pointAtDistance(track.path,along,track.latReference);
    if(pos&&marker.getLatLng().distanceTo([pos.lat,pos.lon])>0.7)marker.setLatLng([pos.lat,pos.lon]);
    if(showAt<newest.time)roadPending=true;
  }
  if(state.jobs.size || roadPending)requestMotionFrame();
}
function animateTo(key,entry,target){
  const marker=entry.marker, current=marker.getLatLng(), dest=L.latLng(target.lat,target.lon);
  const vehicle=state.vehicles.get(key);
  const dist=current.distanceTo(dest);
  stopJob(key);
  const duration=motionDuration(state.vehicles.get(key),entry.feedTimestamp,Date.now(),reducedMotion.matches);
  if(!duration){marker.setLatLng(dest);return;}
  if(dist<1.5)return;
  if(state.map && typeof state.map.getBounds==='function'){
    const view=state.map.getBounds();
    if(!view.contains(current) && !view.contains(dest)){marker.setLatLng(dest);return;}
  }
  if(dist>MAX_INTERPOLATION_METERS||reducedMotion.matches||document.hidden){marker.setLatLng(dest);return;}
  const oldAlong=entry.target?.along;
  const fromSnap=target.path ? shapeProject(target.path,current.lat,current.lng) : null;
  const alongDelta=fromSnap && Number.isFinite(target.along)
    ? target.along-fromSnap.along : NaN;
  const previousVerified=entry.target?.path === target.path && Number.isFinite(oldAlong);
  const followShape=Boolean(target.path && fromSnap && fromSnap.distance<90 &&
    Number.isFinite(alongDelta) && Math.abs(alongDelta)<3000 && alongDelta>=-75 &&
    (!previousVerified || Math.abs(target.along-oldAlong)<3000));
  const replay=followShape?trainReplayDuration(vehicle,entry.feedTimestamp,dist,Date.now(),reducedMotion.matches):0;
  state.jobs.set(key,{start:performance.now(),
    duration:replay||Math.min(5500,Math.max(800,boundedMotionDuration(dist,vehicle?.kind))),
    replay:Boolean(replay),
    from:current,to:{lat:target.lat,lon:target.lon},
    path:followShape?target.path:null,fromAlong:followShape?fromSnap.along:null,
    toAlong:followShape?target.along:null,latReference:current.lat});
  requestMotionFrame();
}
function updateBusMotion(key,entry,target,v){
  stopJob(key);
  const marker=entry.marker;
  // Road geometry must be grounded and the vehicle must not be stale.
  // Without an official matching shape we must NOT draw a straight line through buildings.
  const age=v.timestamp?Date.now()/1000-v.timestamp:Infinity;
  if(!target.path || !Number.isFinite(target.along) || v.stale || !Number.isFinite(age) || age>300 || age< -30 ||
     reducedMotion.matches || document.hidden){
    state.busTracks.delete(key);
    marker.setLatLng([target.lat,target.lon]);
    return;
  }
  const now=performance.now();
  const previous=state.busTracks.get(key);
  const last=previous?.samples?.at(-1);
  const sameRoute=previous?.path===target.path && previous?.tripKey===(v.tripId||v.routeShapeId);
  const delta=last?target.along-last.along:0;
  const badJump=last && (delta < -20 || delta > MAX_INTERPOLATION_METERS || now-last.time>BUS_TRACK_MAX_GAP_MS);
  if(!sameRoute || badJump || !previous){
    state.busTracks.set(key,{path:target.path,tripKey:v.tripId||v.routeShapeId,
      latReference:target.lat,lastSeen:now,lastFeedTs:v.timestamp||0,
      samples:[{time:now,along:target.along}]});
    marker.setLatLng([target.lat,target.lon]);
    return;
  }
  previous.lastSeen=now;
  if(v.timestamp && previous.lastFeedTs && v.timestamp<=previous.lastFeedTs)return;
  previous.lastFeedTs=v.timestamp||0;
  // An actual stationary update must hold the marker, not force speed.
  const along=Math.max(last.along,target.along);
  previous.samples.push({time:now,along});
  previous.samples=previous.samples.slice(-5);
  requestMotionFrame();
}
function updateMapEmptyState(){
  const panel=$('sr88MapState');if(!panel)return;
  const title=$('sr88MapStateTitle'),message=$('sr88MapStateText'),action=$('sr88MapStateAction');
  const keys=state.fusion?.keys||selectRepresentatives(state.vehicles.values(),state.selectedKey).keys;
  const candidates=[...state.vehicles.values()].filter(v=>keys.has(v.key));
  const filtered=candidates.filter(visible);
  const bounds=state.map?.getBounds?.();
  const inView=filtered.filter(v=>!bounds||bounds.contains([v.lat,v.lon]));
  if(inView.length){panel.hidden=true;return;}
  // No vehicle in the current viewport is a normal map state, not an error.
  if(filtered.length&&bounds&&inView.length===0){panel.hidden=true;return;}
  panel.hidden=false;let mode='refresh';
  if(candidates.length&&filtered.length===0){title.textContent='Keine Fahrzeuge für diesen Filter';message.textContent='Ändere den Filter oder setze die Suche zurück.';action.textContent='Filter zurücksetzen';mode='filters';}
  else if(filtered.length&&bounds&&inView.length===0){title.textContent='Keine Fahrzeuge in diesem Ausschnitt';message.textContent='Im restlichen Gebiet können weiterhin Fahrzeuge unterwegs sein.';action.textContent='Alle Fahrzeuge zeigen';mode='fit';}
  else if(!candidates.length&&state.busy){title.textContent='Live-Daten werden geladen';message.textContent='Die Positionsfeeds werden gerade geprüft.';action.textContent='Bitte warten';mode='loading';}
  else if(!candidates.length&&POSITION_SOURCES.every(s=>state.statuses[s]!=='ok'&&state.statuses[s]!=='old')){title.textContent='Live-Feed gerade nicht erreichbar';message.textContent='Es liegen momentan keine verlässlichen Live-Positionen vor.';action.textContent='Erneut versuchen';mode='refresh';}
  else{title.textContent='Noch keine Live-Fahrzeuge verfügbar';message.textContent='Die Karte zeigt neue Positionen, sobald ein Feed sie liefert.';action.textContent='Daten aktualisieren';mode='refresh';}
  action.disabled=mode==='loading';
  action.onclick=()=>{if(mode==='filters'){$('search').value='';state.query='';setFilter('all');renderSearchResults();}else if(mode==='fit')fitMap();else refreshFeeds();};
}
function refreshMarkers(){
  if(!state.map)return;
  const fusion=selectRepresentatives(state.vehicles.values(),state.selectedKey);state.fusion={sources:fusion.sources,keys:fusion.keys,duplicates:fusion.duplicates};
  const active=new Set();
  for(const [key,v] of state.vehicles){
    if(!visible(v)||!fusion.keys.has(key))continue;
    active.add(key);
    const rawTarget={lat:v.lat,lon:v.lon,path:null,along:null};
    const target=motionDuration(v,null)?mapTarget(v):rawTarget;
    const aged=v.stale || (Number.isFinite(v.timestamp) && v.timestamp>1e9 && Date.now()/1000-v.timestamp>300);
    const lineKey=v.routeId?(v.source+':'+v.routeId):'';
    const iconKey=`${v.kind}|${v.name}|${state.selectedKey===key}|${aged}|${v.positionType||''}|${lineKey}`;
    let entry=state.markers.get(key);
    if(!entry){
      const marker=L.marker([target.lat,target.lon],{icon:markerIcon(v),keyboard:true,title:v.name}).addTo(state.layer);
      marker.on('click',()=>selectVehicle(key));
      entry={marker,iconKey,target,feedTimestamp:v.timestamp};state.markers.set(key,entry);
      // First bus position is a real feed observation, not a predicted position.
      if(v.kind==='bus' && !v.stale && v.timestamp && Date.now()/1000-v.timestamp<=300 &&
         target.path && Number.isFinite(target.along)){
        state.busTracks.set(key,{path:target.path,tripKey:v.tripId||v.routeShapeId,
          latReference:target.lat,lastSeen:performance.now(),lastFeedTs:v.timestamp||0,
          samples:[{time:performance.now(),along:target.along}]});
      }
    }else{
      if(iconKey!==entry.iconKey){entry.marker.setIcon(markerIcon(v));entry.iconKey=iconKey;}
      if(entry.target.lat!==target.lat||entry.target.lon!==target.lon || entry.target.path!==target.path){
        if(v.kind==='bus')updateBusMotion(key,entry,target,v);
        else animateTo(key,entry,target);
        entry.target=target;
      }
    }
    entry.feedTimestamp=v.timestamp;
    // Fahrzeug-Trajektur aufzeichnen (letzte 30 Positionen pro Fahrzeug)
    const trk=state.vehicleTracks.get(key);
    const last=trk&&trk.points.length?trk.points[trk.points.length-1]:null;
    if(!last||Math.abs(last.lat-v.lat)>0.0001||Math.abs(last.lng-v.lng)>0.0001){
      addTrackPoint(key,v.lat,v.lng);
    }
    if(!motionDuration(v,null)){
      stopJob(key);state.busTracks.delete(key);entry.marker.setLatLng([v.lat,v.lon]);
    }
    if(v.kind==='bus' && v.stale && state.busTracks.has(key)){
      state.busTracks.delete(key);
      entry.marker.setLatLng([target.lat,target.lon]);
    }
    entry.marker.setOpacity(v.stale?.75:1);
  }
  state.performance.lastMarkerRefresh=Date.now();
  for(const [key,entry] of state.markers)if(!active.has(key)){
    stopJob(key);state.busTracks.delete(key);state.layer.removeLayer(entry.marker);state.markers.delete(key);
  }
  updateMapEmptyState();
}
function displayStats(){
  const keys=state.fusion?.keys||selectRepresentatives(state.vehicles.values(),state.selectedKey).keys;
  const all=[...state.vehicles.values()].filter(v=>keys.has(v.key));
  $('countAll').textContent=all.length;$('countTrains').textContent=all.filter(v=>v.kind==='train').length;
  $('countBuses').textContent=all.filter(v=>v.kind==='bus').length;
  const staleCount=all.filter(v=>v.stale || (v.timestamp && Date.now()/1000-v.timestamp>300)).length;
  const localeDate=getLocale()==='it'?'it-IT':'de-IT';
  $('lastUpdate').textContent=state.fetchedAt?t('time.lastUpdate')+' '+new Date(state.fetchedAt).toLocaleString(localeDate,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})+(staleCount?' · '+staleCount+' '+t('status.notLive'):''):t('time.noData');
}
async function refreshFeeds(){
  if(state.busy)return;
  state.busy=true;$('statusText').textContent=t('status.loading');
  try{
    const results=await Promise.allSettled(ENDPOINTS.map(name=>fetchJson('/api/'+name,16000)));
    const {ok, oldFeeds, statuses}=buildFeedStatus(results, ENDPOINTS);
    state.statuses=statuses;
    for(const [name, feed] of Object.entries(ok)){
      state.lastSuccess[name]=Date.now();
    }
    for(const name of ENDPOINTS){
      if(statuses[name]!=='ok' && statuses[name]!=='old'){
        console.warn('Feed unavailable or outdated',name,statuses[name]);
      }
    }
    const now=Date.now();state.fetchedAt=now;
    for(const source of POSITION_SOURCES){
      if(!ok[source] && !oldFeeds[source])continue;
      // Old upstream data is last-known context, never live GPS or moving animation.
      const staleFeed=!ok[source];
      const {parsed, latest}=processPositionFeed(source, ok[source]||oldFeeds[source], now, state.indexes, gtfsLocalDate());
      state.counts[source]=parsed;
      mergePositionVehicles(state.vehicles, latest, source, now, staleFeed);
    }
    pruneStaleVehicles(state.vehicles, now, state.statuses);
    processUpdates(ok, state, now);
    // Alerts verarbeiten (gelöschte Alert-IDs werden ausgefiltert)
    for(const source of ALERT_SOURCES){
      if(!ok[source])continue;
      const parsed=parseAlerts(ok[source],source,now);
      state.alerts[source]=parsed.filter(a=>!state.dismissedAlerts.has(a.id));
    }
    // Alte Alerts entfernen wenn Feed nicht mehr antwortet
    for(const s of Object.keys(state.alerts))if(!ok[s])delete state.alerts[s];
    state.failCount=ENDPOINTS.filter(s=>state.statuses[s]!=='ok').length;
    statusLabel();updateFeedHealthBanner();updateFavPanel();updateAlertTicker();refreshMarkers();state.diagnostics=feedDiagnostics(state.vehicles.values(),state.statuses,Date.now(),state.fusion);displayStats();refreshScheduleMatches();
    // Bus-shape fetching happens after the live updates; do not delay feed painting.
    loadBusShapesForVehicles().catch(e=>console.info('Bus shape preload:',e));
    if(!initiallyLocated && state.vehicles.size && state.map){
      initiallyLocated=true;
      // On the first successful update, find real positions if the default viewport is empty.
      // Do not reposition the map again or override user navigation.
      if(mapMetrics().inside===0){fitMap();}
    }
    updateViewportBadge();
    document.dispatchEvent(new Event('sr40:feeds'));
    if(state.selectedKey && state.activeSheet==='vehicle'){
      if(state.vehicles.has(state.selectedKey))drawVehicleDetails(state.selectedKey,false);
      else {closeSheets();setNotice('<strong>Fahrzeug verschwunden:</strong> Dieser Zug oder Bus wird nicht mehr im aktuellen Positionsfeed gemeldet. Es wird keine Position erfunden.');}
    }
    document.dispatchEvent(new Event('sr37:feeds'));
  }catch(e){
    console.error('Unexpected refresh error',e);
    $('statusText').textContent=t('status.error');$('statusBtn').classList.add('error');
  }finally{state.busy=false;updateMapEmptyState();}
}
function setFilter(which){state.filter=which;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===which));refreshMarkers();refreshScheduleMatches();updateViewportBadge();}
function openSheet(which){
  closeSheets(false);
  state.activeSheet=which;
  const id=which==='station'?'stationSheet':'sheet';
  const sheet=$(id);
  const scroller=sheet.querySelector('.sheet-scroll');
  if(scroller)scroller.scrollTop=0;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  document.dispatchEvent(new Event('sr37:sheet-opened'));
  // 9.5: Der Fokus wandert in das Panel und kommt beim Schliessen zurueck.
  try{sheet.focus({preventScroll:true})}catch{}
  $('scrim').classList.add('show');
}
function closeSheets(resetSelection=true){
  if(resetSelection)selectionRenderToken++;
  // 10.0.6: The vehicle sheet's own X must close the cinematic map too.
  // Do this synchronously here instead of relying only on the later sheet event.
  try{window.SuedtirolRadar71?.close3D?.()}catch(error){console.info('3D close during sheet dismissal',error)}
  document.getElementById('sr83Viewport')?.remove();
  document.querySelectorAll('#map .sr83-viewport').forEach(node=>node.remove());
  document.body.classList.remove('sr83-cinematic');
  for(const id of ['sheet','stationSheet']){$(id).classList.remove('open');$(id).setAttribute('aria-hidden','true');}
  // 9.5: Der Fokus geht zurueck auf die Karte.
  try{$('map')?.focus({preventScroll:true})}catch{}
  $('scrim').classList.remove('show');state.activeSheet=null;
  if(resetSelection){state.selectedKey=null;refreshMarkers();}
  state.trackLayer.clearLayers();
  document.dispatchEvent(new Event('sr37:sheet-closed'));
}
function badge(text,style=''){const el=document.createElement('span');el.className='mini-badge '+style;el.textContent=text;return el;}
function displayField(value,fallback='Nicht verfügbar'){const text=value==null?'':String(value).trim();return !text||/^(?:[-–—]+|n\/?a|null|undefined)$/i.test(text)?fallback:text;}
function detailElement(name,value,cls=''){const el=document.createElement('div');el.className='detail'+(cls?' '+cls:'');const small=document.createElement('small');small.textContent=name;const strong=document.createElement('strong');strong.textContent=displayField(value);el.append(small,strong);return el;}
function detail(name,value,cls=''){$('details').append(detailElement(name,value,cls));}
function technicalDetails({tripId='',vehicleId=''}={}){const box=document.createElement('details');box.className='technical-details';const summary=document.createElement('summary');summary.textContent='Technische Details';box.append(summary);if(vehicleId)box.append(detailElement('Fahrzeug-ID',vehicleId));if(tripId)box.append(detailElement('Fahrt-ID',tripId));if(box.childElementCount>1)$('details').append(box);}
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
  $('modelCaption').textContent=(model.confidence==='confirmed'?t('detail.trainType.confirmed'):t('detail.trainType.planned'))+' · '+model.source+' · '+t('detail.modelCard');
  img.onerror=()=>{card.hidden=true;img.removeAttribute('src')};
  img.src=model.image;card.hidden=false;
}
function drawVehicleDetails(key,fetchSchedule){
  const v=state.vehicles.get(key);if(!v)return;
  $('sheetKind').textContent=v.kind==='train'?'Zugdetails':'Busdetails';
  $('sheetTitle').textContent=(v.kind==='train'?'🚆 ':'🚌 ')+displayField(v.name,v.kind==='train'?'Zugnummer nicht verfügbar':'Linie nicht verfügbar');
  $('sheetSub').textContent=formatStationName(displayField(v.headsign,'Ziel nicht verfügbar'));
  const badges=$('sheetBadges');badges.replaceChildren();
  badges.append(badge(v.kind==='train'?'Zug':'Bus'));
  badges.append(badge(v.stale?'Letzte bekannte Position':'Aktueller Feed',v.stale?'warn':'ok'));
  const estimatedPosition=/simuliert|geschätzt|interpoliert|berechnet/i.test(v.positionType||'');
  badges.append(badge(estimatedPosition?'Geschätzte Position':'Feedposition · GPS nicht bestätigt',estimatedPosition?'sr86-position-estimated':'sr86-position-feed'));
  if(v.kind==='bus') badges.append(badge(v.lineVerified?'GTFS-Linie geprüft':'Linie unbekannt',v.lineVerified?'ok':'warn'));
  const favBtn=document.createElement('button');
  favBtn.className='badge fav-badge';
  favBtn.textContent=isFavorite(v.key)?'★ Favorit':'☆ Favorit';
  favBtn.title=isFavorite(v.key)?'Aus Favoriten entfernen':'Zu Favoriten hinzufügen';
  favBtn.onclick=()=>{toggleFavorite(v.key);favBtn.textContent=isFavorite(v.key)?t('fav.btnRemove'):t('fav.btnAdd');favBtn.title=isFavorite(v.key)?t('fav.btnRemove'):t('fav.btnAdd');refreshMarkers();statusLabel();};
  badges.append(favBtn);
  renderModel(v);
  $('details').replaceChildren();
  detail('Zug / Linie',v.name);
  const update=state.updates.get(v.source+':'+v.tripId);
  const cancelled=/^(?:CANCELED|CANCELLED|3)$/i.test(update?.scheduleRelationship||'');
  detail('Status',cancelled?'Fahrt entfällt':update?'Echtzeitdaten vorhanden':'Keine Echtzeitdaten zur Fahrt');
  const info=currentVehicleDelay(v);
  // Fehlende Verspätungsdaten bleiben ausdrücklich unbekannt.
  const delayView=delayPresentation(info?.delay??null);
  const delayCls=delayView.className;
  const delayText=cancelled?'Entfällt':info?delayView.label:'Unbekannt';
  detail('Gemeldete Verspätung',delayText+(info?(info.basis==='fahrt'?' · ganze Fahrt':/^(STOPPED_AT|1)$/i.test(v.currentStatus)?' · am Halt':' · nächster Halt'):''),delayCls);
   detail('Fahrtziel',formatStationName(v.headsign));
  if(v.plannedComposition?.confidence==='planned'){
    detail('Geplantes Rollmaterial 2026',v.plannedComposition.type+' · '+v.plannedComposition.composition);
    detail('Hinweis Rollmaterial','Fahrplanangabe – tatsächlicher Fahrzeugeinsatz kann abweichen');
  }
  // Zwei getrennte Werte: die gemeldete Verspaetung und die Abweichung vom Fahrplan.
  // Die eine ist eine Zeitangabe, die andere eine Ortsangabe.
  detail('Geschwindigkeit',v.speed===null?'Unbekannt':v.speed+' km/h (gemeldet)');
  const quality=observationQuality(v,Date.now());
  detail('Datenstand',quality.status==='aktuell'?'Aktuell':quality.status==='verzögert'?'Verzögert':'Unbekannt',quality.status==='aktuell'?'delay-ok':quality.status==='verzögert'?'delay-warn':'delay-severe');
   technicalDetails({tripId:v.tripId,vehicleId:v.vehicleId});
  const lineKey=v.routeId?(v.source+':'+v.routeId):'';
  if(lineKey){
    const favBtn=document.createElement('button');
    favBtn.className='badge line-fav-badge';
    favBtn.textContent=isLineFavorite(lineKey)?'★ Linie favorisiert':'☆ Linie favorisieren';
    favBtn.title=isLineFavorite(lineKey)?'Linie aus Favoriten entfernen':'Linie zu Favoriten hinzufügen';
    favBtn.onclick=()=>{toggleLineFavorite(lineKey);favBtn.textContent=isLineFavorite(lineKey)?t('fav.lineBtnRemove'):t('fav.lineBtnAdd');favBtn.title=isLineFavorite(lineKey)?t('fav.lineBtnRemove'):t('fav.lineBtnAdd');refreshMarkers();statusLabel();};
    badges.append(favBtn);
  }
  // Gleiche Linie: andere Fahrzeuge derselben Route anzeigen
  const lineVehicles=[...state.vehicles.values()].filter(v2=>v2.key!==key&&v2.routeId===v.routeId&&v2.source===v.source&&visible(v2));
  if(lineVehicles.length){
    const sec=document.createElement('div');sec.className='detail-section';
    sec.append(E('strong','Gleiche Linie ('+lineVehicles.length+')'));
    const list=E('div','line-vehicles');
    for(const lv of lineVehicles.slice(0,8)){
      const btn=B('badge line-item',lv.name,()=>{selectVehicle(lv.key);});
      btn.title=lv.headsign||'Ziel unbekannt';
      const delay=currentVehicleDelay(lv);
      const delayView=delayPresentation(delay?.delay??null);
      btn.append(E('small',(delay?delayView.label:'Keine Daten')+(delay?.basis==='fahrt'?' · Fahrt':''),delayView.className));
      list.append(btn);
    }
    sec.append(list);
    $('details').append(sec);
  }
   $('sheetNote').textContent='';$('sheetNote').hidden=true;
  if(fetchSchedule)loadSchedule(key);
  else if(state.details[v.source])renderStops(v,state.details[v.source]);
}
function renderStops(v,details){
 const rawRows=stopRows(details,v.tripId),seenRows=new Set();
 const rows=rawRows.filter(row=>{
   const stopId=txt(row.stopId),seq=Number(row.seq);
   const key=stopId+'|'+(Number.isFinite(seq)?seq:txt(row.arrival)+'|'+txt(row.departure));
   if(!stopId)return true;
   if(seenRows.has(key))return false;
   seenRows.add(key);return true;
 });
  const section=$('scheduleSection'),list=$('stops'),empty=$('emptySchedule');
  list.replaceChildren();section.hidden=!rows.length;empty.hidden=true;
  if(!rows.length)return;
  // STA direct positions share the official STA trip-update feed and detail tables.
  const updateSource=v.source==='sta_direct'?'sta':v.source;
  const update=state.updates.get(updateSource+':'+v.tripId);
  $('scheduleSource').textContent=t('board.source')+(update?.stops?.length?t('board.tripUpdate'):'');
  const lookup=new Map((update?.stops||[]).map(u=>[txt(u.stopId??u.stop_id).toLowerCase(),u]));
  const sameDay=!update?.tripStartDate||txt(update.tripStartDate).replaceAll('-','')===gtfsLocalDate().replaceAll('-','');
  const updateStatus=state.statuses[updateSource+'_updates'];
  const platformLive=Boolean(update&&sameDay&&updateStatus==='ok'&&Number.isFinite(Number(update.fetchedAt))&&Date.now()-Number(update.fetchedAt)<=120000&&Date.now()>=Number(update.fetchedAt)-30000);
  for(const row of rows){
    const li=document.createElement('li');li.className='stop';
    const left=document.createElement('div');const name=document.createElement('b');name.textContent=formatStationName(row.name);left.append(name);
    const upd=lookup.get(txt(row.stopId).toLowerCase())||(update?.stops||[]).find(u=>Number(u.stopSequence??u.stop_sequence)===Number(row.seq)&&Number(row.seq)>0);
    const timing=details.times?.[v.tripId]?.find(t=>String(t[0])===String(row.stopId))||details.times?.[v.tripId]?.find(t=>Number(t[3])===Number(row.seq)&&Number(row.seq)>0);
    const platform=platformInfo(details.stops?.[row.stopId],platformLive?upd:null,details.stops);
    const track=document.createElement('small');track.className='stop-platform';track.hidden=true;
    const hasPlatform=hasKnownPlatform(platform.current);
    if(hasPlatform){track.hidden=false;track.textContent=(v.kind==='bus'?'Steig ':'Gleis ')+String(platform.current)+(platform.changed?' · geändert':platform.live?' · gemeldet':' · Plan');}
    if(platform.changed)track.style.color='#ffc37d';
    left.append(track);
    if(v.kind==='train'){
      enrichTrainPlatform(track,{number:state.indexes[v.source]?.trips?.[v.tripId]?.[3]||v.name,serviceDay:v.tripStartDate||gtfsLocalDate(),source:v.source,stopId:row.stopId,stopName:formatStationName(row.name),arrival:timing?.[1],departure:timing?.[2],terminal:Boolean(timing&&timing===details.times?.[v.tripId]?.at(-1))},platform);
    }
    const useDeparture=row.departure!=='–';
    const event=useDeparture?(upd?.departure||upd?.arrival):(upd?.arrival||upd?.departure);
    const plannedClock=useDeparture?row.departure:row.arrival;
    const clockMatch=String(plannedClock||'').match(/^(\d{1,2}):(\d{2})(?: \+(\d+))?$/);
    const plannedSeconds=clockMatch?(Number(clockMatch[1])*3600+Number(clockMatch[2])*60+Number(clockMatch[3]||0)*86400):null;
    const skipped=/^(?:SKIPPED|1)$/i.test(txt(upd?.scheduleRelationship??upd?.schedule_relationship));
    const liveTime=platformLive&&!skipped&&event?expectedStopTime(plannedSeconds,event):null;
    const info=document.createElement('small');
    info.textContent=skipped?'Laut Echtzeitmeldung ausgelassen':liveTime?'IST · Echtzeit': platformLive?'IST · keine Haltemeldung':'IST · nicht verfügbar';
    left.append(info);
    const time=document.createElement('div');time.className='stop-time';
    const expected=document.createElement('strong');expected.className='stop-actual-time';
    expected.textContent=skipped?'Ausgelassen':liveTime||'—';
    const planned=document.createElement('small');planned.className='stop-plan-time';
    planned.textContent='SOLL '+(useDeparture?row.departure:row.arrival);
    if(liveTime&&liveTime!==planned.textContent.slice(5))planned.classList.add('is-shifted');
    time.append(expected,planned);li.append(left,time);list.append(li);
  }
}
async function loadSchedule(key){
  const v=state.vehicles.get(key);if(!v)return;
  $('scheduleSection').hidden=true;$('emptySchedule').hidden=true;
  const details=await loadDetails(v.source);
  if(state.selectedKey!==key||state.activeSheet!=='vehicle')return;
  if(details)renderStops(v,details);
  else $('emptySchedule').textContent=t('station.noStops');
}
function selectVehicle(key){
  if(!state.vehicles.has(key))return;
  if(window.SuedtirolRadar71?.enabled&&!document.hidden)document.body.classList.add('sr71-focusing');
  // Klick auf bereits ausgewähltes Fahrzeug schließt das Panel (Toggle).
  if(state.selectedKey===key&&state.activeSheet==='vehicle'){closeSheets();return;}
  selectionRenderToken++;
  state.selectedKey=key;
  document.dispatchEvent(new Event('sr40:selection'));
  $('scheduleMatches').hidden=true;openSheet('vehicle');refreshMarkers();drawVehicleDetails(key,true);drawVehicleTrack(key);
  document.dispatchEvent(new Event('sr37:selection'));
}
function drawVehicleTrack(key){
  state.trackLayer.clearLayers();
  const pts=getTrackPoints(key);
  if(!pts||pts.length<2)return;
  const latlngs=pts.map(p=>[p.lat,p.lng]);
  L.polyline(latlngs,{className:'sr-track-line',color:'#ff3b30',weight:3,opacity:0.8}).addTo(state.trackLayer);
  const first=pts[0],last=pts[pts.length-1];
  L.circleMarker([first.lat,first.lng],{radius:6,fillColor:'#ff3b30',color:'#ffffff',weight:2,fillOpacity:0.8}).addTo(state.trackLayer);
  L.circleMarker([last.lat,last.lng],{radius:8,fillColor:'#ff3b30',color:'#ffffff',weight:2,fillOpacity:0.9}).addTo(state.trackLayer);
}
function fitMap(){
  const locations=[...state.markers.values()].map(e=>e.marker.getLatLng());
  if(locations.length>1)state.map.fitBounds(L.latLngBounds(locations),{paddingTopLeft:[35,158],paddingBottomRight:[35,125],maxZoom:11});
  else if(locations.length===1)state.map.setView(locations[0],12);
  else state.map.setView([46.64,11.35],9);
  updateViewportBadge();
}
async function getStationList(){
  if(state.stationList.length)return state.stationList;
  await Promise.all(SOURCES.map(s=>loadDetails(s)));
  const all=[];
  for(const s of SOURCES){for(const [stopId,record] of Object.entries(state.details[s]?.stops||{})){
    if(!record[0])continue;
    const lat=Number(record[1]),lon=Number(record[2]);
    if(lat<BBOX.south||lat>BBOX.north||lon<BBOX.west||lon>BBOX.east)continue;
    all.push({source:s,stopId,name:record[0],lat,lon});
  }}
  state.stationList=all;
  return all;
}
async function showStations(){
  openSheet('station');$('stationSearchWrap').hidden=false;$('stationBoard').hidden=true;$('stationResults').hidden=false;
  $('stationResults').textContent=t('station.loadingStops');
  await getStationList();
  if(state.activeSheet!=='station')return;
  renderStationResults();
}
async function openStationFromMap(st){
  await showStations();
  if(state.activeSheet==='station')showStationBoard(st);
}
function renderStationResults(){
  const q=$('stationSearch').value.toLocaleLowerCase('de').trim(),list=$('stationResults');list.replaceChildren();
  const matches=state.stationList.filter(st=>!q||st.name.toLocaleLowerCase('de').includes(q)).slice(0,40);
  if(!state.stationList.length){list.textContent=t('station.noStations');return;}
  for(const st of matches){const btn=document.createElement('button');btn.className='station-result';
    const body=document.createElement('div');const strong=document.createElement('strong');strong.textContent=st.name;
    const small=document.createElement('small');small.textContent=sourceLabel(st.source);body.append(strong,small);
    const chevron=document.createElement('span');chevron.textContent='›';btn.append(body,chevron);
    btn.onclick=()=>showStationBoard(st);list.append(btn);
  }
  if(!matches.length)list.textContent=t('station.noMatch');
}
function italySeconds(){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(o.hour)*3600+Number(o.minute)*60+Number(o.second);
}
function showStationBoard(st){
  state.stationChoice=st;$('stationSearchWrap').hidden=true;$('stationResults').hidden=true;$('stationBoard').hidden=false;
  document.dispatchEvent(new CustomEvent('sr75:station-selected',{detail:{stopId:st.stopId,name:st.name}}));
  const scroller=$('stationSheet').querySelector('.sheet-scroll');if(scroller)scroller.scrollTop=0;
  $('stationName').textContent=t('station.boardTitle')+st.name;
  const list=$('stationDepartures');list.replaceChildren();
  const details=state.details[st.source],db=state.indexes[st.source];
  const now=italySeconds(), departures=[];
  const normStopId=normalizeStopId(st.stopId);
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
    const upd=state.updates.get(st.source+':'+d.tripId);
    const live=isLiveUpdate(upd)&&state.statuses[st.source+'_updates']==='ok';
    const delay=live?departureDelay(upd,st.stopId):null;
    // Plattform/Gleis aus GTFS-RT auslesen
    let platform=null;
    if(upd&&Array.isArray(upd.stops)){
      const row=upd.stops.find(s=>normalizeStopId(s.stopId??s.stop_id)===normStopId);
      if(row){
        platform=row.departure?.platform??row.arrival?.platform??row.departure?.platform_code??row.arrival?.platform_code;
      }
    }
    title.textContent=d.name+' · '+d.headsign;
    const depText=delay===null?(live?'Live, keine Verspätung':'Geplant'):(delay>0?'Live · +'+Math.round(delay/60)+' Min.':'Live · '+Math.round(delay/60)+' Min. früher')+' · '+sourceLabel(st.source);
    sub.textContent=depText;
    if(platform){
      const chip=document.createElement('span');
      chip.className='platform-chip'+(live?' live':' plan');
      chip.textContent=platform;
      sub.appendChild(document.createTextNode(' · '));
      sub.appendChild(chip);
    }
    sub.classList.toggle('sr-dep-live',live);
    sub.classList.toggle('dep-delay-severe',live&&Math.round(delay/60)>=15);
    sub.classList.toggle('dep-delay-warn',live&&Math.round(delay/60)>=1&&Math.round(delay/60)<15);
    clock.textContent=formatClock(d.sec);
    body.append(title,sub);btn.append(body,clock);list.append(btn);
  }
  if(!departures.length)list.textContent=t('board.noDepartures');
  if(state.map&&Number.isFinite(st.lat)&&Number.isFinite(st.lon))state.map.panTo([st.lat,st.lon]);
  document.dispatchEvent(new CustomEvent('sr37:station-board',{detail:{source:st.source,stopId:st.stopId}}));
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
  const title=document.createElement('h3');title.textContent=t('journey.noPosition');panel.append(title);
  for(const [tripId,trip] of entries){
    const btn=document.createElement('button');const left=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=t('journey.train')+digits;
    const small=document.createElement('small');small.textContent=trip[1]||t('journey.noDestination');
    const icon=document.createElement('span');icon.textContent='→';left.append(strong,small);btn.append(left,icon);
    btn.onclick=()=>selectScheduledTrain(tripId);panel.append(btn);
  }
  panel.hidden=false;
}
async function selectScheduledTrain(tripId){
  const trip=state.indexes.trains?.trips?.[tripId];if(!trip)return;
  $('scheduleMatches').hidden=true;state.selectedKey=null;
  openSheet('vehicle');
  const selectionToken=++selectionRenderToken;
  $('sheetKind').textContent=t('journey.noPositionTitle');
  $('sheetTitle').textContent='🚆 '+gtfsNumber('',trip[3]);
  $('sheetSub').textContent=trip[1]||t('journey.noDestination2');
  $('sheetBadges').replaceChildren(badge('Nur GTFS-Fahrplan','warn'));
  $('modelCard').hidden=true;$('details').replaceChildren();
  detail('Position','Im Echtzeitfeed nicht gefunden');technicalDetails({tripId});
  detail('Zugnummer',gtfsNumber('',trip[3]));detail('Verspätung','Nicht überprüft');
  $('sheetNote').textContent=t('journey.noPositionNote');
  $('scheduleSection').hidden=true;$('emptySchedule').hidden=true;
  const details=await loadDetails('trains');
  if(selectionToken===selectionRenderToken&&state.activeSheet==='vehicle'&&state.selectedKey===null){
    if(details)renderStops({source:'trains',tripId},details);
    else $('emptySchedule').textContent=t('journey.noSchedule');
  }
}
// Safari: keep swipes inside the detail panel, without blocking real scrolling.
function setupSheetTouchGuards(){
  for(const sheet of document.querySelectorAll('.sheet')){
    const scroller=sheet.querySelector('.sheet-scroll');
    if(!scroller)continue;
    const handle=sheet.querySelector('.handle');
    if(handle){
      let drag=null;
      handle.style.touchAction='none';
      handle.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0)return;
        if(!sheet.classList.contains('open'))return;
        drag={id:event.pointerId,startY:event.clientY};
        try{handle.setPointerCapture(event.pointerId)}catch{}
        sheet.style.transition='none';
      });
      handle.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const delta=Math.max(0,event.clientY-drag.startY);
        sheet.style.transform=`translate3d(0,${delta}px,0)`;
      });
      const finishDrag=event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const delta=event.clientY-drag.startY;drag=null;
        sheet.style.transition='';sheet.style.transform='';
        if(delta>78)closeSheets();
      };
      handle.addEventListener('pointerup',finishDrag);
      handle.addEventListener('pointercancel',event=>{if(drag){drag=null;sheet.style.transition='';sheet.style.transform=''}});
    }
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
function offlineState(online=navigator.onLine!==false){
  const banner=$('offlineBanner');
  if(banner)banner.hidden=online;
  document.body.classList.toggle('sr-offline',!online);
  return !online;
}
function firstSearchHit(){
  const q=state.query.trim().toLocaleLowerCase('de');
  if(!q)return null;
  for(const v of state.vehicles.values()){
    if(!visible(v))continue;
    const hay=`${v.name} ${v.headsign} ${v.vehicleId} ${v.tripId} ${v.routeLongName}`.toLocaleLowerCase('de');
    if(hay.includes(q))return v;
  }
  return null;
}
function jumpToFirstHit(){
  const v=firstSearchHit();
  if(!v)return false;
  selectVehicle(v.key);
  const marker=state.markers.get(v.key)?.marker;
  const p=marker?.getLatLng();
  if(p&&state.map)state.map.setView([p.lat,p.lng],Math.max(state.map.getZoom(),14),{animate:true});
  return true;
}
function renderSearchResults(){
  const list=$('searchResults');
  const q=state.query.trim().toLocaleLowerCase('de');
  list.replaceChildren();
  if(!q||q.length<2){list.hidden=true;return;}
  const hits=[];
  for(const v of state.vehicles.values()){
    if(!visible(v))continue;
    const hay=`${v.name} ${v.headsign} ${v.vehicleId} ${v.tripId} ${v.routeLongName}`.toLocaleLowerCase('de');
    if(hay.includes(q))hits.push(v);
  }
  if(!hits.length){
    list.hidden=false;
    const empty=document.createElement('div');
    empty.className='search-hit';
    empty.style.cursor='default';
    empty.style.opacity='.6';
    empty.innerHTML='<span style="color:var(--radar84-muted)">Keine Fahrzeuge gefunden</span>';
    list.append(empty);
    return;
  }
  for(const v of hits.slice(0,10)){
    const btn=document.createElement('button');btn.className='search-hit';
    const left=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=v.name;left.append(strong);
    const small=document.createElement('small');small.textContent=v.headsign||t('detail.trainLineUnverified');left.append(small);
    const kind=document.createElement('span');kind.className='kind';kind.textContent=v.kind==='train'?t('search.train'):t('search.bus');btn.append(left,kind);
    btn.onclick=()=>{selectVehicle(v.key);list.hidden=true;};
    list.append(btn);
  }
  list.hidden=false;
}
function applyTranslations(){
  document.querySelectorAll('[data-t]').forEach(el=>{
    const key=el.getAttribute('data-t');
    if(key)el.textContent=t(key);
  });
  // Platzhalter-Attribute
  document.querySelectorAll('[data-t-placeholder]').forEach(el=>{
    const key=el.getAttribute('data-t-placeholder');
    if(key)el.placeholder=t(key);
  });
  document.querySelectorAll('[data-t-title]').forEach(el=>{
    const key=el.getAttribute('data-t-title');
    if(key)el.title=t(key);
  });
  document.querySelectorAll('[data-t-aria-label]').forEach(el=>{
    const key=el.getAttribute('data-t-aria-label');
    if(key)el.setAttribute('aria-label',t(key));
  });
}
function setupNearbyStations(){
  const host=$('sr50MapTab');if(!host||$('sr86LocationBtn'))return;
  const button=document.createElement('button');button.id='sr86LocationBtn';button.type='button';
  button.className='sr86-location-btn';button.textContent='◎';button.title='Standort und nahe Haltestellen';
  button.setAttribute('aria-label','Meinen Standort und nahe Haltestellen anzeigen');
  const panel=document.createElement('section');panel.id='sr86NearbyPanel';panel.className='sr86-nearby-panel';panel.hidden=true;
  panel.setAttribute('aria-live','polite');
  const heading=document.createElement('div');heading.className='sr86-nearby-heading';
  const title=document.createElement('strong');title.textContent='Haltestellen in der Nähe';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Schließen');close.style.minWidth='44px';close.style.minHeight='44px';
  close.onclick=()=>{panel.hidden=true;};heading.append(title,close);
  const list=document.createElement('div');list.className='sr86-nearby-list';panel.append(heading,list);
  host.append(button,panel);
  let locationLayer=null;
  const distance=(a,b)=>{const factor=Math.PI/180,R=6371000,dLat=(b.lat-a.lat)*factor,dLon=(b.lon-a.lon)*factor,latA=a.lat*factor,latB=b.lat*factor;const q=Math.sin(dLat/2)**2+Math.cos(latA)*Math.cos(latB)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
  const clock=seconds=>String(Math.floor(seconds/3600)%24).padStart(2,'0')+':'+String(Math.floor(seconds%3600/60)).padStart(2,'0')+(seconds>=86400?' +1':'');
  button.addEventListener('click',()=>{
    if(!navigator.geolocation){panel.hidden=false;list.textContent='Standort wird von diesem Gerät nicht unterstützt.';return;}
    button.disabled=true;button.textContent='…';panel.hidden=false;list.textContent='Standort wird ermittelt …';
    navigator.geolocation.getCurrentPosition(async pos=>{
      const here={lat:pos.coords.latitude,lon:pos.coords.longitude};
      const map=state.map;if(!map){list.textContent='Karte ist noch nicht bereit.';button.disabled=false;button.textContent='◎';return;}
      if(locationLayer)locationLayer.remove();
      locationLayer=L.layerGroup().addTo(map);
      L.circle([here.lat,here.lon],{radius:Math.max(20,Math.min(pos.coords.accuracy||40,250)),color:'#dce4ed',weight:1,fillColor:'#9fb8d3',fillOpacity:.13}).addTo(locationLayer);
      L.circleMarker([here.lat,here.lon],{radius:7,color:'#fff',weight:2,fillColor:'#4d9cff',fillOpacity:1}).addTo(locationLayer);
      map.setView([here.lat,here.lon],Math.max(map.getZoom(),14),{animate:true});
      list.textContent='Haltestellen und Abfahrten werden geladen …';
      try{
        const stops=await getStationList();
        const nearest=stops.map(st=>({...st,distance:distance(here,st)})).filter(st=>Number.isFinite(st.distance)).sort((a,b)=>a.distance-b.distance);
        const groups=groupNearbyStops(nearest).slice(0,4);
        list.replaceChildren();
        if(!groups.length){list.textContent='Keine Haltestellen in den geladenen Fahrplandaten gefunden.';}
        const now=romeSeconds(),duplicateCounts=new Map();
        for(const group of groups){const key=formatStationName(group.station.name).toLocaleLowerCase('de');duplicateCounts.set(key,(duplicateCounts.get(key)||0)+1);}
        for(const group of groups){
          const card=document.createElement('div');card.className='sr86-nearby-stop';
          const stateNow=state;
          const result=buildDepartureRows(group.members,stateNow.indexes,stateNow.details,stateNow.updates,stateNow.statuses,{now:new Date()});
          const departures=nextNearbyDepartures(mergeStationDepartures(result.rows),now,3);
          const destinations=[...new Set(departures.map(d=>formatStationName(d.headsign)).filter(n=>n&&n!=='Ziel unbekannt'))].slice(0,2);
          const name=document.createElement('button');name.type='button';name.className='sr86-nearby-open';
          name.textContent=formatStationName(group.station.name)+(duplicateCounts.get(formatStationName(group.station.name).toLocaleLowerCase('de'))>1?' · '+(destinations.length?'Richtung '+destinations.join(' / '):'Richtung unbekannt'):'');
          name.onclick=()=>openStationFromMap(group.station);
          const meta=document.createElement('small');
          const sources=[...new Set(group.members.map(st=>sourceLabel(st.source)))];
          meta.textContent=(group.distance<1000?Math.round(group.distance)+' m':(group.distance/1000).toFixed(1)+' km')+' · '+sources.join(' / ')+(group.members.length>1?' · '+group.members.length+' Haltestellen-Datensätze':'');
          card.append(name,meta);
          if(departures.length){
            const departureList=document.createElement('div');departureList.className='sr86-nearby-departures';
            for(const dep of departures){
              const item=document.createElement('div');item.className='sr86-nearby-departure';
              const main=document.createElement('span');main.className='sr86-nearby-departure-main';
              const line=document.createElement('strong');line.textContent=(dep.number|| (dep.kind==='train'?'Zug':'Bus'))+' → '+formatStationName(dep.headsign);
              const detail=document.createElement('small');detail.textContent=(dep.cancelled?'Ausfall':dep.minutes===0?'jetzt': 'in '+dep.minutes+' Min.')+' · '+(dep.live?'Echtzeit':'Fahrplan')+(hasKnownPlatform(dep.platform?.current)?' · '+(dep.kind==='train'?'Gleis ':'Steig ')+dep.platform.current:'');
              main.append(line,detail);item.append(main);departureList.append(item);
            }
            card.append(departureList);
          }else card.append(Object.assign(document.createElement('small'),{className:'sr86-nearby-empty',textContent:'Keine passenden Abfahrten in den nächsten 4 Stunden.'}));
          list.append(card);
        }
      }catch(error){console.warn('Nearby stations unavailable',error);list.textContent='Haltestellen und Abfahrten konnten gerade nicht geladen werden.';}
      button.disabled=false;button.textContent='◎';
    },err=>{
      list.textContent=err.code===1?'Standortzugriff abgelehnt. Du kannst ihn in den iPhone-Einstellungen erlauben.':'Standort gerade nicht verfügbar. Bitte erneut versuchen.';
      button.disabled=false;button.textContent='◎';
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  });
}
function setupControls(){
  setupSheetTouchGuards();
  setupNearbyStations();
  offlineState();
  window.addEventListener('offline',()=>offlineState(false));
  window.addEventListener('online',()=>offlineState(true));
  for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>setFilter(b.dataset.filter));
  let debounce=0;
  $('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToFirstHit()}});
  $('search').oninput=e=>{clearTimeout(debounce);debounce=setTimeout(()=>{state.query=e.target.value.toLocaleLowerCase('de').trim();refreshMarkers();refreshScheduleMatches();updateViewportBadge();renderSearchResults()},130)};
  $('statusBtn').onclick=()=>{
    const fav=[...state.favorites].filter(k=>state.vehicles.has(k));
    if(fav.length){selectVehicle(fav[0]);return;}
    showSourceStatus();
  };
  $('healthBtn').onclick=()=>{
    const panel=$('healthPanel');
    const hidden=panel.hidden;
    closeSheets();$('searchResults')?.classList.add('hidden');
    panel.hidden=!hidden;
    if(!hidden)updateHealthPanel();
  };
  $('closeHealth').onclick=()=>$('healthPanel').hidden=true;
  $('favBtnTop').onclick=()=>{
    const panel=$('favPanel');
    const hidden=panel.hidden;
    closeSheets();$('searchResults')?.classList.add('hidden');if($('healthPanel'))$('healthPanel').hidden=true;
    panel.hidden=!hidden;
    if(!hidden)updateFavPanel();
  };
  $('closeFav').onclick=()=>$('favPanel').hidden=true;
  $('langBtn').onclick=()=>{
    const next=getLocale()==='de'?'it':'de';
    setLocale(next);
    $('langText').textContent=next.toUpperCase();
    applyTranslations();
    updateHealthPanel();
    updateFavPanel();
    statusLabel();
    refreshMarkers();
  };
  $('linesBtn').onclick=()=>{
    const panel=$('linesPanel');
    const hidden=panel.hidden;
    closeSheets();$('searchResults')?.classList.add('hidden');if($('healthPanel'))$('healthPanel').hidden=true;if($('favPanel'))$('favPanel').hidden=true;
    panel.hidden=!hidden;
    if(!hidden)renderLinesPanel();
  };
  $('closeLines').onclick=()=>$('linesPanel').hidden=true;
  $('linesSearch').oninput=renderLinesPanel;
  document.querySelectorAll('.lines-filters .chip').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.lines-filters .chip').forEach(c=>c.classList.remove('active'));
    b.classList.add('active');
    renderLinesPanel();
  });
  $('refreshBtnFromBanner').onclick=()=>refreshFeeds();
  $('tileBtn').onclick=()=>switchTileProvider(1-tileProviderIndex,'Benutzerwahl');
  document.addEventListener('click',e=>{
    if(!e.target.closest('#search')&&!e.target.closest('#searchResults'))$('searchResults')?.classList.add('hidden');
    if($('healthPanel')&&!$('healthPanel').hidden)$('healthPanel').hidden=true;
    if($('favPanel')&&!$('favPanel').hidden)$('favPanel').hidden=true;
  });
  $('refreshBtn').onclick=()=>{
    if(Date.now()-state.fetchedAt>=manualRefreshDelayMs)refreshFeeds();
    // Recheck the viewport; only switch tile providers on user action or failures.
    if(tileErrorCount>0 && state.tiles && typeof state.tiles.redraw==='function'){
      state.tiles.redraw();
    }
    if(state.map && typeof state.map.invalidateSize==='function')state.map.invalidateSize({pan:false});
    updateViewportBadge();
  };
  $('themeToggle').onclick=()=>changeTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  $('noticeClose').onclick=()=> $('notice').hidden=true;
  $('closeSheet').onclick=()=>closeSheets();$('closeStations').onclick=()=>closeSheets();$('scrim').onclick=()=>closeSheets();
  $('fitBtn').onclick=fitMap;$('stationBtn').onclick=showStations;
  $('viewportBadge').onclick=fitMap;
  $('areaBtn').onclick=()=>{ $('areaPicker').hidden=!$('areaPicker').hidden; };
  for(const btn of document.querySelectorAll('[data-place]'))btn.onclick=()=>moveToPlace(btn.dataset.place);
  $('stationSearch').oninput=renderStationResults;$('backStations').onclick=()=>{$('stationBoard').hidden=true;$('stationSearchWrap').hidden=false;$('stationResults').hidden=false};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeSheets();$('healthPanel').hidden=true;$('favPanel').hidden=true;}
    // Tastatur-Shortcuts (nur außerhalb von Eingabefeldern):
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.key==='r'||e.key==='R'){e.preventDefault();refreshFeeds();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();fitMap();}
    if(e.key==='s'||e.key==='S'){e.preventDefault();showStations();}
    if(e.key==='?'){e.preventDefault();showSourceStatus();}
  });
  // Hinweis auf Tastatur-Shortcuts (einmalig beim Start)
  if(!localStorage.getItem('sr-shortcuts-hint')){
    const hint=document.createElement('div');
    hint.className='shortcut-hint';
    hint.textContent=t('shortcuts.hint');
    hint.style.cssText='position:fixed;bottom:10px;right:10px;padding:6px 10px;border-radius:8px;background:rgba(10,18,30,.85);color:#f3f7fc;font-size:11px;z-index:900;cursor:pointer';
    hint.onclick=()=>{hint.remove();localStorage.setItem('sr-shortcuts-hint','1');};
    document.body.append(hint);
    setTimeout(()=>hint.remove(),6000);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){for(const [key,job] of state.jobs){const e=state.markers.get(key);if(e)e.marker.setLatLng([job.to.lat,job.to.lon]);}state.jobs.clear();state.busTracks.clear();}
    else { if(Date.now()-state.fetchedAt>30000)refreshFeeds();if(state.map)state.map.invalidateSize({pan:false}); }
  });
}
function currentVehicleDelay(v){
  if(!v?.tripId || state.statuses[v.source+'_updates']!=='ok')return null;
  const update=state.updates.get(v.source+':'+v.tripId);
  if(!update || (v.tripStartDate && update.tripStartDate && v.tripStartDate!==update.tripStartDate) || Date.now()-update.fetchedAt>DETAIL_MAX_AGE)return null;
  return vehicleDelayInfo(update,v);
}
// Limited local bridge for the optional 3.7 interface. It does not change the GTFS source.
window.SuedtirolRadar37={state,showStations,showStationBoard,getStationList,openStationFromMap,setFilter,refreshMarkers,refreshScheduleMatches,
  verifiedRouteCount:()=>[...state.vehicles.values()].filter(v=>v.kind==='bus' && v.tripId && v.shapeId && mapTarget(v).path).length,
  routeOnlyCount:()=>[...state.vehicles.values()].filter(v=>v.kind==='bus' && !v.shapeId && v.routeShapeId && mapTarget(v).path).length,
  routeMatchFor:v=>mapTarget(v),vehicleDelay:currentVehicleDelay,qualityFor:v=>observationQuality(v),fusionInfo:()=>state.fusion,diagnostics:()=>state.diagnostics||feedDiagnostics(state.vehicles.values(),state.statuses)};
async function init(){
  bootPhase('start');
  try{changeTheme(localStorage.getItem('sr-theme')==='light'?'light':'dark')}catch{changeTheme('dark')}
  loadFavorites();
  loadLineFavorites();
  loadJourneyFavorites();
  loadDismissedAlerts();
  initLocale();
  applyTranslations();
  setupControls();
  if(!initMap()){bootPhase('map-error');return}
  bootPhase('map-ready');
  document.dispatchEvent(new Event('sr37:ready'));
  // These asynchronous jobs are deliberately independent. No fabricated
  // realtime positions: refreshFeeds still uses only actual source payloads.
  const feeds=refreshFeeds().catch(error=>console.error('Initial realtime fetch failed',error));
  const indexes=loadIndexes().catch(error=>console.warn('Timetable loading failed',error));
  const rail=loadRailShapes().catch(error=>console.info('Rail geometry unavailable',error));
  const buses=loadBusShapeManifests().catch(error=>console.info('Bus shapes unavailable',error));
  bootPhase('loading-data');
  await feeds;
  bootPhase('feeds-checked');
  setInterval(()=>{if(!document.hidden)refreshFeeds()},AVERAGE_POLL_MS);
  bootPhase('ready');
  // 9.7: Neue Version verfügbar melden und zum Neu-Laden einladen.
  function updateToast(){
    const el=document.getElementById('sr-update-toast');
    if(el)return el;
    const t=document.createElement('div');
    t.id='sr-update-toast';
    t.className='sr-update-toast';
    t.innerHTML='<b>Neue Version verfügbar.</b> Zum Aktualisieren Seite neu laden.<button id="sr-update-reload">Jetzt laden</button>';
    document.body.append(t);
    t.querySelector('#sr-update-reload').addEventListener('click',()=>{
      navigator.serviceWorker.getRegistration().then(reg=>{
        if(reg&&reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
        location.reload();
      });
    });
    return t;
  }
  // 9.4: Die App-Huelle wird offline faehig. Live-Daten bleiben unberuehrt.
  // Die Versionsangabe im Pfad sorgt dafuer, dass nach einem Release ein
  // neuer Worker geholt wird - auch wenn der Browser den alten lange cached.
  // Der Scope muss ausdruecklich auf '/' stehen, sonst waere er '/sw.js'.
  if('serviceWorker' in navigator){
   try{
    navigator.serviceWorker.register('/sw.js?v=9.9.5',{scope:'/'}).then(reg=>{
     reg.addEventListener('updatefound',()=>{
      const w=reg.installing;
      if(!w)return;
      w.addEventListener('statechange',()=>{
       if(w.state==='installed'&&navigator.serviceWorker.controller){
        const u=updateToast();u.hidden=false;
       }
      });
     });
    }).catch(()=>{});
   }catch{}
  }
  Promise.allSettled([indexes,rail,buses]).then(()=>{refreshMarkers();updateViewportBadge();});
  // Refresh labels/route associations after GTFS indexes become available.
  // Any valid reported position remains derived only from official feeds.
  if(!document.hidden)refreshFeeds().catch(error=>console.info('Post-index refresh unavailable',error));
  loadBusShapesForVehicles().catch(e=>console.info('Bus shape import pending',e));
}
init().catch(e=>{
  bootPhase('startup-error');
  console.error('Startup error',e);
  const status=$('statusText');if(status)status.textContent=t('status.startupError');
  setNotice('<strong>Fehler beim Start.</strong> Bitte Diagnose im Hinweisfeld prüfen.');
});
