/* Radar 5.8 Traffic Intelligence: conservative GTFS-RT-only signal processing.
 * Pure data layer: never infer an incident from a missing vehicle or failed feed. */
import {freshUpdate,tripCancelled} from './radar56-logic.mjs';
import {romeDay,romeSeconds,dateGTFSValid} from './radar51-logic.mjs';
import {isRailRoute} from './core.js';

function nextRelevantStop(u,times,nowSec){
 if(!Array.isArray(times)||!Array.isArray(u?.stops))return null;
 const relevant=times.map(t=>({stopId:String(t[0]),sec:Number(t[2]??t[1])}))
  .filter(t=>Number.isFinite(t.sec)&&t.sec>=nowSec-180&&t.sec<nowSec+4*3600)
  .sort((a,b)=>a.sec-b.sec);
 for(const t of relevant){
  const st=u.stops.find(s=>String(s.stopId??s.stop_id??'')===t.stopId);
  if(!st)continue;
  const value=st.departure?.delay??st.arrival?.delay;
  if(value==null||!Number.isFinite(Number(value)))continue;
  return {delay:Number(value),stopId:t.stopId};
 }
 return null;
}
export function collectTrafficIssues(state,now=Date.now(),limit=80){
 const results=[],date=new Date(now),day=romeDay(date),nowSec=romeSeconds(date);
 for(const [key,u] of state?.updates||[]){
  const n=String(key).indexOf(':');if(n<=0)continue;
  const source=key.slice(0,n),tripId=key.slice(n+1);
  const db=state.indexes?.[source],trip=db?.trips?.[tripId];
  if(!trip||trip[5]===false||!dateGTFSValid(db,date)||!freshUpdate(u,source,state.statuses,day,now))continue;
  const times=state.details?.[source]?.times?.[tripId];
  if(Array.isArray(times)&&times.length&&!times.some(t=>{
   const dep=Number(t[2]??t[1]),arr=Number(t[1]??t[2]);
   return Number.isFinite(dep)&&Number.isFinite(arr)&&dep>=nowSec-3600&&arr<=nowSec+21600;
  }))continue;
  const route=db.routes?.[trip[0]],kind=isRailRoute(route?.[2])||source==='trains'?'train':'bus';
  const line=kind==='train'?String(trip[3]||route?.[0]||'Zug'):String(route?.[0]||trip[3]||'Bus');
  const cancelled=tripCancelled(u,source,state.statuses,day,now);
  const stopInfo=nextRelevantStop(u,times,nowSec);
  const raw=stopInfo?.delay??u.delay;
  const delay=raw===null||raw===undefined||!Number.isFinite(Number(raw))?null:Number(raw);
  if(!cancelled&&(delay===null||delay<600))continue;
  const severity=cancelled?'danger':'delay',minutes=cancelled?null:Math.round(delay/60);
  const scope=stopInfo?'Haltgenaue GTFS-RT-Meldung für einen kommenden Halt':'Fahrtweite GTFS-RT-Meldung; nicht zwingend jeder Halt betroffen';
  results.push({
   id:source+':'+tripId+':'+severity,source,tripId,line,kind,severity,minutes,verified:true,
   title:(kind==='train'?'Zug ':'Bus ')+line+(cancelled?' · Ausfall':' · +'+minutes+' Min.'),
   detail:cancelled?'Aktuelle GTFS-RT-Ausfallmeldung':scope,
   stopIds:Array.isArray(times)?times.map(x=>String(x[0])):[]
  });
 }
 results.sort((a,b)=>Number(b.severity==='danger')-Number(a.severity==='danger')||(b.minutes??0)-(a.minutes??0));
 return results.slice(0,limit);
}
export function feedDiagnostics(statuses){
 return Object.entries(statuses||{}).map(([source,status])=>({source,status:String(status),ok:status==='ok'}))
  .sort((a,b)=>Number(a.ok)-Number(b.ok)||a.source.localeCompare(b.source));
}
export function summarizeNetwork(issues){
 const byLine=new Map();
 for(const x of issues){
  const key=x.source+':'+x.kind+':'+x.line;
  const item=byLine.get(key)||{source:x.source,kind:x.kind,line:x.line,cancelled:0,delayed:0,maxDelay:0};
  if(x.severity==='danger')item.cancelled++;
  else{item.delayed++;item.maxDelay=Math.max(item.maxDelay,x.minutes||0)}
  byLine.set(key,item);
 }
 return [...byLine.values()].sort((a,b)=>b.cancelled-a.cancelled||b.maxDelay-a.maxDelay||a.line.localeCompare(b.line));
}
export function matchesFavorite(issue,favorites=[]){
 if(!issue||!Array.isArray(favorites))return false;
 const norm=x=>String(x??'').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
 return favorites.some(f=>{
  if(!f||f.source&&norm(f.source)!==norm(issue.source))return false;
  const value=norm(f.value);if(!value)return false;
  if(f.type==='line')return value===norm(issue.line);
  if(f.type==='train')return issue.kind==='train'&&(value===norm(issue.line)||value===norm(issue.tripId));
  if(f.type==='station')return (issue.stopIds||[]).some(x=>norm(x)===value);
  return false;
 });
}
export function vehicleModelEvidence(vehicle){
 if(!vehicle||vehicle.stale)return {model:null,status:'unknown',note:'Keine frischen Fahrzeugdaten'};
 for(const field of ['vehicleModel','rollingStockType','trainType','modelName']){
  const raw=vehicle[field];
  if(typeof raw==='string'&&raw.trim().length>=2&&raw.trim().length<=80)
   return {model:raw.trim(),status:'provided',note:'Modellbezeichnung aus Fahrzeugdaten'};
 }
 return {model:null,status:'unknown',note:'Keine eindeutig bestätigte Fahrzeugbaureihe'};
}
