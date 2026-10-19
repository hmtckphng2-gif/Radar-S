/* Radar 7.1 cinematic camera decisions: no imaginary location or direction. */
export function focusDuration(reduced=false,fromZoom=10,toZoom=14){
 if(reduced)return 0;
 const difference=Math.abs(Number(toZoom)-Number(fromZoom));
 return Math.round(Math.min(1950,Math.max(1300,1450+difference*70)));
}
export function focusZoom(current,maxZoom=18,kind='train'){
 const actual=Number.isFinite(Number(current))?Number(current):10;
 const maximum=Number.isFinite(Number(maxZoom))?Number(maxZoom):18;
 const desired=kind==='bus'?15:14.5;
 return Math.max(Math.min(maximum,actual),Math.min(maximum,desired));
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
