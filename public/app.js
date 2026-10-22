import {state,bootPhase} from './app-state.js?v=9.7.0';
import {motionDuration,platformInfo} from './radar54-logic.mjs?v=9.7.0';
import {boundedMotionDuration,feedDiagnostics} from './radar66-logic.mjs?v=9.7.0';
import {selectRepresentatives,observationQuality} from './radar64-logic.mjs?v=9.7.0';
import {enrichTrainPlatform} from './train-platforms.js?v=9.7.0';
import {
  SOURCES, UPDATE_SOURCES, BBOX, txt, gtfsNumber, parseVehicles, parseUpdates, formatDelay,
  feedAgeSeconds, shapeProject, pointAtDistance, routeOnlySnap, stopRows, formatClock, delayForVehicle,
  vehicleDelayInfo, bufferedAlong, departureDelay, isLiveUpdate
} from './core.js?v=9.7.0';
import {playbackLag} from './radar45-logic.mjs?v=9.7.0';
import {trainReplayDuration} from './radar705-motion.mjs?v=9.7.0';
import {deriveCandidates,withinShapeBounds,chooseVerifiedCandidate} from './radar451-logic.mjs?v=9.7.0';
import {trainScheduledPosition} from './radar51-logic.mjs?v=9.7.0';
import {buildFeedStatus, processPositionFeed, mergePositionVehicles, pruneStaleVehicles, processUpdates} from './feed-process.mjs?v=9.7.0';

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
  const status=$('statusBtn');status.classList.toggle('ok',good===ENDPOINTS.length);
  status.classList.toggle('error',vehicleGood===0);
  $('statusText').textContent=good===ENDPOINTS.length?'FEEDS OK':vehicleGood===0?'OFFLINE':good+'/'+ENDPOINTS.length;
}
function isFeedHealthy(){
  return POSITION_SOURCES.some(s=>state.statuses[s]==='ok'||state.statuses[s]==='old');
}
function updateFeedHealthBanner(){
  const banner=$('feedHealthBanner');
  if(!banner)return;
  banner.hidden=isFeedHealthy();
}
function showSourceStatus(){
  const lines=ENDPOINTS.map(ep=>'<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0"><b>'+escapeHtml(ep)+'</b><span>'+ (state.statuses[ep]==='ok'?'✓ Antwort':'↻ '+(state.statuses[ep]==='old'?'veraltet':'Fehler'))+'</span></div>').join('');
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
  L.control.zoom({position:'bottomleft'}).addTo(map);
  map.on('moveend',()=>{
    updateViewportBadge();
    clearTimeout(state.shapeViewportTimer);
    state.shapeViewportTimer=setTimeout(()=>loadBusShapesForVehicles().catch(console.warn),650);
  });
  map.on('zoomend',()=>{ $('map').classList.toggle('map-zoomed-out',map.getZoom()<11);updateViewportBadge(); });
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
  const isOld=v.stale || (Number.isFinite(v.timestamp) && v.timestamp>1e9 && Date.now()/1000-v.timestamp>300);
  const cls='marker-wrap '+(train?'train':'bus')+(label?'':' unverified')+(state.selectedKey===v.key?' selected':'')+(isOld?' sr43-stale':'');
  const icon=`<div class="${cls}"><div class="marker-label">${escapeHtml(label)}</div><div class="marker-circle">${train?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2.5" width="14" height="17" rx="4"/><path d="M5 10h14M8 16h1m6 0h1M8 19.5l-2 2m10-2 2 2"/></svg>':'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="16" rx="3"/><path d="M3 11h18M7 15h2m6 0h2M7 19l-2 2m14-2 2 2"/></svg>'}</div></div>`;
  return L.divIcon({className:'radar-custom',html:icon,iconSize:[30,43],iconAnchor:[15,38]});
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
    const iconKey=`${v.kind}|${v.name}|${state.selectedKey===key}|${aged}`;
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
}
function displayStats(){
  const keys=state.fusion?.keys||selectRepresentatives(state.vehicles.values(),state.selectedKey).keys;
  const all=[...state.vehicles.values()].filter(v=>keys.has(v.key));
  $('countAll').textContent=all.length;$('countTrains').textContent=all.filter(v=>v.kind==='train').length;
  $('countBuses').textContent=all.filter(v=>v.kind==='bus').length;
  const staleCount=all.filter(v=>v.stale || (v.timestamp && Date.now()/1000-v.timestamp>300)).length;
  $('lastUpdate').textContent=state.fetchedAt?'Abfrage '+new Date(state.fetchedAt).toLocaleTimeString('de-IT',{hour:'2-digit',minute:'2-digit'})+(staleCount?' · '+staleCount+' NICHT LIVE':''):'Noch keine Daten';
}
async function refreshFeeds(){
  if(state.busy)return;
  state.busy=true;$('statusText').textContent='LÄDT ...';
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
    state.failCount=ENDPOINTS.filter(s=>state.statuses[s]!=='ok').length;
    statusLabel();updateFeedHealthBanner();refreshMarkers();state.diagnostics=feedDiagnostics(state.vehicles.values(),state.statuses,Date.now(),state.fusion);displayStats();refreshScheduleMatches();
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
    $('statusText').textContent='FEHLER';$('statusBtn').classList.add('error');
  }finally{state.busy=false;}
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
  // 9.5: Der Fokus wandert in das Panel und kommt beim Schliessen zurueck.
  try{sheet.focus({preventScroll:true})}catch{}
  $('scrim').classList.add('show');
}
function closeSheets(resetSelection=true){
  for(const id of ['sheet','stationSheet']){$(id).classList.remove('open');$(id).setAttribute('aria-hidden','true');}
  // 9.5: Der Fokus geht zurueck auf die Karte.
  try{$('map')?.focus({preventScroll:true})}catch{}
  $('scrim').classList.remove('show');state.activeSheet=null;
  if(resetSelection){state.selectedKey=null;refreshMarkers();}
  document.dispatchEvent(new Event('sr37:sheet-closed'));
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
  const info=currentVehicleDelay(v);
  detail('Verspätung (GTFS-RT)',cancelled?'Entfällt':info?formatDelay(info.delay)+(info.basis==='fahrt'?' · Fahrtwert':/^(STOPPED_AT|1)$/i.test(v.currentStatus)?' · am Halt':' · nächster Halt'):'Keine bestätigten Verspätungsdaten');
  detail('Fahrtziel',v.headsign);
  detail('Fahrzeug-ID',v.vehicleId);
  detail('Fahrt-ID',v.tripId||'Nicht verfügbar');
  // Zwei getrennte Werte: die gemeldete Verspaetung und die Abweichung vom Fahrplan.
  // Die eine ist eine Zeitangabe, die andere eine Ortsangabe.
  const schedule=trainScheduledPosition(v,state.indexes,state.details,state.shapes);
  if(schedule)detail('Abweichung Fahrplan','~'+schedule.differenceKm.toFixed(1)+' km '+schedule.relative+' ('+schedule.from+' - '+schedule.to+')');
  detail('Positionsalter',feedAgeSeconds(v)===null?'Unbekannt':duration(feedAgeSeconds(v)*1000)+' Sek.');
  detail('Geschwindigkeit',v.speed===null?'Nicht verfügbar':v.speed+' km/h (Feed)');
  detail('Quelle',v.source.toUpperCase()+' / GTFS-RT');
  let note='Die Kartenposition ist '+(v.source==='sta'?'ein Feed-Messwert, nicht zwingend GPS.':'simuliert/geschätzt, keine GPS-Ortung.')+' ';
  if(v.stale)note+='Dieser Marker ist nur die letzte bekannte Position; der aktuelle Feed enthält ihn nicht. ';
  if(v.kind==='bus'&&!v.lineVerified)note+='Ohne passenden statischen GTFS-Eintrag keine bestätigte Liniennummer. ';
  if(v.kind==='bus')note+=mapTarget(v).path?'Kartenbewegung: zeitverzögert zwischen empfangenen Punkten entlang einer geprüften GTFS-Strecke; keine sekundengenaue GPS-Ortung. ':'Keine eindeutig passende GTFS-Straße: Nur tatsächlich empfangene Positionen, keine erfundene Bewegung. ';
  if(v.kind==='train'&&!v.nameVerified)note+='Die offizielle Zugnummer ist noch nicht zugeordnet. ';
  if(v.kind==='train')note+=state.jobs.get(v.key)?.replay ? 'Markerbewegung ist eine zeitverzögerte Wiedergabe zwischen empfangenen Feedpositionen auf einer passenden GTFS-Strecke, keine sekundengenaue Live-GPS-Ortung. ' : 'Nur empfangene Feedpositionen – ohne zwei passende Messpunkte wird keine zusätzliche Zugbewegung dargestellt. ';
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
  const sameDay=!update?.tripStartDate||txt(update.tripStartDate).replaceAll('-','')===gtfsLocalDate().replaceAll('-','');
  const platformLive=Boolean(update&&sameDay&&state.statuses[v.source+'_updates']==='ok'&&Number.isFinite(update.fetchedAt)&&Date.now()-update.fetchedAt<=120000&&Date.now()>=update.fetchedAt-30000);
  for(const row of rows){
    const li=document.createElement('li');li.className='stop';
    const left=document.createElement('div');const name=document.createElement('b');name.textContent=row.name;left.append(name);
    const upd=lookup.get(row.stopId)||(update?.stops||[]).find(u=>!txt(u.stopId??u.stop_id)&&Number(u.stopSequence??u.stop_sequence)===Number(row.seq));
    const platform=platformInfo(details.stops?.[row.stopId],platformLive?upd:null,details.stops);
    const track=document.createElement('small');track.className='stop-platform';
    track.textContent=(v.kind==='bus'?'Steig ':'Gleis ')+(platform.current||'unbekannt')+(platform.changed?' · geändert':platform.live?' · gemeldet':platform.current?' · Plan':'');
    if(platform.changed)track.style.color='#ffc37d';
    left.append(track);
    if(v.kind==='train'){
      const timing=details.times?.[v.tripId]?.find(t=>String(t[0])===String(row.stopId)&&Number(t[3])===Number(row.seq));
      enrichTrainPlatform(track,{number:state.indexes[v.source]?.trips?.[v.tripId]?.[3]||v.name,serviceDay:v.tripStartDate||gtfsLocalDate(),source:v.source,stopId:row.stopId,stopName:row.name,arrival:timing?.[1],departure:timing?.[2],terminal:Boolean(timing&&timing===details.times?.[v.tripId]?.at(-1))},platform);
    }
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
  if(window.SuedtirolRadar71?.enabled&&!document.hidden)document.body.classList.add('sr71-focusing');
  state.selectedKey=key;
  document.dispatchEvent(new Event('sr40:selection'));
  $('scheduleMatches').hidden=true;openSheet('vehicle');refreshMarkers();drawVehicleDetails(key,true);
  document.dispatchEvent(new Event('sr37:selection'));
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
  openSheet('station');$('stationBoard').hidden=true;$('stationResults').hidden=false;
  $('stationResults').textContent='Lade Haltestellen …';
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
  document.dispatchEvent(new CustomEvent('sr75:station-selected',{detail:{stopId:st.stopId,name:st.name}}));
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
    const upd=state.updates.get(st.source+':'+d.tripId);
    const live=isLiveUpdate(upd)&&state.statuses[st.source+'_updates']==='ok';
    const delay=live?departureDelay(upd,st.stopId):null;
    title.textContent=d.name+' · '+d.headsign;
    sub.textContent=delay===null?(live?'Live, keine Verspätung':'Geplant'):(delay>0?'Live · +'+Math.round(delay/60)+' Min.':'Live · '+Math.round(delay/60)+' Min. früher')+' · '+st.source.toUpperCase();
    sub.classList.toggle('sr-dep-live',live);
    clock.textContent=formatClock(d.sec);
    body.append(title,sub);btn.append(body,clock);list.append(btn);
  }
  if(!departures.length)list.textContent='Keine kommenden GTFS-Abfahrten für den heutigen Tag gefunden. Das ist keine Aussage über aktuelle Zugausfälle.';
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
    const small=document.createElement('small');small.textContent=v.headsign||'Ziel unbekannt';left.append(small);
    const kind=document.createElement('span');kind.className='kind';kind.textContent=v.kind==='train'?'ZUG':'BUS';btn.append(left,kind);
    btn.onclick=()=>{selectVehicle(v.key);list.hidden=true;};
    list.append(btn);
  }
  list.hidden=false;
}
function setupControls(){
  setupSheetTouchGuards();
  offlineState();
  window.addEventListener('offline',()=>offlineState(false));
  window.addEventListener('online',()=>offlineState(true));
  for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>setFilter(b.dataset.filter));
  let debounce=0;
  $('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToFirstHit()}});
  $('search').oninput=e=>{clearTimeout(debounce);debounce=setTimeout(()=>{state.query=e.target.value.toLocaleLowerCase('de').trim();refreshMarkers();refreshScheduleMatches();updateViewportBadge();renderSearchResults()},130)};
  $('statusBtn').onclick=showSourceStatus;
  $('refreshBtnFromBanner').onclick=()=>refreshFeeds();
  $('tileBtn').onclick=()=>switchTileProvider(1-tileProviderIndex,'Benutzerwahl');
  document.addEventListener('click',e=>{
    if(!e.target.closest('#search')&&!e.target.closest('#searchResults'))$('searchResults')?.classList.add('hidden');
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
  $('stationSearch').oninput=renderStationResults;$('backStations').onclick=()=>{$('stationBoard').hidden=true;$('stationResults').hidden=false};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});
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
    navigator.serviceWorker.register('/sw.js?v=9.7.0',{scope:'/'}).then(reg=>{
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
  const status=$('statusText');if(status)status.textContent='STARTFEHLER';
  setNotice('<strong>Fehler beim Start.</strong> Bitte Diagnose im Hinweisfeld prüfen.');
});
