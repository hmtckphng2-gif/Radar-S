/* Radar 5.6 - pure, testable live-intelligence logic.
   A forecast is only called live when a CURRENT, correctly associated GTFS-RT
   update contains a stop-specific event delay; else schedule-only. */
export const normDay = s => String(s??'').replaceAll('-','');
export const readableTime = sec => !Number.isFinite(sec)?'–':String(Math.floor(sec/3600)%24).padStart(2,'0')+':'+String(Math.floor(sec%3600/60)).padStart(2,'0')+(sec>=86400?' +1':'');
export function freshUpdate(u,source,statuses,serviceDay,now=Date.now()){
 if(!u||statuses?.[source+'_updates']!=='ok'||!Number.isFinite(Number(u.fetchedAt)))return false;
 const age=now-Number(u.fetchedAt);
 if(age< -30000||age>120000)return false;
 if(u.tripStartDate&&serviceDay&&normDay(u.tripStartDate)!==normDay(serviceDay))return false;
 return true;
}
const numberOrNull = x => x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function stopDelay(u,stopId,seq,kind='arrival'){
 if(!u||!Array.isArray(u.stops))return null;
 // Match strict stop_id when present; don't use an unrelated stop by sequence.
 const byId=u.stops.find(x=>String(x.stopId??x.stop_id??'')===String(stopId));
 const bySeq=seq>0?u.stops.find(x=>Number(x.stopSequence??x.stop_sequence)===Number(seq)):null;
 if(byId&&bySeq&&byId!==bySeq)return null;
 const row=byId || (bySeq && !(bySeq.stopId??bySeq.stop_id)?bySeq:null);
 if(!row)return null;
 return numberOrNull(row[kind]?.delay);
}
export function tripCancelled(u,source,statuses,day,now=Date.now()){
 return freshUpdate(u,source,statuses,day,now)&&/^(3|CANCELED|CANCELLED)$/i.test(String(u.scheduleRelationship||''));
}
export function connectionAssessment(arrival,departure,minTransfer=240){
 if(!arrival||!departure)return {kind:'unknown',label:'Daten fehlen'};
 if(!Number.isFinite(arrival.plan)||!Number.isFinite(departure.plan))return {kind:'unknown',label:'Daten fehlen'};
 const real=Number.isFinite(arrival.rt)&&Number.isFinite(departure.rt);
 const arrivalSec=arrival.plan+(real?arrival.rt:0);
 const departureSec=departure.plan+(real?departure.rt:0);
 const margin=departureSec-arrivalSec;
 if(!real)return {kind:'plan',label:'Nur Fahrplan',margin:departure.plan-arrival.plan,live:false};
 if(margin<minTransfer)return {kind:'risk',label:'Anschluss gefährdet',margin,live:true};
 if(margin<minTransfer+300)return {kind:'tight',label:'Knapp',margin,live:true};
 return {kind:'likely',label:'Voraussichtlich erreichbar',margin,live:true};
}
export function findConnections({source,tripId,stops,db,details,updates,statuses,serviceDay,nowSec,now=Date.now(),minTransfer=240,max=14}){
 const journey=details?.times?.[tripId];
 if(!Array.isArray(journey)||!db?.trips?.[tripId]||!db?.meta?.days?.includes(serviceDay))return {station:null,rows:[],reason:'Kein heute gültiger GTFS-Fahrtverlauf'};
 let station=null;
 for(let i=0;i<journey.length;i++){
  const row=journey[i],arr=numberOrNull(row[1]??row[2]);
  if(arr!==null&&arr>=nowSec-90&&arr<=nowSec+7200){station={stopId:String(row[0]),arr,seq:Number(row[3])||0,index:i};break}
 }
 if(!station)return {station:null,rows:[],reason:'Kein kommender Bahnhof mit bekannten Ankunftszeiten'};
 const currentU=updates?.get?.(source+':'+tripId);
 const arrivalLive=freshUpdate(currentU,source,statuses,serviceDay,now)&&!tripCancelled(currentU,source,statuses,serviceDay,now);
 const arrRT=arrivalLive?stopDelay(currentU,station.stopId,station.seq,'arrival'):null;
 const candidates=[];
 for(const [candidateId,times] of Object.entries(details.times||{})){
  if(candidateId===tripId||!Array.isArray(times))continue;
  const trip=db.trips?.[candidateId];if(!trip||trip[5]===false)continue;
  for(const item of times){
   if(String(item[0])!==station.stopId)continue;
   const dep=numberOrNull(item[2]??item[1]);
   if(dep===null||dep<station.arr-900||dep>station.arr+4800)continue;
   const cu=updates?.get?.(source+':'+candidateId);
   if(tripCancelled(cu,source,statuses,serviceDay,now))continue;
   const departureLive=freshUpdate(cu,source,statuses,serviceDay,now);
   const depRT=departureLive?stopDelay(cu,station.stopId,Number(item[3])||0,'departure'):null;
   const assessment=connectionAssessment({plan:station.arr,rt:arrRT},{plan:dep,rt:depRT},minTransfer);
   // Include only connections that are not definitely in the past according to a current prediction.
   if(assessment.live && dep+depRT<nowSec-60)continue;
   candidates.push({source,tripId:candidateId,stopId:station.stopId,departure:dep,
     arrival:station.arr, destination:String(trip[1]||'Ziel nicht verfügbar'),
     line:String(db.routes?.[trip[0]]?.[0]||trip[3]||'Fahrt'),
     assessment,departureDelaySec:depRT,delayMin:depRT===null?null:Math.round(depRT/60)});
   break;
  }
 }
 candidates.sort((a,b)=>a.departure-b.departure);
 // Never infer cross-source station equivalence based only on name.
 return {station:{...station,name:String(details.stops?.[station.stopId]?.[0]||'Nächster Halt'),arrivalDelay:arrRT},rows:candidates.slice(0,max),reason:candidates.length?'':'Keine eindeutig passenden Anschlussfahrten in derselben Quelle'};
}
export function feedQuality(v,statuses,now=Date.now()){
 if(!v)return {level:'unknown',label:'Keine Position',detail:'Kein Fahrzeug gewählt'};
 const age=Number.isFinite(Number(v.timestamp))&&Number(v.timestamp)>1e9?Math.max(0,now/1000-Number(v.timestamp)):null;
 const sourceOk=statuses?.[v.source]==='ok';
 const estimated=/simuliert|geschätzt|estimated|interpoliert/i.test(String(v.positionType||''))||v.source==='trains';
 if(v.stale||!sourceOk||(age!==null&&age>300))return {level:'stale',label:'Letzte bekannte Position',detail:age===null?'Alter unbekannt':Math.round(age)+' Sekunden alt',age,estimated};
 if(age===null)return {level:'unknown',label:'Zeit nicht bestätigt',detail:estimated?'Position geschätzt':'Feedposition ohne überprüfbare Zeit',age,estimated};
 if(estimated)return {level:'estimated',label:'Position geschätzt',detail:Math.round(age)+' Sekunden seit Feedmeldung',age,estimated};
 return {level:'reported',label:'Feedposition gemeldet',detail:Math.round(age)+' Sekunden seit Feedmeldung · kein GPS-Nachweis',age,estimated};
}
export function spatialWarning(km,rtMinutes,quality){
 if(!Number.isFinite(km)||km<3)return null;
 if(quality?.level==='stale')return 'Große Positionsabweichung – Meldung veraltet';
 if(rtMinutes===null||!Number.isFinite(rtMinutes))return 'Große Soll-Abweichung; Verspätung nicht bestätigt';
 if(Math.abs(rtMinutes)<=1)return 'Soll-Abweichung trotz '+(rtMinutes===0?'0':rtMinutes)+' Min. im Feed – Daten getrennt bewerten';
 return null;
}
export function journeyProgress(times,nowSec){
 if(!Array.isArray(times)||!times.length)return null;
 const sorted=[...times].sort((a,b)=>(Number(a[3])||0)-(Number(b[3])||0));
 const next=sorted.findIndex(row=>Number.isFinite(Number(row[1]??row[2]))&&Number(row[1]??row[2])>=nowSec-60);
 return {total:sorted.length,nextIndex:next,plannedPassed:next<0?sorted.length:next,next:next<0?null:sorted[next]};
}
export function aggregateHistory(days,period,nowDay){
 const end=new Date(nowDay+'T12:00:00Z').getTime();
 const allowed=new Set(Array.from({length:period},(_,i)=>new Date(end-i*86400000).toISOString().slice(0,10)));
 const rows=days.filter(d=>allowed.has(d.day));
 const counts=rows.reduce((r,d)=>{r.samples+=(d.samples||0);r.observed+=(d.observed||0);r.delayed+=(d.delayed||0);r.sum+=(d.sum||0);return r},{samples:0,observed:0,delayed:0,sum:0});
 return {...counts,average:counts.observed?counts.sum/counts.observed:null,latePercent:counts.observed?100*counts.delayed/counts.observed:null,rows:rows.sort((a,b)=>a.day.localeCompare(b.day))};
}
