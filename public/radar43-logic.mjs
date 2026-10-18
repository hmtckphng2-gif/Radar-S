/* Südtirol Radar 4.3 — pure, testable screen/data helpers.
   No location is predicted, invented, or converted into an exact ETA. */
export function clusterGrid(points,cell=72,selectedKey=null){
 const grid=new Map(),singles=[],clusters=[];
 for(const p of points){
  if(p.key===selectedKey){singles.push(p.key);continue;}
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const key=`${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`;
  if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);
 }
 for(const group of grid.values()){
  if(group.length===1){singles.push(group[0].key);continue;}
  const keys=group.map(p=>p.key);
  clusters.push({keys,count:group.length,
   buses:group.filter(p=>p.kind==='bus').length,trains:group.filter(p=>p.kind==='train').length,
   staleCount:group.filter(p=>p.stale).length,
   x:group.reduce((s,p)=>s+p.x,0)/group.length,
   y:group.reduce((s,p)=>s+p.y,0)/group.length});
 }
 return {singles,clusters};
}
export function classifyPosition(v,nowMs=Date.now(),maxAgeSec=3600){
 if(!v || !Number.isFinite(Number(v.timestamp)) || Number(v.timestamp)<1e9)
  return {kind:'unknown',minutes:null};
 const age=(nowMs/1000-Number(v.timestamp));
 const minutes=Math.max(0,Math.round(age/60));
 if(age>maxAgeSec||age< -30)return {kind:'expired',minutes};
 if(v.stale||age>300)return {kind:'stale',minutes};
 return {kind:'current',minutes};
}
export function nearbyStations(stations,bounds,center,max=40){
 const valid=(stations||[]).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&
   s.lat>=bounds.south&&s.lat<=bounds.north&&s.lon>=bounds.west&&s.lon<=bounds.east);
 const cos=Math.cos((center[0]||46.5)*Math.PI/180);
 valid.sort((a,b)=>((a.lat-center[0])**2+((a.lon-center[1])*cos)**2)-((b.lat-center[0])**2+((b.lon-center[1])*cos)**2));
 return valid.slice(0,max);
}
export function followNeedsPan(point,center,width,height){
 const xMargin=Math.max(48,width*.19), yMargin=Math.max(65,height*.17);
 return Math.abs(point.x-center.x)>xMargin || Math.abs(point.y-center.y)>yMargin;
}
function clock(sec){if(!Number.isFinite(Number(sec)))return '';
 const n=Number(sec);return String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n/60)%60).padStart(2,'0')+(n>=86400?' +1':'');}
export function stopSummary(p,update){
 if(!p)return {title:'Nächster Halt nicht verifiziert',meta:'Keine bestätigte Fahrt/Haltestelle'};
 const title=(p.atStop?'Am Halt: ':'Nächster Halt: ')+p.name;
 const details=[];
 if(p.time!=null&&Number.isFinite(Number(p.time)))details.push('Plan '+clock(p.time));
 if(update?.cancelled)details.push('Fahrt entfällt laut Feed');
 else if(update?.delay!=null&&Number.isFinite(Number(update.delay))){
  const n=Math.round(Number(update.delay)/60);
  details.push('RT '+(n>0?'+':'')+n+' Min.');
 }else details.push('keine bestätigte Verspätung');
 return {title,meta:details.join(' · ')};
}
