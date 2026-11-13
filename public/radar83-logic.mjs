/* Pure 3D cinematic decisions; keep the fallback independently testable. */
import {formatStationName,sourceLabel} from './radar92-details.mjs?v=9.9.5&rev=details-1';
export const MAPLIBRE_VERSION='4.7.1';
export const VECTOR_STYLE='https://tiles.openfreemap.org/styles/dark';
export const TERRAIN_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// Cinematic 3D is enabled by default on every device.
// ?radar3d=off is retained only as an emergency debugging opt-out.
export const FEATURE_FLAGS=Object.freeze({cinematic3D:true});

// Display the selected feed identity, never the generic reference-model name.
function usableVehicleText(value){
 const text=value==null?'':String(value).trim();
 return text&&!/^(?:[-ââ]+|n\/?a|null|undefined|unbekannt|nicht verfÃ¼gbar|fahrtziel unbekannt)$/i.test(text)?text:'';
}
export function selectedVehicleLabel(vehicle){
 const name=usableVehicleText(vehicle?.name);
 if(vehicle?.kind==='bus')return name&&name!=='Linie unbekannt'?'Bus Â· Linie '+name:'Bus Â· Linie unbekannt';
 if(vehicle?.kind==='train')return name&&name!=='Zugnummer unbekannt'?'Zug Â· '+name:'Zug Â· Nummer unbekannt';
 return 'Fahrzeug';
}
export function selectedVehicleMeta(vehicle){
 const destination=usableVehicleText(vehicle?.headsign);
 const id=usableVehicleText(vehicle?.vehicleId);
 const source=usableVehicleText(vehicle?.source);
 const parts=[];
 if(destination)parts.push('Ziel: '+formatStationName(destination));
 if(id)parts.push('Fahrzeug: '+id);
 if(source)parts.push('Datenquelle: '+sourceLabel(source));
 return parts.join(' Â· ');
}

export function enabled3D(search=''){
 try{const value=new URLSearchParams(search).get('radar3d');return FEATURE_FLAGS.cinematic3D?value!=='off':value==='on'}catch{return false}
}
export function target3DCamera(point,zoom,heading=null,duration=4300){
 const lng=Number(point?.lng??point?.lon),lat=Number(point?.lat);
 if(!Number.isFinite(lng)||!Number.isFinite(lat)||lat< -85||lat>85||lng< -180||lng>180)return null;
 return {
  center:[lng,lat],
  zoom:Math.max(18.6,Math.min(20.4,Number(zoom)||19.0)),
  pitch:48,
   // Finish in a steeper rear-quarter view, without a near half-turn.
   bearing:Number.isFinite(heading)?((heading+8)%360+360)%360:8,
  duration:Math.max(0,Math.min(8000,Number(duration)||0))
 };
}
export function readProjectionMatrix(input){
 const matrix=input?.defaultProjectionData?.mainMatrix??input?.modelViewProjectionMatrix??input;
 return matrix && matrix.length===16 && [...matrix].every(Number.isFinite)?matrix:null;
}

// Start the cinematic noticeably farther away, then descend toward the real
// vehicle position. Camera position only; never change feed coordinates.
// Transfer the current Leaflet camera to MapLibre without changing the
// geographic center or apparent scale. Leaflet uses 256px tiles while
// MapLibre vector styles use 512px tiles, hence the one-level zoom offset.
export function handoff3DCamera(center,zoom){
 const lat=Number(center?.lat),lng=Number(center?.lng??center?.lon),z=Number(zoom);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -85||lat > 85||lng < -180||lng > 180)return null;
 return {center:[lng,lat],zoom:Math.max(3,Math.min(20.4,Number.isFinite(z)?z-1:15)),pitch:0,bearing:0};
}
// Start the visible 3D approach most of the way toward the tapped vehicle.
// This keeps the transition anchored to the tap without a large sideways sweep.
export function approach3DCamera(start,target,progress=.75){
 const from=start?.center,to=target?.center,t=Number(progress);
 if(!Array.isArray(from)||!Array.isArray(to)||from.length<2||to.length<2||
    !from.slice(0,2).every(Number.isFinite)||!to.slice(0,2).every(Number.isFinite)||!Number.isFinite(t))return null;
 const amount=Math.max(0,Math.min(1,t));
 const result={...start,center:[from[0]+(to[0]-from[0])*amount,from[1]+(to[1]-from[1])*amount]};
 const fromBearing=Number(start.bearing),toBearing=Number(target.bearing);
 if(Number.isFinite(fromBearing)&&Number.isFinite(toBearing)){
  const turn=((toBearing-fromBearing+540)%360)-180;
  result.bearing=((fromBearing+turn*amount)%360+360)%360;
 }
 return result;
}

export function start3DCamera(point, heading=null, finalZoom=17){
 const lat=Number(point?.lat),lng=Number(point?.lng??point?.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -85||lat > 85)return null;
 const finalBearing=Number.isFinite(heading)?((heading%360)+360)%360:0;
 const direction=finalBearing*Math.PI/180;
 const meters=450,latOffset=meters/111320;
 const lngOffset=latOffset/Math.max(.2,Math.cos(lat*Math.PI/180));
 return {
  center:[lng-Math.sin(direction)*lngOffset,lat-Math.cos(direction)*latOffset],
   zoom:Math.max(13.2,Math.min(16.8,Number(finalZoom)-2.2)),
   pitch:68,
   bearing:(finalBearing+112)%360
 };
}
// DEM tiles consume substantial GPU memory on mobile Safari. The real pitched
// vector map and Three.js train work without DEM; terrain is opt-in.
export function use3DTerrain(search=''){
 try{return new URLSearchParams(search).get('terrain')==='on'}catch{return false}
}
// Follow the cinematic camera with the vehicle, but only while the user has
// not taken over the camera. A deliberate gesture always wins: the model
// keeps its real feed position, the camera simply stops chasing it.
// Returns the new map center plus the distance that has to be covered, or
// null when the camera must stay where it is.
export function followDecision({touched=false,center=null,point=null,thresholdMeters=12}={}){
  if(touched||!center||!point)return null;
  const lat=Number(point.lat),lng=Number(point.lng??point.lon);
  const cLat=Number(center.lat),cLng=Number(center.lng??center.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(cLat)||!Number.isFinite(cLng))return null;
  if(lat< -85||lat>85||cLat< -85||cLat>85)return null;
  const cos=Math.max(.2,Math.cos(lat*Math.PI/180));
  const meters=Math.hypot((cLng-lng)*cos,(cLat-lat))*111195;
  if(!Number.isFinite(meters)||meters<thresholdMeters)return null;
  return {center:[lng,lat],meters:Math.round(meters)};
}
// The 3D cinematic is a camera move, not a page transition. It has to feel
// A deliberate cinematic approach: begin well behind the vehicle and ease
// into a rear-follow composition. Scene/model loading continues in parallel.
export function cinematicDuration(distanceKm=0,base=4300){
  const d=Number(distanceKm);
  const extra=Number.isFinite(d)&&d>2?Math.min(350,Math.sqrt(d-2)*45):0;
  const requested=Number(base);
  const duration=Math.max(650,Math.min(4850,Number.isFinite(requested)&&requested>0?requested:4300));
  return Math.round(Math.max(650,Math.min(5200,duration+extra)));
}
// If the system asks for less motion, the cinematic camera must not fly.
// It jumps straight to the vehicle instead.
export function prefersReducedMotion(){
  try{return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}
  catch{return false}
}

// The direction a point of the model points to in the world.
//
// The 3D transform of the vehicle layer is:
//   translate * scale(s, -s, s) * rotateX(90 Grad) * rotateY(-heading)
// A model whose nose sits at -z therefore points exactly along the heading,
// that is the direction of travel. This function is the reference for that:
// it answers "where does this local direction end up in the world?".
//
// MapLibre's world: +x = east, +y = south, +z = up. The heading is the
// bearing, clockwise from north.
export function modelWorldDirection(local, heading){
  const x=Number(local?.[0])||0, y=Number(local?.[1])||0, z=Number(local?.[2])||0;
  const h=(Number(heading)||0)*Math.PI/180;
  const c=Math.cos(h), s=Math.sin(h);
  // rotateY(-heading)
  const a=c*x-s*z, b=s*x+c*z;
  // rotateX(90 Grad) and scale(1,-1,1) turn that into east, south and up
  return {east:a, south:b, up:y};
}

// The bearing in degrees a local direction ends up pointing to.
export function modelWorldBearing(local, heading){
  const d=modelWorldDirection(local,heading);
  return Math.atan2(d.east,-d.south)*180/Math.PI;
}
