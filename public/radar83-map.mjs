/* Radar 8.3 — actual pitched vector/terrain 3D map with a shared WebGL vehicle layer.
 * The original Leaflet map stays intact underneath. Only selected cinematic
 * vehicles initialize MapLibre; errors or ?radar3d=on fall back to Radar 8.2.
 */
import {loadThree,loadVehicleModel,modelCreditText,makeVehicleMesh,makeContactShadow,vehicleKind,VEHICLE_SPECS,modelYawRadians} from './radar83-model.mjs?v=9.9.5&rev=credits-2';
import {MAPLIBRE_VERSION,VECTOR_STYLE,TERRAIN_TILES,enabled3D,target3DCamera,handoff3DCamera,use3DTerrain,readProjectionMatrix,followDecision,prefersReducedMotion,positionFreshness,selectedVehicleLabel,selectedVehicleMeta} from './radar83-logic.mjs?v=9.9.5&flag=enabled-default&launch=tap-origin-continuous-3';

let libraryPromise=null;
function loadMapLibre(){
 if(window.maplibregl?.Map)return Promise.resolve(window.maplibregl);
 if(libraryPromise)return libraryPromise;
 libraryPromise=new Promise((resolve,reject)=>{
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='https://cdn.jsdelivr.net/npm/maplibre-gl@'+MAPLIBRE_VERSION+'/dist/maplibre-gl.css';
  document.head.append(link);
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/maplibre-gl@'+MAPLIBRE_VERSION+'/dist/maplibre-gl.js';
  script.async=true;
  let settled=false;
  const timeout=setTimeout(()=>done(new Error('MapLibre loading timed out')),11000);
  function done(error){
   if(settled)return;settled=true;clearTimeout(timeout);
   if(error){script.remove();reject(error)}else resolve(window.maplibregl);
  }
  script.onload=()=>window.maplibregl?.Map?done():done(new Error('MapLibre missing'));
  script.onerror=()=>done(new Error('MapLibre CDN unavailable'));
  document.head.append(script);
 }).catch(e=>{libraryPromise=null;throw e});
 return libraryPromise;
}
export function preload3DLibraries(){
 if(!enabled3D(location.search))return;
 // Warm expensive first-tap dependencies while the radar is idle.
 // Downloads only: no map or WebGL context is created until vehicle selection.
 loadMapLibre().catch(()=>{});
 loadThree().catch(()=>{});
 if(typeof fetch==='function')fetch(VECTOR_STYLE,{mode:'cors',cache:'force-cache'}).catch(()=>{});
}
// Wait for real vector tiles and the model render before revealing the new map.
// Otherwise iOS Safari can display a black WebGL surface while the CSS toolbar
// falsely claims that the cinematic has already started.
export function waitFor3DScene(map,timeoutMs=7200){
 return new Promise((resolve,reject)=>{
  let ended=false;
  const finish=error=>{
   if(ended)return;ended=true;clearTimeout(timeout);
   map.off('render',check);map.off('idle',check);
   if(error)reject(error);else resolve();
  };
  const check=()=>{
   try{
    // The style also contains an unrelated shaded-relief raster source.
    // areTilesLoaded() waits for every visible source, so a slow/blocked DEM
    // tile can hide an otherwise usable vector map and prevent the 3D view.
    // Only gate on the actual vector source used by the 3D buildings.
    if(map.isStyleLoaded?.() && map.getSource('openmaptiles') &&
       map.isSourceLoaded?.('openmaptiles'))finish();
   }catch(e){finish(e)}
  };
  const timeout=setTimeout(()=>finish(new Error('3D vector tiles not ready')),timeoutMs);
  map.on('render',check);map.on('idle',check);
  check();
 });
}
export function waitFor3DModel(map,layer,timeoutMs=2200){
 return new Promise((resolve,reject)=>{
  let ended=false;
  const finish=error=>{
   if(ended)return;ended=true;clearTimeout(timeout);
   map.off('render',check);if(error)reject(error);else resolve();
  };
  const check=()=>{
   if(layer.renderError)finish(new Error('3D model render failed'));
   else if(layer.didRender)finish();
  };
  const timeout=setTimeout(()=>finish(new Error('3D model not rendered')),timeoutMs);
  map.on('render',check);map.triggerRepaint();check();
 });
}
export function build3DBuildings(map){
 if(!map.getSource('openmaptiles')||map.getLayer('sr83-buildings'))return false;
 const firstLabel=map.getStyle()?.layers?.find(layer=>layer.type==='symbol')?.id;
 map.addLayer({
  id:'sr83-buildings',type:'fill-extrusion',source:'openmaptiles', 'source-layer':'building',
  minzoom:14,
  // Match the provider's working OpenMapTiles 3D layer, but retain safe
  // fallbacks for incomplete OSM height tags. The old near-black blue-grey
  // blended into the dark building footprints and made extrusions look absent.
  filter:['!', ['has','hide_3d']],
  paint:{
   'fill-extrusion-color':'hsl(215, 10%, 72%)',
   'fill-extrusion-opacity':['step',['zoom'],.88,18,.72,19.2,.4,20.4,.18],
   'fill-extrusion-height':['max',3,['to-number',['coalesce',['get','render_height'],['get','height'],['*',['to-number',['get','building:levels'],3],3],8]]],
   'fill-extrusion-base':['to-number',['coalesce',['get','render_min_height'],['get','min_height'],0]]
  }
 },firstLabel);
 // Fine silver edges add depth at city zoom without turning the map neon.
 if(!map.getLayer('sr83-building-edges'))map.addLayer({
  id:'sr83-building-edges',type:'line',source:'openmaptiles','source-layer':'building',
  minzoom:15,filter:['!', ['has','hide_3d']],
  paint:{'line-color':'rgba(238,244,250,0.52)','line-width':0.65,'line-opacity':['step',['zoom'],.58,18,.42,20.4,.18]}
 },firstLabel);
 return true;
}
export function enable3DTerrain(map){
 // Terrain is optional. If DEM is unavailable, pitched 3D buildings still work.
 try{
  if(map.getSource('sr83-dem'))return true;
  map.addSource('sr83-dem',{
   type:'raster-dem',tiles:[TERRAIN_TILES],tileSize:256,maxzoom:13,encoding:'terrarium'
  });
  map.setTerrain({source:'sr83-dem',exaggeration:1.08});
  return true;
 }catch(error){console.info('Radar 8.3: terrain fallback to buildings-only',error);return false}
}
function disposeObject(object){
 if(!object)return;
 const used=new Set(),textures=new Set();
 object.traverse(node=>{
  node.geometry?.dispose?.();
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const material of materials)if(material&&!used.has(material)){
   used.add(material);
   for(const value of Object.values(material))if(value?.isTexture&&!textures.has(value)){textures.add(value);value.dispose?.()}
   material.dispose?.();
  }
 });
}
export function make3DVehicleLayer(T,lib,map,vehicle,point,heading,onModel=()=>{}){
 const origin={lat:point.lat,lng:point.lng},kind=vehicleKind(vehicle);
 return {
  id:'sr83-selected-vehicle',
  type:'custom',renderingMode:'3d',didRender:false,
  onAdd(m,gl){
   this.map=m;this.scene=new T.Scene();this.camera=new T.Camera();
   this.scene.add(new T.HemisphereLight(0xffffff,0x586b7f,2.4));
   const keyLight=new T.DirectionalLight(0xffffff,2.25);keyLight.position.set(-30,60,-35);this.scene.add(keyLight);
   const fill=new T.DirectionalLight(0xb4d9ff,.8);fill.position.set(25,25,30);this.scene.add(fill);
   this.object=makeVehicleMesh(T,kind);this.scene.add(this.object);
   this.modelKind='schematic';this.disposed=false;
   this.shadow=makeContactShadow(T,kind==='bus'?6.5:14);this.scene.add(this.shadow);
   this.renderer=new T.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:false,powerPreference:'low-power'});
   this.renderer.autoClear=false;
   // A real downloaded model replaces the schematic one as soon as it has
   // arrived. The 3D view never waits for it and never depends on it.
   loadVehicleModel(kind,T).then(loaded=>{
    if(!loaded||this.disposed||!this.scene||!this.renderer)return;
    const previous=this.object;
    this.object=loaded.object;this.scene.add(this.object);
    this.modelKind='real';
    if(this.shadow)this.shadow.scale.setScalar(kind==='bus'?0.5:1);
    this.map?.triggerRepaint();
    disposeObject(previous);
    onModel({kind:'real',credit:loaded.credit||null});
   }).catch(error=>{
    if(this.disposed)return;
    const message=String(error?.message||error||'Unbekannter Modellfehler').slice(0,180);
    console.warn('Radar 8.3: echtes Fahrzeugmodell konnte nicht geladen werden',error);
    onModel({kind:'error',error:message});
   });
  },
  update(p,h){
   const lat=Number(p?.lat),lng=Number(p?.lng),head=Number(h);
   // Ungueltige Werte werden verworfen, sonst wird die Modellrotation NaN.
   const safeLat=Number.isFinite(lat)?lat:origin.lat;
   const safeLng=Number.isFinite(lng)?lng:origin.lng;
   const safeHead=Number.isFinite(head)?head:heading;
   // 9.2: MapLibre loescht bei jedem Frame den Zeichenpuffer. Deshalb muss
   // der 3D-Layer in jedem Frame auch zeichnen. Der sparsame Weg ist nicht
   // "nicht zeichnen", sondern "keinen Frame anfordern", wenn sich nichts
   // bewegt hat. Dann bleibt der Puffer stehen und die ganze Karte wird
   // nicht neu gezeichnet.
   const moved=Math.abs(safeLat-origin.lat)>1e-5||Math.abs(safeLng-origin.lng)>1e-5||Math.abs(safeHead-heading)>0.05;
   origin.lat=safeLat;origin.lng=safeLng;heading=safeHead;
   if(moved)this.map?.triggerRepaint();
  },
  render(gl,args){
   const matrix=readProjectionMatrix(args);if(!matrix||!this.renderer)return;
   try{
    if(document.hidden)return;
    const elevation=Number(this.map.queryTerrainElevation?.([origin.lng,origin.lat]));
    const altitude=Number.isFinite(elevation)?Math.max(-50,elevation)+.50:0;
    const geo=lib.MercatorCoordinate.fromLngLat([origin.lng,origin.lat],altitude);
    const scale=geo.meterInMercatorCoordinateUnits();
    const transform=new T.Matrix4()
     .makeTranslation(geo.x,geo.y,geo.z)
     .scale(new T.Vector3(scale,-scale,scale))
     .multiply(new T.Matrix4().makeRotationX(Math.PI/2))
     .multiply(new T.Matrix4().makeRotationY(modelYawRadians(heading)));
    this.camera.projectionMatrix=new T.Matrix4().fromArray(matrix).multiply(transform);
    // Jeder Frame, in dem MapLibre den Puffer leert, muss hier auch gezeichnet
    // werden. Sonst waere die 3D-Szene beim naechsten Frame weg.
    this.renderer.resetState();
    this.renderer.render(this.scene,this.camera);
    this.didRender=true;
   }catch(error){if(!this.renderError){console.warn('Radar 8.3 render failed',error);this.renderError=true}}
  },
  onRemove(){
   this.disposed=true;
   disposeObject(this.object);
   disposeObject(this.shadow);this.shadow=null;
   this.object=null;
   this.renderer?.dispose();
   this.renderer=null;
  }
 };
}
export class Radar83Cinematic {
  constructor(leaflet,{onExit=()=>{},onManual=()=>{},onFailure=()=>{},onModel=()=>{}}={}){
   this.leaflet=leaflet;this.onExit=onExit;this.onManual=onManual;this.onFailure=onFailure;this.onModel=onModel;
  this.sequence=0;this.map=null;this.overlay=null;this.layer=null;
  this.ready=false;this.touched=false;this.active=false;this.flight=null;this.flying=false;this.flightTimer=0;this.openTimeout=0;this.lastPoint=null;this.lastHeading=null;this.visibilityHandler=null;
 }
 get enabled(){return enabled3D(location.search)}
 makeOverlay(vehicle){
  const overlay=document.createElement('div');overlay.className='sr83-viewport';overlay.id='sr83Viewport';
  const surface=document.createElement('div');surface.className='sr83-map';overlay.append(surface);
  const toolbar=document.createElement('div');toolbar.className='sr83-toolbar';
  const focus=document.createElement('button');focus.className='sr83-control';focus.type='button';focus.textContent='Fokus';focus.setAttribute('aria-label','Kamera auf den Zug ausrichten');focus.addEventListener('click',e=>{e.stopPropagation();this.focus()});
  const free=document.createElement('button');free.className='sr83-control';free.type='button';free.textContent='Frei';free.setAttribute('aria-label','Freie Kamerasteuerung aktivieren');free.addEventListener('click',e=>{e.stopPropagation();this.free()});
  const info=document.createElement('span');info.className='sr83-label';info.textContent='3D · '+selectedVehicleLabel(vehicle);
  const replay=document.createElement('button');replay.className='sr83-replay';
  replay.type='button';replay.textContent='↻ Flug';
  replay.setAttribute('aria-label','3D-Kameraflug wiederholen');
  replay.addEventListener('click',e=>{e.stopPropagation();this.replay()});
  const back=document.createElement('button');back.className='sr83-back';back.type='button';back.textContent='↩ 2D';
  back.setAttribute('aria-label','Zur normalen 2D-Karte zurückkehren');
  back.addEventListener('click',e=>{e.stopPropagation();this.close();this.onExit()});
  toolbar.append(focus,free,replay,back);overlay.append(toolbar);
  const loading=document.createElement('div');loading.className='sr83-loading-state';loading.setAttribute('role','status');loading.innerHTML='<span class="sr83-spinner" aria-hidden="true"></span><span>3D wird geladen …</span>';overlay.append(loading);this.loading=loading;
  const infoCard=document.createElement('section');infoCard.className='sr83-info-card';
  infoCard.append(info);
  const meta=document.createElement('div');meta.className='sr83-vehicle-meta';
  const initialQuality=positionFreshness(vehicle);
  const initialPosition=initialQuality.fresh?(initialQuality.estimated?'Geschätzte Position':'Feedposition')+' · '+initialQuality.label:'Position veraltet · '+initialQuality.label;
  meta.textContent=(selectedVehicleMeta(vehicle)||'')+(selectedVehicleMeta(vehicle)?' · ':'')+initialPosition;
  infoCard.append(meta);this.vehicleMeta=meta;
  const sources=document.createElement('details');sources.className='sr83-sources';
  const summary=document.createElement('summary');summary.textContent='Quellen';sources.append(summary);
  const credit=document.createElement('div');credit.className='sr83-credit';
  credit.textContent='Referenzmodell · Fahrzeugtyp nicht bestätigt · schematische Darstellung';
  sources.append(credit);this.credit=credit;
  const detailsHost=document.getElementById('details');
  const sheetScroll=document.querySelector('#sheet .sheet-scroll');
  if(detailsHost?.parentNode){detailsHost.insertAdjacentElement('afterend',infoCard);infoCard.insertAdjacentElement('afterend',sources)}
  else if(sheetScroll)sheetScroll.append(infoCard,sources);
  document.getElementById('map')?.append(overlay);
  this.overlay=overlay;this.surface=surface;this.info=info;
 }
 async open(vehicle,point,heading,duration,zoom){
  if(!this.enabled)return false;
  this.close({sync:false});
  const seq=++this.sequence;this.active=true;this.tapStartedAt=performance.now();
  const target=target3DCamera(point,zoom,heading,duration);
  if(!target){this.close({sync:false});return false}
  this.vehicleKey=vehicle?.key||null;
  this.lastPoint={lat:Number(point.lat),lng:Number(point.lng??point.lon)};this.lastHeading=heading;
  this.openTimedOut=false;
  this.makeOverlay(vehicle);
  document.body.classList.add('sr83-cinematic');
  // Keep the underlying 2D map still. On tap, the 3D map takes over directly;
  // its camera starts from the current map scale and flies toward the vehicle.
  // No preliminary zoom-out, hidden 2D flight or fixed distant intro pose.
  try{this.leaflet.stop()}catch(error){console.info('Radar 8.3: could not stop 2D camera',error)}
  // Full startup can include up to 11s for MapLibre, 11s for the style,
  // 7.2s for vector tiles and 2.2s for the first model frame. The old 8s
  // watchdog always raced those legitimate loading stages on slower phones.
  this.openTimeout=setTimeout(()=>{
   if(seq!==this.sequence||this.ready)return;
   this.openTimedOut=true;
   const error=Error('3D-Start nach 35 Sekunden abgebrochen');
   this.contextLostCancel?.();
   this.close({sync:false});
   this.onFailure(error);
  },35000);
  try{
   const [lib,T]=await Promise.all([loadMapLibre(),loadThree()]);
   if(seq!==this.sequence)return false;
   if(typeof lib.supported==='function'&&!lib.supported())throw Error('WebGL not supported by this browser');
   const tapCamera=handoff3DCamera(this.leaflet.getCenter?.(),this.leaflet.getZoom?.());
   if(!tapCamera)throw Error('Initial live camera position invalid');
   const map=new lib.Map({
    container:this.surface,style:VECTOR_STYLE,center:tapCamera.center,zoom:tapCamera.zoom,
    bearing:tapCamera.bearing,pitch:tapCamera.pitch,maxZoom:20.4,maxPitch:80,minZoom:3,
    antialias:false,fadeDuration:0,renderWorldCopies:false,
    pixelRatio:Math.min(2,Math.max(1,Number(window.devicePixelRatio)||1)),
    attributionControl:true,interactive:true
   });
   this.map=map;
   // 9.7: Ein verlorener WebGL-Kontext (GPU-Neustart, Speicherdruck, zu
   // viele offene Kontexte) darf die 3D-Ansicht nicht ewig blockieren. Ohne
   // diesen Handler wartet die App auf Timeouts und der Nutzer schaut
   // minutenlang auf eine leere Karte.
   const canvas=map.getCanvas();
   const onContextLost=event=>{
    try{event.preventDefault()}catch{}
    console.info('Radar 8.3: WebGL-Kontext verloren, zurueck auf die 2D-Karte');
    this.contextLost=true;
     // Das Warten auf den Kartenstil sofort beenden, nicht erst nach dem
     // Timeout. close() erhoeht die sequence, damit open() false liefert
     // und die 2D-Karte die Fahrt uebernimmt.
     this.contextLostCancel?.();
    // close() erhoeht die sequence. Damit liefert open() sofort false und
    // die 2D-Karte uebernimmt die Fahrt.
    this.close({sync:false});
    this.onFailure(Error('WebGL-Kontext verloren'));
   };
   canvas?.addEventListener('webglcontextlost',onContextLost);
   this.contextLostHandler=onContextLost;
   this.contextCanvas=canvas;
   this.visibilityHandler=()=>{if(document.hidden)map.stop();else map.triggerRepaint()};
   document.addEventListener('visibilitychange',this.visibilityHandler);
   await new Promise((resolve,reject)=>{
    let done=false;
    const end=e=>{if(done)return;done=true;clearTimeout(timeout);map.off('load',loaded);map.off('error',failed);this.contextLostCancel=null;e?reject(e):resolve()};
    const loaded=()=>end();
    const failed=e=>{if(!map.isStyleLoaded?.())end(e?.error||Error('Map style failed'))};
    // 9.7: Ein Kontextverlust beendet das Warten sofort, nicht erst nach
    // dem Timeout.
    this.contextLostCancel=()=>end(Error('WebGL context lost'));
    const timeout=setTimeout(()=>end(Error('3D map style timed out')),11000);
    map.on('load',loaded);map.on('error',failed);
    if(map.loaded?.())end();
   });
   if(seq!==this.sequence)return false;
   // The 3D map takes over as soon as its style is ready. Start from the
   // current map scale (not a zoomed-out establishing shot) and begin the
   // camera animation immediately; vector tiles and the vehicle model stream
   // in behind the visible 3D map without restarting the flight.
   this.flight={start:tapCamera,target};
   map.jumpTo(tapCamera);
   map.on('dragstart',()=>this.interrupt());
   map.getCanvas().addEventListener('touchstart',()=>this.interrupt(),{passive:true});
   map.getCanvas().addEventListener('wheel',()=>this.interrupt(),{passive:true});
   map.resize();map.triggerRepaint();
   this.overlay.classList.add('sr83-ready');
   this.loading?.remove();this.loading=null;
   this.replay();
   await waitFor3DScene(map);
   if(seq!==this.sequence)return false;
   try{build3DBuildings(map)}catch(error){console.info('3D building fallback',error)}
   // iPhone/iPad default: pitched vector buildings, no heavy remote DEM tiles.
   // Terrain is optional via ?terrain=on after successful device testing.
   if(use3DTerrain(location.search))enable3DTerrain(map);
   const layer=make3DVehicleLayer(T,lib,map,vehicle,point,heading,info=>{
    if(seq!==this.sequence||this.layer!==layer||this.map!==map||this.vehicleKey!==(vehicle?.key||null))return;
    this.onModel(info);
    if(info.kind==='error'){
     this.close({sync:false});
     this.onFailure(Error('3D-Fahrzeugmodell konnte nicht geladen werden'));
     return;
    }
    if(this.credit){
     this.credit.textContent=info.kind==='error'
      ?'Referenzmodell nicht geladen · '+info.error
      :modelCreditText(info.credit,info.kind==='real',vehicle?.kind);
    }
    if(this.info)this.info.textContent='3D · '+selectedVehicleLabel(vehicle);
   });
   this.layer=layer;
   map.addLayer(layer);
   await waitFor3DModel(map,this.layer);
   if(seq!==this.sequence)return false;
   this.info.textContent='3D · '+selectedVehicleLabel(vehicle);
   // The 3D map and camera were already visible/moving while the model loaded.
   // Mark the vehicle live now; never restart the camera when its model appears.
   map.resize();map.triggerRepaint();
   clearTimeout(this.openTimeout);this.openTimeout=0;
   this.ready=true;
   return true;
  }catch(error){
   if(seq===this.sequence){
    console.info('Radar 8.3: pitched 3D view unavailable, restoring reliable 2D map',error);
    this.close({sync:false});
    this.onFailure(error);
   }
   return false;
  }
 }
 focus(){
  if(!this.map)return;
  this.touched=false;
  if(this.lastPoint)this.map.easeTo({center:[this.lastPoint.lng,this.lastPoint.lat],bearing:Number.isFinite(this.lastHeading)?(this.lastHeading+58)%360:this.map.getBearing(),duration:650,essential:false});
 }
 free(){this.touched=true;this.map?.stop()}
 replay(){
  if(!this.map||!this.flight)return;
  const {start,target}=this.flight;
  this.map.stop();
  this.flying=true;
  clearTimeout(this.flightTimer);
  if(prefersReducedMotion())this.map.jumpTo(target);
  else{this.map.jumpTo(start);this.map.easeTo({...target,easing:t=>{const x=Math.max(0,Math.min(1,t));return x*x*x*(x*(x*6-15)+10)},essential:true});}
  this.flightTimer=setTimeout(()=>{this.flying=false},(Number(target.duration)||0)+150);
 }
 interrupt(){
  if(!this.active||this.touched)return;
  this.touched=true;
  this.map?.stop();
  this.onManual();
 }
 update(vehicle,point,heading){
  if(!this.ready||!this.layer||!point||(this.vehicleKey&&vehicle?.key!==this.vehicleKey))return;
  const quality=positionFreshness(vehicle);
  if(quality.fresh){this.lastPoint={lat:Number(point.lat),lng:Number(point.lng??point.lon)};this.lastHeading=heading;this.layer.update(point,heading)}
  const positionLabel=quality.fresh?(quality.estimated?'Geschätzte Position':'Feedposition')+' · '+quality.label:'Position veraltet · '+quality.label;
  if(this.info)this.info.textContent='3D · '+selectedVehicleLabel(vehicle);
  if(this.vehicleMeta)this.vehicleMeta.textContent=(selectedVehicleMeta(vehicle)||'')+(selectedVehicleMeta(vehicle)?' · ':'')+positionLabel;
  // The camera follows the vehicle while the user has not taken over. A
  // deliberate gesture always wins; the model keeps its real feed position.
  if(!quality.fresh||this.touched||this.flying||!this.map)return;
  const decision=followDecision({touched:this.touched,center:this.map.getCenter?.(),point:this.lastPoint});
  if(!decision)return;
  this.map.easeTo({center:decision.center,bearing:Number.isFinite(heading)?(heading+58)%360:this.map.getBearing(),duration:900,essential:false});
 }
 close({sync=true}={}){
  const oldMap=this.map;
  if(sync&&oldMap&&this.ready){
   try{
    const center=oldMap.getCenter(),zoom=oldMap.getZoom();
    this.leaflet.setView([center.lat,center.lng],Math.min(18,Math.max(3,zoom-1)),{animate:false});
   }catch{}
  }
  this.contextLostCancel?.();
  this.sequence++;this.ready=false;this.active=false;this.touched=false;this.layer=null;this.map=null;this.vehicleKey=null;this.vehicleMeta=null;this.flight=null;this.flying=false;this.lastPoint=null;this.lastHeading=null;clearTimeout(this.flightTimer);clearTimeout(this.openTimeout);this.openTimeout=0;
  if(this.visibilityHandler){document.removeEventListener('visibilitychange',this.visibilityHandler);this.visibilityHandler=null;}
  if(oldMap)try{oldMap.stop();oldMap.remove()}catch(error){console.info('3D map cleanup',error)}
  this.overlay?.remove();this.overlay=null;this.surface=null;this.loading=null;
  document.querySelectorAll('#sheet .sr83-info-card,#sheet .sr83-sources').forEach(node=>node.remove());
  document.body.classList.remove('sr83-cinematic');
   if(this.contextCanvas&&this.contextLostHandler){
    try{this.contextCanvas.removeEventListener('webglcontextlost',this.contextLostHandler)}catch{}
   }
   this.contextCanvas=null;this.contextLostHandler=null;this.contextLostCancel=null;
 }
}
