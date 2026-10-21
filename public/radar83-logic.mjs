/* Pure 3D cinematic decisions; keep the fallback independently testable. */
export const MAPLIBRE_VERSION='4.7.1';
export const VECTOR_STYLE='https://tiles.openfreemap.org/styles/dark';
export const TERRAIN_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export function enabled3D(search=''){
 try{return new URLSearchParams(search).get('radar3d')!=='off'}catch{return true}
}
export function target3DCamera(point,zoom,heading=null,duration=3700){
 const lng=Number(point?.lng??point?.lon),lat=Number(point?.lat);
 if(!Number.isFinite(lng)||!Number.isFinite(lat)||lat< -85||lat>85||lng< -180||lng>180)return null;
 return {
  center:[lng,lat],
  zoom:Math.max(17.8,Math.min(18,Number(zoom)||17.8)),
  pitch:62,
  bearing:Number.isFinite(heading)?(heading+36)%360:36,
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
  zoom:Math.max(12,Math.min(15,Number(finalZoom)-2.6)),
  pitch:38,
  bearing:(finalBearing+325)%360
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