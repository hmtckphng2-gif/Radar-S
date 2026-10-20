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
  zoom:Math.max(12,Math.min(18,Number(zoom)||17)),
  pitch:72,
  bearing:Number.isFinite(heading)?(heading+36)%360:36,
  duration:Math.max(0,Math.min(5000,Number(duration)||0))
 };
}
export function readProjectionMatrix(input){
 const matrix=input?.defaultProjectionData?.mainMatrix??input?.modelViewProjectionMatrix??input;
 return matrix && matrix.length===16 && [...matrix].every(Number.isFinite)?matrix:null;
}
