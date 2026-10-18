/* Radar 5.8: factual, source-aware issues and vehicle metadata. */
import {isRailRoute} from './core.js';
import {freshUpdate,tripCancelled} from './radar56-logic.mjs';
import {romeDay,romeSeconds,dateGTFSValid} from './radar51-logic.mjs';

const cleanDelay=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
function nearestStopEvidence(update,times,nowSec,stops={}){
 if(!Array.isArray(update?.stops)||!Array.isArray(times))return null;
 const upcoming=times.map(t=>({id:String(t[0]),sec:Number(t[2]??t[1]),seq:Number(t[3])}))
  .filter(t=>Number.isFinite(t.sec)&&t.sec>=nowSec-180&&t.sec<=nowSec+14400)
  .sort((a,b)=>a.sec-b.sec);
 for(const t of upcoming){
  const entry=update.stops.find(x=>String(x.stopId??x.stop_id??'')===t.id);
  if(!entry)continue;
  const eventSeq=Number(entry.stopSequence??entry.stop_sequence);
  if(Number.isFinite(eventSeq)&&eventSeq>0&&Number.isFinite(t.seq)&&t.seq>0&&eventSeq!==t.seq)continue;
  const delay=cleanDelay(entry.departure?.delay??entry.arrival?.delay);
  if(delay!==null)return {delay,stopId:t.id,stopName:String(stops[t.id]?.[0]||t.id)};
 }
 return null;
}
export function collectTrafficIssues(state,now=Date.now(),limit=80){
 const out=[],date=new Date(now),day=romeDay(date),nowSec=romeSeconds(date);
 for(const [key,update] of state?.updates||[]){
  const split=key.indexOf(':');if(split<1)continue;
  const source=key.slice(0,split),tripId=key.slice(split+1);
  const db=state.indexes?.[source],trip=db?.trips?.[tripId],det=state.details?.[source];
  if(!trip||trip[5]===false||!dateGTFSValid(db,date)||!freshUpdate(update,source,state.statuses,day,now))continue;
  const times=det?.times?.[tripId];
  if(!Array.isArray(times)||!times.length)continue;
  // A still-fresh message for a completed journey must not remain an active warning.
  if(!times.some(t=>Number(t[2]??t[1])>=nowSec-3600&&Number(t[1]??t[2])<=nowSec+21600))continue;
  const route=db.routes?.[trip[0]],kind=isRailRoute(route?.[2])?'train':'bus';
  const line=String(kind==='train'?(trip[3]||route?.[0]||tripId):(route?.[0]||tripId));
  const cancelled=tripCancelled(update,source,state.statuses,day,now);
  const stop=!cancelled?nearestStopEvidence(update,times,nowSec,det?.stops):null;
  const delay=stop?stop.delay:cleanDelay(update.delay),kindOfDelay=stop?'stop':'trip';
  const affectedStops=times.map(t=>String(t[0]));
  if(cancelled||delay!==null&&delay>=600){
   const minutes=cancelled?null:Math.round(delay/60),severity=cancelled?'danger':'delay';
   const title=(kind==='train'?'Zug ':'Bus ')+line+(cancelled?' · Ausfall':' · +'+minutes+' Min.');
   const detail=cancelled?'Ausfall per GTFS-RT TripUpdate bestätigt':kindOfDelay==='trip'?'Fahrtweite Verspätungsmeldung (nicht zwangsläufig jeder Halt)':'Verspätung für Halt '+stop.stopName+' gemeldet';
   out.push({id:source+':'+tripId+':'+severity,source,tripId,line,kind,severity,minutes,title,detail,stopId:stop?.stopId||'',stopIds:affectedStops,confirmed:true});
  }
  // A skipped stop or a platform reassignment is distinct from a full trip cancellation.
  for(const entry of Array.isArray(update.stops)?update.stops:[]){
   const stopId=String(entry.stopId??entry.stop_id??'');
   if(!stopId||!affectedStops.includes(stopId))continue;
   const timing=times.find(t=>String(t[0])===stopId);
   const stopSec=Number(timing?.[2]??timing?.[1]);
   if(!Number.isFinite(stopSec)||stopSec<nowSec-1800||stopSec>nowSec+14400)continue;
   const stopName=String(det?.stops?.[stopId]?.[0]||stopId);
   if(/^(SKIPPED|1)$/i.test(String(entry.scheduleRelationship??entry.schedule_relationship??''))){
    out.push({id:source+':'+tripId+':skipped:'+stopId,source,tripId,line,kind,severity:'danger',minutes:null,
      title:(kind==='train'?'Zug ':'Bus ')+line+' · Halt entfällt',detail:stopName+' laut GTFS-RT als übersprungen gemeldet',stopIds:[stopId],confirmed:true});
   }
   if(kind==='train'){
    const platform=platformInfo(det?.stops?.[stopId],entry,det?.stops);
    if(platform.live&&platform.changed)out.push({id:source+':'+tripId+':platform:'+stopId,
      source,tripId,line,kind,severity:'info',minutes:null,
      title:'Gleiswechsel · '+line,detail:stopName+': Gleis '+platform.planned+' → '+platform.current+' (GTFS-RT)',
      stopIds:[stopId],confirmed:true});
   }
  }
 }
 out.sort((a,b)=>({danger:0,delay:1,info:2}[a.severity]??3)-({danger:0,delay:1,info:2}[b.severity]??3)||(b.minutes??0)-(a.minutes??0));
 return out.slice(0,Math.max(1,limit));
}
export function summarizeNetwork(issues){
 const grouped=new Map();
 for(const issue of issues||[]){
  const id=issue.source+':'+issue.kind+':'+issue.line;
  const row=grouped.get(id)||{source:issue.source,kind:issue.kind,line:issue.line,cancelled:0,delayed:0,maxDelay:0};
  if(issue.severity==='danger')row.cancelled++;
  else if(issue.severity==='delay'){row.delayed++;row.maxDelay=Math.max(row.maxDelay,issue.minutes||0)}
  grouped.set(id,row);
 }
 return [...grouped.values()].sort((a,b)=>b.cancelled-a.cancelled||b.maxDelay-a.maxDelay||a.line.localeCompare(b.line));
}
export function feedDiagnostics(statuses){
 return Object.entries(statuses||{}).map(([source,status])=>({source,status:String(status),ok:status==='ok'}))
 .sort((a,b)=>Number(a.ok)-Number(b.ok)||a.source.localeCompare(b.source));
}
export function matchingFavorite(issue,favorites,state){
 return (favorites||[]).some(f=>{
  if(!f||!['line','train','station'].includes(f.type))return false;
  if(f.source && String(f.source)!==issue.source)return false;
  const value=String(f.value||'').trim().toLowerCase();if(!value)return false;
  if(f.type==='line')return value===issue.line.toLowerCase()||value==='bus '+issue.line.toLowerCase();
  if(f.type==='train'){
   const trip=state?.indexes?.[issue.source]?.trips?.[issue.tripId];
   return value===String(trip?.[3]||'').toLowerCase()||value===issue.line.toLowerCase();
  }
  return String(issue.stopId||'').toLowerCase()===value || (state?.details?.[issue.source]?.times?.[issue.tripId]||[])
    .some(st=>String(st[0]).toLowerCase()===value);
 });
}
export function rollingStockEvidence(vehicle){
 if(!vehicle||vehicle.kind!=='train')return {name:'Unbekannt',source:'Kein Zugdatensatz'};
 for(const field of ['vehicleModel','rollingStockType','modelName']){
  const value=vehicle[field];
  if(typeof value==='string' && value.trim())return {name:value.trim().slice(0,90),source:'Modellbezeichnung aus Fahrzeugdaten'};
 }
 return {name:'Unbekannt',source:'GTFS-RT enthält keine eindeutige Modellzuordnung'};
}

export const matchesFavorite=(issue,favorites,state)=>matchingFavorite(issue,favorites,state);
