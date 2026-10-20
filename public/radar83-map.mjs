/* Radar 8.3 — actual pitched vector/terrain 3D map with a shared WebGL vehicle layer.
 * The original Leaflet map stays intact underneath. Only selected cinematic
 * vehicles initialize MapLibre; errors or ?radar3d=off fall back to Radar 8.2.
 */
import {loadThree} from './radar82-3d.mjs';
import {makeVehicleMesh,vehicleKind,VEHICLE_SPECS,modelYawRadians} from './radar83-model.mjs';
import {MAPLIBRE_VERSION,VECTOR_STYLE,TERRAIN_TILES,enabled3D,target3DCamera,readProjectionMatrix} from './radar83-logic.mjs';

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
export function build3DBuildings(map){
 if(!map.getSource('openmaptiles')||map.getLayer('sr83-buildings'))return false;
 const firstLabel=map.getStyle()?.layers?.find(layer=>layer.type==='symbol')?.id;
 map.addLayer({
  id:'sr83-buildings',type:'fill-extrusion',source:'openmaptiles', 'source-layer':'building',
  minzoom:14,
  filter:['has','render_height'],
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
export function make3DVehicleLayer(T,lib,map,vehicle,point,heading){
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
   this.renderer=new T.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true,powerPreference:'low-power'});
   this.renderer.autoClear=false;
  },
  update(p,h){
   origin.lat=p.lat;origin.lng=p.lng;heading=h;this.map?.triggerRepaint();
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
    this.renderer.resetState();
    this.renderer.render(this.scene,this.camera);
    this.didRender=true;
   }catch(error){if(!this.renderError){console.warn('Radar 8.3 render failed',error);this.renderError=true}}
  },
  onRemove(){
   const used=new Set();
   this.object?.traverse(node=>{
    node.geometry?.dispose?.();
    const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const material of materials)if(material&&!used.has(material)){used.add(material);material.dispose?.()}
   });
   this.renderer?.dispose();
   this.renderer=null;
  }
 };
}
export class Radar83Cinematic {
 constructor(leaflet,{onExit=()=>{},onManual=()=>{},onFailure=()=>{}}={}){
  this.leaflet=leaflet;this.onExit=onExit;this.onManual=onManual;this.onFailure=onFailure;
  this.sequence=0;this.map=null;this.overlay=null;this.layer=null;
  this.ready=false;this.touched=false;this.active=false;
 }
 get enabled(){return enabled3D(location.search)}
 makeOverlay(){
  const overlay=document.createElement('div');overlay.className='sr83-viewport';overlay.id='sr83Viewport';
  const surface=document.createElement('div');surface.className='sr83-map';overlay.append(surface);
  const toolbar=document.createElement('div');toolbar.className='sr83-toolbar';
  const info=document.createElement('span');info.className='sr83-label';info.textContent='3D CINEMATIC';
  const back=document.createElement('button');back.className='sr83-back';back.type='button';back.textContent='↩ 2D-Karte';
  back.setAttribute('aria-label','Zur normalen 2D-Karte zurückkehren');
  back.addEventListener('click',e=>{e.stopPropagation();this.close();this.onExit()});
  toolbar.append(info,back);overlay.append(toolbar);
  const credit=document.createElement('div');credit.className='sr83-credit';
  credit.textContent='3D-Modell schematisch · Position aus dem Datenfeed · Ziehen zum Schwenken';
  overlay.append(credit);
  document.getElementById('map')?.append(overlay);
  this.overlay=overlay;this.surface=surface;this.info=info;
 }
 async open(vehicle,point,heading,duration,zoom){
  if(!this.enabled)return false;
  this.close({sync:false});
  const seq=++this.sequence;this.active=true;
  this.makeOverlay();
  try{
   const [lib,T]=await Promise.all([loadMapLibre(),loadThree()]);
   if(seq!==this.sequence)return false;
   if(typeof lib.supported==='function'&&!lib.supported())throw Error('WebGL not supported by this browser');
   const old=this.leaflet.getCenter(),oldZoom=this.leaflet.getZoom();
   const map=new lib.Map({
    container:this.surface,style:VECTOR_STYLE,center:[old.lng,old.lat],zoom:oldZoom,
    bearing:0,pitch:0,maxZoom:19,maxPitch:80,minZoom:3,
    antialias:true,fadeDuration:0,renderWorldCopies:false,
    attributionControl:true,interactive:true
   });
   this.map=map;
   await new Promise((resolve,reject)=>{
    let done=false;
    const end=e=>{if(done)return;done=true;clearTimeout(timeout);map.off('load',loaded);map.off('error',failed);e?reject(e):resolve()};
    const loaded=()=>end();
    const failed=e=>{if(!map.isStyleLoaded?.())end(e?.error||Error('Map style failed'))};
    const timeout=setTimeout(()=>end(Error('3D map tiles timed out')),12000);
    map.on('load',loaded);map.on('error',failed);
    if(map.loaded?.())end();
   });
   if(seq!==this.sequence)return false;
   try{build3DBuildings(map)}catch(error){console.info('3D building fallback',error)}
   // Conserve GPU memory on low-memory devices; buildings and pitch remain 3D.
   const lowMemory=Number(navigator.deviceMemory||0)>0&&Number(navigator.deviceMemory)<4;
   if(!lowMemory)enable3DTerrain(map);
   this.layer=make3DVehicleLayer(T,lib,map,vehicle,point,heading);
   map.addLayer(this.layer);
   const target=target3DCamera(point,zoom,heading,duration);
   if(!target)throw Error('Vehicle has no valid coordinates');
   const kind=vehicleKind(vehicle);
   this.info.textContent='3D CINEMATIC · '+(kind==='train'?'FLIRT-Stil':'Linienbus');
   this.overlay.classList.add('sr83-ready');
   document.body.classList.add('sr83-cinematic');
   this.ready=true;
   map.resize();map.triggerRepaint();
   map.on('dragstart',()=>this.interrupt());
   map.getCanvas().addEventListener('touchstart',()=>this.interrupt(),{passive:true});
   map.getCanvas().addEventListener('wheel',()=>this.interrupt(),{passive:true});
   // MapLibre animates camera center, height (zoom), tilt and bearing together.
   // The model remains geographically anchored and rotates ONLY with vehicle heading.
   if(duration===0)map.jumpTo(target);
   else map.easeTo({...target,easing:t=>t*t*(3-2*t),essential:true});
   // A MapLibre map without its shared Three.js model is not a successful 3D mode.
   // If iOS WebGL refuses to render it, restore Leaflet rather than showing an empty scene.
   setTimeout(()=>{
    if(seq!==this.sequence||!this.ready||this.layer?.didRender)return;
    console.info('Radar 8.3 WebGL model did not render, restoring 2D camera');
    this.close({sync:false});this.onFailure();
   },2200);
   return true;
  }catch(error){
   if(seq===this.sequence){
    console.info('Radar 8.3: 3D failed; retaining established Leaflet camera',error);
    this.close({sync:false});
   }
   return false;
  }
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
  // Never override a user's map swipe to follow a newer feed location.
 }
 close({sync=true}={}){
  const oldMap=this.map;
  if(sync&&oldMap&&this.ready){
   try{
    const center=oldMap.getCenter(),zoom=oldMap.getZoom();
    this.leaflet.setView([center.lat,center.lng],Math.min(18,Math.max(3,zoom)),{animate:false});
   }catch{}
  }
  this.sequence++;this.ready=false;this.active=false;this.touched=false;this.layer=null;this.map=null;
  if(oldMap)try{oldMap.stop();oldMap.remove()}catch(error){console.info('3D map cleanup',error)}
  this.overlay?.remove();this.overlay=null;this.surface=null;
  document.body.classList.remove('sr83-cinematic');
 }
}
