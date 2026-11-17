import {sameStationName} from './radar92-details.mjs?v=9.9.5&rev=details-1';
function metersBetween(a,b){
 const lat1=Number(a?.lat),lat2=Number(b?.lat),lon1=Number(a?.lon),lon2=Number(b?.lon);
 if(![lat1,lat2,lon1,lon2].every(Number.isFinite))return Infinity;
 const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
 const q=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,q))));
}
export function groupNearbyStops(stations,radiusMeters=140){
 const groups=[];
 for(const stop of (stations||[]).filter(s=>s&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))).sort((a,b)=>(Number(a.distance)||0)-(Number(b.distance)||0))){
  const group=groups.find(g=>sameStationName(g.station.name,stop.name)&&metersBetween(g.station,stop)<=radiusMeters);
  if(group){group.members.push(stop);if(Number(stop.distance)<Number(group.station.distance))group.station=stop;}
  else groups.push({station:stop,members:[stop],distance:Number(stop.distance)||0});
 }
 return groups.sort((a,b)=>a.distance-b.distance);
}
export function nextNearbyDepartures(rows,nowSeconds,limit=3){
 const now=Number(nowSeconds);if(!Number.isFinite(now))return [];
 return (rows||[]).map(row=>{
  const live=row?.forecast!==null&&row?.forecast!==undefined&&Number.isFinite(Number(row.forecast));
  const expected=live?Number(row.forecast):Number(row?.sec);
  return {...row,expectedSeconds:expected,minutes:Number.isFinite(expected)?Math.max(0,Math.round((expected-now)/60)):null,live};
 }).filter(row=>Number.isFinite(row.expectedSeconds)&&row.expectedSeconds>=now-60)
  .sort((a,b)=>a.expectedSeconds-b.expectedSeconds).slice(0,Math.max(0,Math.min(3,Number(limit)||3)));
}
