/* Radar 5.8: source-verified traffic events; no fabricated line outages. */
import {freshUpdate,tripCancelled} from './radar56-logic.mjs?v=9.7.0';
import {isRailRoute} from './core.js?v=9.7.0';
import {platformInfo} from './radar54-logic.mjs?v=9.7.0';
import {romeDay,romeSeconds,dateGTFSValid} from './radar51-logic.mjs?v=9.7.0';
const finite=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function stopEvidence(u,times,nowSec){
 if(!Array.isArray(times)||!Array.isArray(u?.stops))return null;
 const candidates=times.filter(t=>Number.isFinite(Number(t[2]??t[1]))&&Number(t[2]??t[1])>=nowSec-180&&Number(t[2]??t[1])<=nowSec+14400)
  .sort((a,b)=>Number(a[2]??a[1])-Number(b[2]??b[1]));
 for(const [stopId,arr,dep,seq] of candidates){
  const match=u.stops.find(s=>String(s.stopId??s.stop_id??'')===String(stopId));
  if(!match)continue;
  const d=finite(match.departure?.delay??match.arrival?.delay);
  if(d!==null)return {delay:d,stopId:String(stopId)};
 }
 return null;
}
export function collectTrafficIssues(state,now=Date.now(),limit=80){
 const issues=[],today=romeDay(new Date(now)),nowSec=romeSeconds(new Date(now));
 if(!state?.updates?.[Symbol.iterator])return issues;
 for(const [key,update] of state.updates){
  const k=key.indexOf(':');if(k<=0)continue;
  const source=key.slice(0,k),tripId=key.slice(k+1);
  const db=state.indexes?.[source],trip=db?.trips?.[tripId];
  if(!trip||trip[5]===false||!dateGTFSValid(db,new Date(now))||!freshUpdate(update,source,state.statuses,today,now))continue;
  const route=db.routes?.[trip[0]],kind=isRailRoute(route?.[2])?'train':'bus';
  const line=String((kind==='train'?trip[3]:route?.[0])||route?.[0]||tripId);
  const times=state.details?.[source]?.times?.[tripId];
  if(Array.isArray(times)&&times.length){
    const operating=times.some(t=>{const a=finite(t[1]??t[2]),d=finite(t[2]??t[1]);return a!==null&&d!==null&&d>=nowSec-3600&&a<=nowSec+21600});
    if(!operating)continue;
  }
  const canceled=tripCancelled(update,source,state.statuses,today,now);
  const tripDelay=finite(update.delay),nextStop=stopEvidence(update,times,nowSec);
  const stopConfirmed=nextStop?.delay>=600;
  const delay=stopConfirmed?nextStop.delay:tripDelay;
  const stopIds=Array.isArray(times)?times.map(x=>String(x[0])):[];
  if(canceled||delay!==null&&delay>=600){
   const severity=canceled?'danger':'delay',minutes=canceled?null:Math.round(delay/60);
   const detail=canceled?'Ausfall in frischem GTFS-RT-TripUpdate':stopConfirmed?'Verspätung am nächsten gemeldeten Halt; nicht die gesamte Linie':'Fahrtweiter GTFS-RT-Verspätungswert; Haltprognose nicht garantiert';
   issues.push({id:source+':'+tripId+':'+severity,source,tripId,line,kind,severity,minutes,verified:true,stopIds,
     title:(kind==='train'?'Zug ':'Bus ')+line+(canceled?' · Ausfall':' · +'+minutes+' Min.'),detail});
  }
  // Verified stop-level events: do not invent an entire trip cancellation from a skipped stop.
  if(!canceled&&Array.isArray(times)&&Array.isArray(update.stops)){
   for(const st of update.stops){
    const stopId=String(st.stopId??st.stop_id??'');if(!stopId||!stopIds.includes(stopId))continue;
    const planned=times.find(t=>String(t[0])===stopId),sec=finite(planned?.[2]??planned?.[1]);
    if(sec===null||sec<nowSec-1800||sec>nowSec+14400)continue;
    const stopName=String(state.details?.[source]?.stops?.[stopId]?.[0]||stopId);
    if(/^(SKIPPED|1)$/i.test(String(st.scheduleRelationship??st.schedule_relationship??''))){
     issues.push({id:source+':'+tripId+':skip:'+stopId,source,tripId,line,kind,severity:'danger',minutes:null,verified:true,stopIds:[stopId],
      title:(kind==='train'?'Zug ':'Bus ')+line+' · Halt entfällt',detail:stopName+' laut GTFS-RT übersprungen'});
    }
    if(kind==='train'){
     const p=platformInfo(state.details?.[source]?.stops?.[stopId],st,state.details?.[source]?.stops);
     if(p.live&&p.changed)issues.push({id:source+':'+tripId+':platform:'+stopId,source,tripId,line,kind,severity:'info',minutes:null,verified:true,stopIds:[stopId],
      title:'Gleiswechsel · '+line,detail:stopName+': Gleis '+p.planned+' → '+p.current+' (GTFS-RT)'});
    }
   }
  }
 }
 issues.sort((a,b)=>({danger:0,delay:1,info:2}[a.severity]??3)-({danger:0,delay:1,info:2}[b.severity]??3)||(b.minutes??0)-(a.minutes??0));
 return issues.slice(0,Math.max(1,limit));
}
export function feedDiagnostics(statuses){
 return Object.entries(statuses||{}).map(([source,status])=>({source,status:String(status),ok:status==='ok'}))
 .sort((a,b)=>Number(a.ok)-Number(b.ok)||a.source.localeCompare(b.source));
}
export function summarizeNetwork(issues){
 const map=new Map();
 for(const x of issues||[]){
  const id=x.source+':'+x.kind+':'+x.line;
  const row=map.get(id)||{source:x.source,kind:x.kind,line:x.line,cancelled:0,delayed:0,changed:0,maxDelay:0};
  if(x.severity==='danger')row.cancelled++;
  else if(x.severity==='delay'){row.delayed++;row.maxDelay=Math.max(row.maxDelay,x.minutes||0)}
  else if(x.severity==='info')row.changed++;
  map.set(id,row);
 }
 return [...map.values()].sort((a,b)=>b.cancelled-a.cancelled||b.maxDelay-a.maxDelay||a.line.localeCompare(b.line));
}
export function matchesFavoriteIssue(issue,favorites){
 if(!issue||!Array.isArray(favorites))return false;
 const line=String(issue.line).trim().toLocaleLowerCase('de'),trip=String(issue.tripId).trim().toLocaleLowerCase('de');
 return favorites.some(f=>{
  if(!f||!['line','train','station'].includes(f.type)||f.source&&f.source!==issue.source)return false;
  const val=String(f.value||'').trim().toLocaleLowerCase('de');
  return !!val&&(f.type==='station'?(issue.stopIds||[]).some(x=>String(x).toLocaleLowerCase('de')===val):val===line||f.type==='train'&&val===trip);
 });
}
export function resolveRollingStock(vehicle){
 if(!vehicle||vehicle.kind!=='train')return {name:'Unbekannt',evidence:'Kein Zugdatensatz'};
 for(const key of ['vehicleModel','rollingStockType','modelName']){
  const name=vehicle[key];
  if(typeof name==='string'&&name.trim())return {name:name.trim().slice(0,80),evidence:'Modellbezeichnung aus empfangenen Fahrzeugdaten'};
 }
 return {name:'Unbekannt',evidence:'Modell im aktuellen Live-Feed nicht bestätigt'};
}

/* Estimate temporal offset at every newly reported train position, independent
   of whether GTFS-RT supplies a delay for the current stop. This is NOT
   official punctuality, and only works within a verified schedule segment. */
export function estimatePositionDelay(compare,vehicle,now=new Date()){
 if(!compare||!vehicle||vehicle.kind!=='train'||vehicle.stale)return null;
 if(vehicle.source==='trains'||/estimated|geschätzt|simuliert|interpoliert/i.test(String(vehicle.positionType||'')))return null;
 const stamp=Number(vehicle.timestamp);
 if(!Number.isFinite(stamp)||stamp<1e9)return null;
 const reportedAt=stamp>1e12?stamp:stamp*1000;
 const age=now.getTime()-reportedAt;
 if(age< -30000||age>120000)return null;
 const a=compare.segmentStartMeters,b=compare.segmentEndMeters;
 const t0=compare.segmentStartSeconds,t1=compare.segmentEndSeconds,pos=compare.observedMeters;
 if(![a,b,t0,t1,pos].every(Number.isFinite)||b-a<100||t1-t0<60)return null;
 // Never extrapolate far beyond the two timetable stops.
 if(pos<a-50||pos>b+50)return null;
 const fraction=Math.max(0,Math.min(1,(pos-a)/(b-a)));
 const expected=t0+fraction*(t1-t0);
 const actual=romeSeconds(new Date(reportedAt));
 let offset=actual-expected;
 if(offset>43200)offset-=86400;
 if(offset< -43200)offset+=86400;
 if(Math.abs(offset)>7200)return null;
 return {minutes:Math.round(offset/60),ageSeconds:Math.round(age/1000),
  label:'GPS-/Positionsschätzung',note:'Aus letzter gemeldeter Position und interpoliertem Soll-Fahrplan; keine offizielle Verspätung. Zwischen Haltestellen nur näherungsweise.'};
}
