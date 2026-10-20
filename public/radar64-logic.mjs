/* Radar 6.4 — conservative multi-feed identity and observation quality. Pure utilities. */
const number=v=>{if(!v||v.kind!=='train'||!v.nameVerified)return '';const m=String(v.name||'').match(/(?:^|\s)(\d{2,6})(?:\s|$)/);return m?.[1]||''};
const validTs=v=>Number.isFinite(Number(v?.timestamp))&&Number(v.timestamp)>1e9;
const radians=n=>n*Math.PI/180;
export function distanceMeters(a,b){const lat1=Number(a?.lat),lat2=Number(b?.lat),lon1=Number(a?.lon),lon2=Number(b?.lon);if(![lat1,lat2,lon1,lon2].every(Number.isFinite))return Infinity;const x=radians(lat2-lat1),y=radians(lon2-lon1),q=Math.sin(x/2)**2+Math.cos(radians(lat1))*Math.cos(radians(lat2))*Math.sin(y/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)))}
export function samePhysicalTrip(a,b){
 if(!a||!b||a.key===b.key||a.source===b.source||a.kind!==b.kind||!validTs(a)||!validTs(b))return false;
 const meters=distanceMeters(a,b),age=Math.abs(a.timestamp-b.timestamp);
 // STA and STA Direct can report the EXACT SAME bus with different trip IDs
 // and a missing start_date in one feed. Match only across this known pair
 // using the operator fleet ID AND independently matching observations.
 if(a.kind==='bus'){
   const pair=new Set([a.source,b.source]);
   const sameSta=pair.size===2&&pair.has('sta')&&pair.has('sta_direct');
   const fleet=String(a.vehicleId||'');
   if(sameSta&&/^\d{2,6}$/.test(fleet)&&fleet===String(b.vehicleId||'')&&age<=20&&meters<=60)return true;
 }
 // All other matches must have the same service day, and cannot rely
 // on a shared fleet number or route number alone.
 if(!a.tripStartDate||a.tripStartDate!==b.tripStartDate||age>120)return false;
 if(a.kind==='train')return !!number(a)&&number(a)===number(b)&&meters<=1500;
 return !!a.tripId&&a.tripId===b.tripId&&!!a.routeId&&a.routeId===b.routeId&&meters<=120;
}
export function selectRepresentatives(vehicles,selectedKey){const all=[...vehicles].filter(Boolean),removed=new Set(),groups=new Map();
 const sorted=[...all].sort((a,b)=>{const delta=Number(b.timestamp||0)-Number(a.timestamp||0);if(Math.abs(delta)>10)return delta;return Number(b.source==='sta_direct')-Number(a.source==='sta_direct')||delta});
 for(let i=0;i<sorted.length;i++){const a=sorted[i];if(removed.has(a.key))continue;const group=[a];for(let j=i+1;j<sorted.length;j++){const b=sorted[j];if(removed.has(b.key))continue;if(samePhysicalTrip(a,b)){removed.add(b.key);group.push(b)}}
 const freshest=group.reduce((best,item)=>Number(item.timestamp||0)>Number(best.timestamp||0)?item:best,group[0]);
 const direct=group.find(x=>x.source==='sta_direct'&&x.lineVerified&&Number(freshest.timestamp||0)-Number(x.timestamp||0)<=5&&!x.stale);
 const chosen=direct||group.find(x=>x.key===selectedKey&&!x.stale&&Number(freshest.timestamp||0)-Number(x.timestamp||0)<=5)||freshest;groups.set(chosen.key,group.map(x=>x.source));for(const item of group)if(item.key!==chosen.key)removed.add(item.key);removed.delete(chosen.key);
 }
 return {keys:new Set(all.filter(x=>!removed.has(x.key)).map(x=>x.key)),sources:groups,duplicates:removed.size};
}
export function observationQuality(v,now=Date.now()){const age=validTs(v)?Math.max(0,Math.round(now/1000-v.timestamp)):null;return {ageSeconds:age,source:String(v?.source||'Unbekannt'),positionType:String(v?.positionType||'Position aus Feed'),status:v?.stale||age===null||age>300?'alt/unklar':age<=90?'aktuell':'verzögert',gpsVerified:false}}
