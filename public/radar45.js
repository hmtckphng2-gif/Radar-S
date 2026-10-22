/* Südtirol Radar 4.5.2 — drag-compensated dark vector basemap.
 * Leaflet owns ALL interactions and vehicle markers. MapLibre is an inert
 * sibling underneath the Leaflet pane, kept aligned on move/zoom/resize.
 * Unlike the previous maplibre-leaflet tile layer this is NOT in a Leaflet
 * transformed pane and therefore cannot remain frozen during a Leaflet pan.
 */
import {styleUrl, shouldTryDarkMap, motionState} from './radar45-logic.mjs?v=9.6.0';
import {buildMatchingDiagnostic} from './radar451-logic.mjs?v=9.6.0';
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let bridge=null,leaflet=null,vector=null,holder=null,ready=false,started=false;
 let generation=0,loading=false,lastStatus='',raf=0,loader=null,attributionAdded=false;
 // The black canvas renders asynchronously, while Leaflet moves HTML markers
 // immediately. Track the LAST actually painted camera for a temporary CSS
 // offset that keeps the basemap and markers aligned between GL frames.
 let painted=null,renderListener=null;
 let lastSynced=0;
 const MIN_GL_SYNC_MS=42; // ~24 fps MapLibre, CSS compensation stays immediate

 const GL_SRC='https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js';
 const GL_CSS='https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.css';
 const mode=()=>window.SuedtirolRadar44?.getMode?.()||'classic';
 const status=(msg,warning=false)=>{
   lastStatus=msg;
   let box=$('sr45MapStatus');
   if(!box){box=document.createElement('div');box.id='sr45MapStatus';box.className='sr45-map-status';
     box.setAttribute('role','status');document.body.append(box);}
   box.textContent=msg;box.hidden=!msg;box.classList.toggle('sr45-warning',warning);
 };
 function importScript(url,timeout=16000){
   return new Promise((resolve,reject)=>{
     const script=document.createElement('script');script.async=true;script.src=url;
     let done=false;
     const finish=error=>{if(done)return;done=true;clearTimeout(timer);
       if(error){script.remove();reject(error);}else resolve();};
     const timer=setTimeout(()=>finish(new Error('Kartenbibliothek lädt zu langsam')),timeout);
     script.onload=()=>finish();script.onerror=()=>finish(new Error('Kartenbibliothek nicht erreichbar'));
     document.head.append(script);
   });
 }
 async function libraries(){
   if(!$('sr45MaplibreStyle')){
     const link=document.createElement('link');link.id='sr45MaplibreStyle';link.rel='stylesheet';link.href=GL_CSS;
     document.head.append(link);
   }
   if(!window.maplibregl?.Map){if(!loader)loader=importScript(GL_SRC);await loader;}
   if(!window.maplibregl?.Map || window.maplibregl.supported?.()===false)
      throw new Error('MapLibre / WebGL nicht verfügbar');
 }
 // Leaflet EPSG3857 uses 256px tiles, MapLibre's native world uses 512px.
 // Identical rendered scale requires MapLibre zoom = Leaflet zoom - 1.
 function view(){const p=leaflet.getCenter();return {center:[p.lng,p.lat],zoom:leaflet.getZoom()-1,bearing:0,pitch:0};}
 function correction(){
   if(!painted || !vector || !holder || !leaflet || typeof leaflet.project!=='function' || mode()!=='radar')return;
   // Leaflet projects geographic coordinates at its current zoom in screen px.
   // The painted MapLibre camera is the last image the user can actually see.
   const current=leaflet.getCenter(),z=leaflet.getZoom();
   const old=leaflet.project([painted.lat,painted.lng],z);
   const now=leaflet.project(current,z);
   const dx=old.x-now.x,dy=old.y-now.y;
   const scale=Math.pow(2,(z-1)-painted.zoom);
   if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(scale)||scale<.2||scale>5)return;
   // CSS compositing is synchronous with Leaflet's DOM marker transform.
   // This compensates GL's one-frame rendering lag without inventing positions.
   holder.style.transform=`translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${scale.toFixed(6)})`;
 }
 function recordPaint(){
   if(!vector)return;
   const center=vector.getCenter?.();const zoom=vector.getZoom?.();
   if(center&&Number.isFinite(center.lat)&&Number.isFinite(center.lng)&&Number.isFinite(zoom)){
     painted={lat:center.lat,lng:center.lng,zoom};
     correction();
   }
 }
 function syncVector(){
   if(!vector || !leaflet || mode()!=='radar')return;
   lastSynced=performance.now();
   try{vector.jumpTo(view());}catch(err){console.warn('Map sync error',err);}
 }
 function queueSync(){
   // The CSS offset is applied NOW; the WebGL camera catches up at a
   // conservative rate to reduce load and jitter on mobile Safari.
   correction();
   if(raf||!vector)return;
   const lag=Math.max(0,MIN_GL_SYNC_MS-(performance.now()-lastSynced));
   // RequestAnimationFrame keeps visual updates in the browser paint cycle.
   // Keep a timestamp to avoid queuing expensive GL renders on every touch event.
   raf=requestAnimationFrame(()=>{raf=0;if(performance.now()-lastSynced>=MIN_GL_SYNC_MS)syncVector();
     else if(!raf)raf=requestAnimationFrame(()=>{raf=0;syncVector();});});
 }
 function onMove(){queueSync();}
 function onResize(){if(vector)vector.resize?.();queueSync();}
 function hookLeaflet(){
   leaflet.on('move',onMove);leaflet.on('zoom',onMove);
   leaflet.on('zoomend',syncVector);leaflet.on('moveend',syncVector);
   leaflet.on('resize',onResize);
   window.addEventListener('resize',onResize,{passive:true});
   window.addEventListener('orientationchange',onResize,{passive:true});
 }
 function unhookLeaflet(){
   leaflet?.off?.('move',onMove);leaflet?.off?.('zoom',onMove);
   leaflet?.off?.('zoomend',syncVector);leaflet?.off?.('moveend',syncVector);
   leaflet?.off?.('resize',onResize);
   window.removeEventListener('resize',onResize);
   window.removeEventListener('orientationchange',onResize);
   if(raf){cancelAnimationFrame(raf);raf=0;}
 }
 function dispose(){
   if(attributionAdded){leaflet?.attributionControl?.removeAttribution?.('Karte © OpenFreeMap');attributionAdded=false;}
   document.documentElement.classList.remove('sr451-vector','sr45-vector');
   if(vector){
     if(renderListener)vector.off?.('render',renderListener);
     try{vector.remove();}catch{}vector=null;
   }
   renderListener=null;painted=null;lastSynced=0;
   if(holder)holder.style.transform='';
   unhookLeaflet();
   holder?.remove();holder=null;
   leaflet?.invalidateSize?.({pan:false});
 }
 function awaitInitialStyle(gl,timeout=18000){
   return new Promise((resolve,reject)=>{
     let settled=false;
     const finish=e=>{if(settled)return;settled=true;clearTimeout(timer);
       gl.off?.('load',onLoad);if(e)reject(e);else resolve();};
     const onLoad=()=>finish();
     const timer=setTimeout(()=>finish(new Error('Dunkler Kartenstil lädt zu lange')),timeout);
     try{if(gl.loaded?.())finish();else gl.on('load',onLoad);}catch(e){finish(e);}
   });
 }
 async function applyMode(){
   const token=++generation;
   if(!ready)return;
   if(mode()!=='radar'){
     loading=false;dispose();status('');return;
   }
   if(vector && document.documentElement.classList.contains('sr451-vector')){syncVector();return;}
   if(loading)return;
   if(!shouldTryDarkMap({mode:mode(),online:navigator.onLine!==false,supported:!!window.L})){
     status('Radar Dark benötigt Verbindung · Classic bleibt verfügbar',true);
     window.SuedtirolRadar44?.setMode('classic');return;
   }
   loading=true;
   status('Lade schwarze Karte …');
   try{
     await libraries();
     if(token!==generation || mode()!=='radar')return;
     // Direct MapLibre renderer: never insert its canvas in the transformed
     // Leaflet tile pane. CSS keeps all Leaflet interactions enabled.
     holder=document.createElement('div');holder.id='sr451-dark-base';holder.setAttribute('aria-hidden','true');
     $('map').prepend(holder);
     vector=new maplibregl.Map({container:holder,style:styleUrl(),...view(),
       interactive:false,attributionControl:false,renderWorldCopies:false,
       fadeDuration:0,canvasContextAttributes:{antialias:false}});
     // Listen to actual WebGL paints, not merely requested camera moves.
     painted={lat:leaflet.getCenter().lat,lng:leaflet.getCenter().lng,zoom:leaflet.getZoom()-1};
     renderListener=recordPaint;vector.on('render',renderListener);
     hookLeaflet();
     await awaitInitialStyle(vector);
     if(token!==generation || mode()!=='radar')return;
     onResize();syncVector();recordPaint();
     if(leaflet?.attributionControl?.addAttribution){leaflet.attributionControl.addAttribution('Karte © OpenFreeMap');attributionAdded=true;}
     document.documentElement.classList.add('sr451-vector','sr45-vector');
     status('');
   }catch(error){
     console.warn('Radar Dark kann nicht synchron gestartet werden',error);
     if(token===generation){
       dispose();status('Schwarze Karte nicht erreichbar · Classic aktiviert',true);
       if(mode()==='radar')window.SuedtirolRadar44?.setMode('classic');
     }
   }finally{
     loading=false;
     // Finish a queued mode change (e.g. the user tapped Classic while loading).
     if(mode()!=='radar')dispose();
   }
 }
 function diagnostics(){
   let box=$('sr45MotionStatus');const panel=$('radar40Settings');
   if(!box&&panel){box=document.createElement('div');box.id='sr45MotionStatus';
     box.className='sr45-motion-status';panel.append(box);}
   if(!box||!bridge)return;
   const state=bridge.state;
   const buses=[...state.vehicles.values()].filter(v=>v.kind==='bus');
   let candidateCount=0,geometryCount=0,routeCount=0,legacy=0;
   for(const bus of buses){
     const ids=bus.shapeId?[bus.shapeId]:bus.routeShapeId?[bus.routeShapeId]:(bus.routeShapeCandidates||[]);
     if(ids.length)candidateCount++;
     if(ids.some(id=>!!state.shapes[bus.source]?.shapes?.[id]))geometryCount++;
     if(bus.routeShapeId)legacy++;
     if(bridge.routeMatchFor?.(bus)?.path)routeCount++;
   }
   const manifest=!!state.busShapeManifests.sta?.byShape || !!state.busShapeManifests.trentino?.byShape;
   const info=buildMatchingDiagnostic({busCount:buses.length,matched:routeCount,
     manifestLoaded:manifest,candidates:candidateCount,geometry:geometryCount,legacy});
   const selected=state.vehicles.get(state.selectedKey);
   const track=selected?.kind==='bus'?state.busTracks.get(selected.key):null;
   const motion=selected?.kind==='bus'?motionState({stale:selected.stale,route:!!track,
     observations:track?.samples?.length||0}):null;
   box.textContent='Straßenanimation: '+info+(motion?' · Gewählter Bus: '+({buffered:'pufferte Bewegung',waiting:'zweiter Feedpunkt fehlt','feed-only':'nur gemeldete Position',stale:'NICHT LIVE'}[motion]||motion):'')+'. Keine erfundenen GPS-Positionen.';
 }
 function start(){
   if(started)return;
   bridge=window.SuedtirolRadar37;leaflet=bridge?.state?.map;
   if(!leaflet||!window.SuedtirolRadar44)return;
   started=true;ready=true;
   const title=$('radar40Settings')?.querySelector('.sr40-settings-head strong');
   if(title)title.textContent='Radar 4.5.2 · Einstellungen';
   document.addEventListener('sr44:mode',applyMode);
   for(const name of ['sr37:feeds','sr37:shapes','sr37:selection'])document.addEventListener(name,diagnostics);
   $('tileBtn')?.addEventListener('click',event=>{
     if(mode()==='radar'){
       event.stopImmediatePropagation();window.SuedtirolRadar44?.setMode('classic');
     }
   },true);
   window.addEventListener('online',()=>{if(mode()==='radar'&&!vector)applyMode();},{passive:true});
   window.SuedtirolRadar45={version:'4.5.2',getVectorReady:()=>Boolean(vector&&document.documentElement.classList.contains('sr451-vector')),
     getDarkStatus:()=>lastStatus,getDarkRenderer:()=>vector,getMapSyncView:view,
     retryDark:applyMode,refreshMotion:diagnostics};
   diagnostics();applyMode();
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
