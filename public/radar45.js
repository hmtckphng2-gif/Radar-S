/* Südtirol Radar 4.5 — real dark vector map on top of stable Leaflet tracking.
 * OpenFreeMap Dark uses no user API key; raster OSM remains the offline/weak-4G fallback.
 * Vehicle positions, route lines, clusters and all touch interaction remain Leaflet-owned.
 */
import {styleUrl, shouldTryDarkMap, motionState} from './radar45-logic.mjs';
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let bridge=null,map=null,ready=false,attempt=0,vectorLayer=null,loading=false;
 let darkStatus='warte auf Karte';
 const GL_SRC='https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js';
 const ADAPTER_SRC='https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js';
 function mode(){return window.SuedtirolRadar44?.getMode?.()||'classic';}
 function indicator(message,isProblem=false){
  darkStatus=message;
  let node=$('sr45MapStatus');
  if(!node){node=document.createElement('div');node.id='sr45MapStatus';node.className='sr45-map-status';node.setAttribute('role','status');
   node.setAttribute('aria-live','polite');document.body.append(node);}
  node.textContent=message;node.hidden=!message;node.classList.toggle('sr45-warning',isProblem);
 }
 function loadScript(url,ms=18000){
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=url;script.async=true;
   let done=false;
   const timer=setTimeout(()=>finish(new Error('Ladezeit überschritten')),ms);
   function finish(error){if(done)return;done=true;clearTimeout(timer);script.onload=null;script.onerror=null;
    if(error){script.remove();reject(error);}else resolve();}
   script.onload=()=>finish();script.onerror=()=>finish(new Error('Kartenbibliothek nicht erreichbar'));
   document.head.append(script);
  });
 }
 async function dependencies(){
  // Only load the large vector-map CSS on demand, not on every Classic visit.
  if(!$('sr45MaplibreStyle')){
   const link=document.createElement('link');link.id='sr45MaplibreStyle';link.rel='stylesheet';
   link.href='https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css';
   document.head.append(link);
  }
  if(!window.maplibregl?.Map)await loadScript(GL_SRC);
  if(!window.L?.maplibreGL)await loadScript(ADAPTER_SRC);
  if(!window.L?.maplibreGL||!window.maplibregl?.Map)throw new Error('Vektorkarten-Plugin nicht verfügbar');
  if(typeof window.maplibregl.supported==='function' && !window.maplibregl.supported())
    throw new Error('WebGL auf diesem Gerät nicht verfügbar');
 }
 function restoreRaster(){
  const raster=bridge?.state?.tiles;
  if(map&&raster&&!map.hasLayer(raster))raster.addTo(map);
  document.documentElement.classList.remove('sr45-vector');
 }
 function disposeVector(){
  if(vectorLayer&&map?.hasLayer(vectorLayer))map.removeLayer(vectorLayer);
  vectorLayer=null;restoreRaster();
 }
 async function waitForStyle(layer,timeout=17000){
  const gl=layer?.getMaplibreMap?.();
  if(!gl?.on)throw new Error('Vektor-Renderer startet nicht');
  return new Promise((resolve,reject)=>{
   let complete=false;
   const done=err=>{if(complete)return;complete=true;clearTimeout(timer);
    gl.off?.('load',onLoad);if(err)reject(err);else resolve();};
   const onLoad=()=>done();
   const timer=setTimeout(()=>done(new Error('Dunkle Karte lädt zu langsam')),timeout);
   try{if(gl.loaded?.())return done();gl.on('load',onLoad);}catch(error){done(error)}
  });
 }
 async function applyMapMode(){
  if(!ready||loading)return;
  const desired=mode();
  if(desired==='classic'){
   attempt++;disposeVector();indicator('');return;
  }
  if(vectorLayer){indicator('');return;}
  if(!shouldTryDarkMap({mode:desired,online:navigator.onLine!==false,supported:!!window.L})){
   indicator('Radar Dark braucht Verbindung · Classic bleibt verfügbar',true);
   window.SuedtirolRadar44?.setMode('classic');return;
  }
  const current=++attempt;loading=true;
  indicator('Lade echte schwarze OpenFreeMap-Karte …');
  try{
   await dependencies();
   if(mode()!=='radar'||current!==attempt)return;
   const layer=window.L.maplibreGL({style:styleUrl(),interactive:false});
   vectorLayer=layer;
   layer.addTo(map);
   await waitForStyle(layer);
   if(current!==attempt||mode()!=='radar'){
    if(map.hasLayer(layer))map.removeLayer(layer);
    if(vectorLayer===layer)vectorLayer=null;
    return;
   }
   // Remove the raster AFTER dark vector style loads; never leave patchwork overlays.
   const raster=bridge?.state?.tiles;
   if(raster && map.hasLayer(raster))map.removeLayer(raster);
   document.documentElement.classList.add('sr45-vector');
   map.invalidateSize({pan:false});
   indicator('');
  }catch(error){
   console.warn('OpenFreeMap Dark: Fallback auf Classic',error);
   disposeVector();
   if(current===attempt && mode()==='radar'){
    indicator('Schwarze Karte derzeit nicht erreichbar · Classic aktiviert',true);
    window.SuedtirolRadar44?.setMode('classic');
   }
  }finally{loading=false;}
 }
 function diagnostics(){
  let node=$('sr45MotionStatus');
  const panel=$('radar40Settings');if(!node&&panel){
   node=document.createElement('div');node.id='sr45MotionStatus';node.className='sr45-motion-status';
   panel.append(node);
  }
  if(!node)return;
  const state=bridge.state;
  const buses=[...state.vehicles.values()].filter(v=>v.kind==='bus');
  const onRoutes=buses.filter(v=>state.busTracks.has(v.key)).length;
  const selection=state.vehicles.get(state.selectedKey);
  let extra='';
  if(selection?.kind==='bus'){
   const track=state.busTracks.get(selection.key);
   const motion=motionState({stale:selection.stale,
    route:!!track,observations:track?.samples?.length||0});
   extra=' · Bus '+selection.name+': '+({buffered:'versetzte GTFS-Animation',waiting:'warte auf zweiten Punkt',
    'feed-only':'nur Feedpunkte, keine passende Route',stale:'NICHT LIVE'}[motion]);
  }
  node.textContent=`Straßenanimation: ${onRoutes}/${buses.length} Busse mit zugeordneter GTFS-Strecke${extra}. Ohne passende Strecke keine erfundenen Bewegungen.`;
 }
 function start(){
  if(ready)return;
  bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
  if(!map||!window.SuedtirolRadar44)return;
  ready=true;
  const title=document.querySelector('.brand-title em');if(title)title.textContent='4.5';
  document.title='Südtirol Radar 4.5 · Züge & Busse';
  const settingsTitle=$('radar40Settings')?.querySelector('.sr40-settings-head strong');
  if(settingsTitle)settingsTitle.textContent='Radar 4.5 · Einstellungen';
  diagnostics();
  document.addEventListener('sr44:mode',applyMapMode);
  for(const name of ['sr37:feeds','sr37:shapes','sr37:selection'])document.addEventListener(name,diagnostics);
  // Tapping the old 🗺 button while vector basemap is active should return to Classic.
  $('tileBtn')?.addEventListener('click',ev=>{
   if(mode()!=='radar')return;
   ev.stopImmediatePropagation();
   window.SuedtirolRadar44?.setMode('classic');
  },true);
  window.addEventListener('online',()=>{if(mode()==='radar'&&!vectorLayer)applyMapMode();},{passive:true});
  window.SuedtirolRadar45={version:'4.5',getDarkStatus:()=>darkStatus,
   getVectorReady:()=>Boolean(vectorLayer&&document.documentElement.classList.contains('sr45-vector')),
   retryDark:()=>{if(!loading)applyMapMode();},refreshMotion:diagnostics};
  applyMapMode();
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
