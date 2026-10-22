/* Radar 8.3 — actual pitched vector/terrain 3D map with a shared WebGL vehicle layer.
 * The original Leaflet map stays intact underneath. Only selected cinematic
 * vehicles initialize MapLibre; errors or ?radar3d=off fall back to Radar 8.2.
 */
import {loadThree,loadVehicleModel,modelCreditText,makeVehicleMesh,makeContactShadow,vehicleKind,VEHICLE_SPECS,modelYawRadians} from './radar83-model.mjs?v=9.8.0';
import {MAPLIBRE_VERSION,VECTOR_STYLE,TERRAIN_TILES,enabled3D,target3DCamera,start3DCamera,use3DTerrain,readProjectionMatrix,followDecision,prefersReducedMotion} from './radar83-logic.mjs?v=9.8.0';

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
 // Resource fetch only; do not allocate a WebGL context until user selects a vehicle.
 loadMapLibre().catch(()=>{});
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
    if(map.isStyleLoaded?.() && map.getSource('openmaptiles') &&
       map.isSourceLoaded?.('openmaptiles') && map.areTilesLoaded?.())finish();
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
  // Most OSM buildings lack measured heights; a modest illustration is better
  // than a missing 3D city. Unknown heights remain schematic, not claimed real.
  paint:{
   'fill-extrusion-color':'#263848',
   'fill-extrusion-opacity':.88,
   'fill-extrusion-height':['to-number',['get','render_height'],8],
   'fill-extrusion-base':['to-number',['get','render_min_height'],0]
  }
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
 const used=new Set();
 object.traverse(node=>{
  node.geometry?.dispose?.();
  const materials=Array.isArray(node.material)?node.material:[node.material];
  for(const material of materials)if(material&&!used.has(material)){used.add(material);material.dispose?.()}
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
   this.renderer=new T.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true,powerPreference:'low-power'});
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
   }).catch(()=>{});
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
  this.ready=false;this.touched=false;this.active=false;this.flight=null;this.flying=false;this.flightTimer=0;
 }
 get enabled(){return enabled3D(location.search)}
 makeOverlay(){
  const overlay=document.createElement('div');overlay.className='sr83-viewport';overlay.id='sr83Viewport';
  const surface=document.createElement('div');surface.className='sr83-map';overlay.append(surface);
  const toolbar=document.createElement('div');toolbar.className='sr83-toolbar';
  const info=document.createElement('span');info.className='sr83-label';info.textContent='3D · FLIRT';
  const replay=document.createElement('button');replay.className='sr83-replay';
  replay.type='button';replay.textContent='↻ Flug';
  replay.setAttribute('aria-label','3D-Kameraflug wiederholen');
  replay.addEventListener('click',e=>{e.stopPropagation();this.replay()});
  const back=document.createElement('button');back.className='sr83-back';back.type='button';back.textContent='↩ 2D';
  back.setAttribute('aria-label','Zur normalen 2D-Karte zurückkehren');
  back.addEventListener('click',e=>{e.stopPropagation();this.close();this.onExit()});
  toolbar.append(info,replay,back);overlay.append(toolbar);
  const credit=document.createElement('div');credit.className='sr83-credit';
  credit.textContent='3D-Modell schematisch · Position aus dem Datenfeed · Ziehen zum Schwenken';
  overlay.append(credit);
   this.credit=credit;
  document.getElementById('map')?.append(overlay);
  this.overlay=overlay;this.surface=surface;this.info=info;
 }
 async open(vehicle,point,heading,duration,zoom){
  if(!this.enabled)return false;
  this.close({sync:false});
  const seq=++this.sequence;this.active=true;
  const target=target3DCamera(point,zoom,heading,duration);
  const start=start3DCamera(point,heading,target?.zoom);
  if(!target||!start){this.close({sync:false});return false}
  this.makeOverlay();
  try{
   const [lib,T]=await Promise.all([loadMapLibre(),loadThree()]);
   if(seq!==this.sequence)return false;
   if(typeof lib.supported==='function'&&!lib.supported())throw Error('WebGL not supported by this browser');
   const map=new lib.Map({
    container:this.surface,style:VECTOR_STYLE,center:start.center,zoom:start.zoom,
    bearing:start.bearing,pitch:start.pitch,maxZoom:19,maxPitch:80,minZoom:3,
    antialias:false,fadeDuration:0,renderWorldCopies:false,
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
   };
   canvas?.addEventListener('webglcontextlost',onContextLost);
   this.contextLostHandler=onContextLost;
   this.contextCanvas=canvas;
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
   // Interrupt handlers first, so a gesture can stop the flight right away.
   map.on('dragstart',()=>this.interrupt());
   map.getCanvas().addEventListener('touchstart',()=>this.interrupt(),{passive:true});
   map.getCanvas().addEventListener('wheel',()=>this.interrupt(),{passive:true});
   // The camera starts moving NOW. Waiting for the tiles and for the model
   // before the first movement felt like a dead second on every tap.
   this.flight={start,target};
   map.resize();map.triggerRepaint();
   this.overlay.classList.add('sr83-loading');
   document.body.classList.add('sr83-cinematic');
   this.replay();
   // From here the scene is built while the camera is already flying.
   await waitFor3DScene(map);
   if(seq!==this.sequence)return false;
   try{build3DBuildings(map)}catch(error){console.info('3D building fallback',error)}
   // iPhone/iPad default: pitched vector buildings, no heavy remote DEM tiles.
   // Terrain is optional via ?terrain=on after successful device testing.
   if(use3DTerrain(location.search))enable3DTerrain(map);
   this.layer=make3DVehicleLayer(T,lib,map,vehicle,point,heading,info=>{
    this.onModel(info);
    if(this.credit)this.credit.textContent=modelCreditText(info.credit,info.kind==='real');
    if(this.info&&info.kind==='real')this.info.textContent='3D · '+(info.credit?.title||'Fahrzeug');
   });
   map.addLayer(this.layer);
   await waitFor3DModel(map,this.layer);
   if(seq!==this.sequence)return false;
   const kind=vehicleKind(vehicle);
   this.info.textContent=kind==='train'?'3D · FLIRT-Stil':'3D · Linienbus';
   this.overlay.classList.add('sr83-ready');
   this.ready=true;
   return true;
  }catch(error){
   if(seq===this.sequence){
    console.info('Radar 8.3: pitched 3D view unavailable, restoring reliable 2D map',error);
    this.close({sync:false});
   }
   return false;
  }
 }
 replay(){
  if(!this.map||!this.flight)return;
  const {start,target}=this.flight;
  this.map.stop();
  this.flying=true;
  clearTimeout(this.flightTimer);
  if(prefersReducedMotion())this.map.jumpTo(target);
  else{this.map.jumpTo(start);this.map.easeTo({...target,easing:t=>t*t*(3-2*t),essential:true});}
  this.flightTimer=setTimeout(()=>{this.flying=false},(Number(target.duration)||0)+150);
 }
 interrupt(){
  if(!this.active||this.touched)return;
  this.touched=true;
  this.map?.stop();
  this.onManual();
 }
 update(vehicle,point,heading){
  if(!this.ready||!this.layer||!point)return;
  this.layer.update(point,heading);
  // The camera follows the vehicle while the user has not taken over. A
  // deliberate gesture always wins; the model keeps its real feed position.
  if(this.touched||this.flying||!this.map)return;
  const decision=followDecision({touched:this.touched,center:this.map.getCenter?.(),point});
  if(!decision)return;
  this.map.easeTo({center:decision.center,duration:900,essential:false});
 }
 close({sync=true}={}){
  const oldMap=this.map;
  if(sync&&oldMap&&this.ready){
   try{
    const center=oldMap.getCenter(),zoom=oldMap.getZoom();
    this.leaflet.setView([center.lat,center.lng],Math.min(18,Math.max(3,zoom)),{animate:false});
   }catch{}
  }
  this.sequence++;this.ready=false;this.active=false;this.touched=false;this.layer=null;this.map=null;this.flight=null;this.flying=false;clearTimeout(this.flightTimer);
  if(oldMap)try{oldMap.stop();oldMap.remove()}catch(error){console.info('3D map cleanup',error)}
  this.overlay?.remove();this.overlay=null;this.surface=null;
  document.body.classList.remove('sr83-cinematic');
   if(this.contextCanvas&&this.contextLostHandler){
    try{this.contextCanvas.removeEventListener('webglcontextlost',this.contextLostHandler)}catch{}
   }
   this.contextCanvas=null;this.contextLostHandler=null;this.contextLostCancel=null;
 }
}
