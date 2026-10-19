/* Radar 6.4 — conservative multi-feed identity and observation quality. Pure utilities. */
const number=v=>{if(!v||v.kind!=='train'||!v.nameVerified)return '';const m=String(v.name||'').match(/(?:^|\s)(\d{2,6})(?:\s|$)/);return m?.[1]||''};
const validTs=v=>Number.isFinite(Number(v?.timestamp))&&Number(v.timestamp)>1e9;
const radians=n=>n*Math.PI/180;
export function distanceMeters(a,b){const lat1=Number(a?.lat),lat2=Number(b?.lat),lon1=Number(a?.lon),lon2=Number(b?.lon);if(![lat1,lat2,lon1,lon2].every(Number.isFinite))return Infinity;const x=radians(lat2-lat1),y=radians(lon2-lon1),q=Math.sin(x/2)**2+Math.cos(radians(lat1))*Math.cos(radians(lat2))*Math.sin(y/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)))}
export function samePhysicalTrip(a,b){if(!a||!b||a.key===b.key||a.source===b.source||a.kind!==b.kind||!a.tripStartDate||a.tripStartDate!==b.tripStartDate||!validTs(a)||!validTs(b)||Math.abs(a.timestamp-b.timestamp)>120)return false;
 const meters=distanceMeters(a,b);if(a.kind==='train')return !!number(a)&&number(a)===number(b)&&meters<=1500;
 // Bus IDs are NOT globally unique: only merge matching full trip/route identity.
 return !!a.tripId&&a.tripId===b.tripId&&!!a.routeId&&a.routeId===b.routeId&&meters<=120;
}
export function selectRepresentatives(vehicles,selectedKey){const all=[...vehicles].filter(Boolean),removed=new Set(),groups=new Map();
 const sorted=[...all].sort((a,b)=>{const delta=Number(b.timestamp||0)-Number(a.timestamp||0);if(Math.abs(delta)>10)return delta;return Number(b.source==='sta_direct')-Number(a.source==='sta_direct')||delta});
 for(let i=0;i<sorted.length;i++){const a=sorted[i];if(removed.has(a.key))continue;const group=[a];for(let j=i+1;j<sorted.length;j++){const b=sorted[j];if(removed.has(b.key))continue;if(samePhysicalTrip(a,b)){removed.add(b.key);group.push(b)}}
 const chosen=group.find(x=>x.key===selectedKey)||group[0];groups.set(chosen.key,group.map(x=>x.source));for(const item of group)if(item.key!==chosen.key)removed.add(item.key);removed.delete(chosen.key);
 }
 return {keys:new Set(all.filter(x=>!removed.has(x.key)).map(x=>x.key)),sources:groups,duplicates:removed.size};
}
export function observationQuality(v,now=Date.now()){const age=validTs(v)?Math.max(0,Math.round(now/1000-v.timestamp)):null;return {ageSeconds:age,source:String(v?.source||'Unbekannt'),positionType:String(v?.positionType||'Position aus Feed'),status:v?.stale||age===null||age>300?'alt/unklar':age<=90?'aktuell':'verzögert',gpsVerified:false}}
