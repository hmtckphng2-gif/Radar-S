/* Pure 3D cinematic decisions; keep the fallback independently testable. */
export const MAPLIBRE_VERSION='4.7.1';
export const VECTOR_STYLE='https://tiles.openfreemap.org/styles/dark';
export const TERRAIN_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export function enabled3D(search=''){
 try{return new URLSearchParams(search).get('radar3d')!=='off'}catch{return true}
}
export function target3DCamera(point,zoom,heading=null,duration=4300){
 const lng=Number(point?.lng??point?.lon),lat=Number(point?.lat);
 if(!Number.isFinite(lng)||!Number.isFinite(lat)||lat< -85||lat>85||lng< -180||lng>180)return null;
 return {
  center:[lng,lat],
  zoom:Math.max(18.6,Math.min(20.4,Number(zoom)||19.0)),
  pitch:38,
  bearing:Number.isFinite(heading)?(heading+58)%360:58,
  duration:Math.max(0,Math.min(5000,Number(duration)||0))
 };
}
export function readProjectionMatrix(input){
 const matrix=input?.defaultProjectionData?.mainMatrix??input?.modelViewProjectionMatrix??input;
 return matrix && matrix.length===16 && [...matrix].every(Number.isFinite)?matrix:null;
}

// Start the cinematic noticeably farther away, then descend toward the real
// vehicle position. Camera position only; never change feed coordinates.
export function start3DCamera(point, heading=null, finalZoom=17){
 const lat=Number(point?.lat),lng=Number(point?.lng??point?.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -85||lat > 85)return null;
 const finalBearing=Number.isFinite(heading)?(heading+36)%360:36;
 const direction=finalBearing*Math.PI/180;
 const meters=680,latOffset=meters/111320;
 const lngOffset=latOffset/Math.max(.2,Math.cos(lat*Math.PI/180));
 return {
  center:[lng-Math.sin(direction)*lngOffset,lat-Math.cos(direction)*latOffset],
  zoom:Math.max(12,Math.min(16,Number(finalZoom)-3.2)),
  pitch:60,
  bearing:(finalBearing+232)%360
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
// immediate: it starts on the tap and is done in about two seconds, while
// the 3D scene is still being built up in the background. The old flow
// waited for the tiles and for the model first, which felt like a dead
// second on every single tap.
export function cinematicDuration(distanceKm=0,base=4300){
  const d=Number(distanceKm);
  const extra=Number.isFinite(d)&&d>2?400:0;
  const duration=Math.max(3800,Math.min(4600,Number(base)||4300));
  return Math.min(5000,Math.round(duration+extra));
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