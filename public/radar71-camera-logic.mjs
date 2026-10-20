/* Radar 7.1 cinematic camera decisions: no imaginary location or direction. */
// Short trips should feel immediate; long trips deserve a longer cinematic flight.
// User-tested pacing: ~3.2s locally, smoothly up to 5s for a distant selection.
export function focusDuration(reduced=false,fromZoom=10,toZoom=17,distanceKm=0){
 if(reduced)return 0;
 const zoomGap=Math.max(0,Math.abs(Number(toZoom)-Number(fromZoom))||0);
 const distance=Math.max(0,Number(distanceKm)||0);
 return Math.round(Math.max(3200,Math.min(5000,3200+zoomGap*130+Math.sqrt(distance)*125)));
}
export function focusZoom(current,maxZoom=18,kind='train'){
 const actual=Number.isFinite(Number(current))?Number(current):10;
 const maximum=Number.isFinite(Number(maxZoom))?Number(maxZoom):18;
 const desired=kind==='bus'?17.5:17;
 return Math.max(Math.min(maximum,actual),Math.min(maximum,desired));
}
export function focusDistanceKm(from,to){
 if(!from||!to)return 0;
 const rad=Math.PI/180,lat1=Number(from.lat),lat2=Number(to.lat),lon1=Number(from.lng??from.lon),lon2=Number(to.lng??to.lon);
 if(![lat1,lat2,lon1,lon2].every(Number.isFinite))return 0;
 const a=Math.sin((lat2-lat1)*rad/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
export function focusHeading(vehicle,now=Date.now()){
 if(vehicle?.bearing===null||vehicle?.bearing===undefined||String(vehicle.bearing).trim()==="")return null;
 const angle=Number(vehicle?.bearing),timestamp=Number(vehicle?.timestamp);
 if(vehicle?.stale||!Number.isFinite(angle)||angle<0||angle>=360||
    !Number.isFinite(timestamp)||timestamp<1e9||now/1000-timestamp>120||
    now/1000-timestamp< -30)return null;
 return angle;
}
export function validFocusPoint(vehicle,markerLatLng){
 const pos=markerLatLng??{lat:vehicle?.lat,lng:vehicle?.lon};
 const lat=Number(pos?.lat),lng=Number(pos?.lng??pos?.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180)return null;
 return {lat,lng};
}
export function shortestRotation(from,to){
 const initial=((from%360)+360)%360,goal=((to%360)+360)%360;
 return ((goal-initial+540)%360)-180;
}
