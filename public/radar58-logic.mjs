/* Radar 5.8: source-verified traffic events; no fabricated line outages. */
import {freshUpdate,tripCancelled} from './radar56-logic.mjs';
import {isRailRoute} from './core.js';
import {romeDay,romeSeconds,dateGTFSValid} from './radar51-logic.mjs';
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
  const delay=nextStop?.delay??tripDelay;
  if(!canceled&&(delay===null||delay<600))continue;
  const severity=canceled?'danger':'delay',minutes=canceled?null:Math.round(delay/60);
  const detail=canceled?'Ausfall in frischem GTFS-RT-TripUpdate':nextStop?'Verspätung am nächsten gemeldeten Halt; nicht die gesamte Linie':'Fahrtweiter GTFS-RT-Verspätungswert; Haltprognose nicht garantiert';
  issues.push({id:source+':'+tripId+':'+severity,source,tripId,line,kind,severity,minutes,verified:true,
   title:(kind==='train'?'Zug ':'Bus ')+line+(canceled?' · Ausfall':' · +'+minutes+' Min.'),detail});
 }
 issues.sort((a,b)=>Number(b.severity==='danger')-Number(a.severity==='danger')||(b.minutes??0)-(a.minutes??0));
 return issues.slice(0,Math.max(1,limit));
}
export function feedDiagnostics(statuses){
 return Object.entries(statuses||{}).map(([source,status])=>({source,status:String(status),ok:status==='ok'}))
 .sort((a,b)=>Number(a.ok)-Number(b.ok)||a.source.localeCompare(b.source));
}
export function summarizeNetwork(issues){
 const map=new Map();
 for(const x of issues||[]){
  const id=x.kind+':'+x.line;
  const row=map.get(id)||{kind:x.kind,line:x.line,cancelled:0,delayed:0,maxDelay:0};
  if(x.severity==='danger')row.cancelled++;
  else{row.delayed++;row.maxDelay=Math.max(row.maxDelay,x.minutes||0)}
  map.set(id,row);
 }
 return [...map.values()].sort((a,b)=>b.cancelled-a.cancelled||b.maxDelay-a.maxDelay||a.line.localeCompare(b.line));
}
export function matchesFavoriteIssue(issue,favorites){
 if(!issue||!Array.isArray(favorites))return false;
 const line=String(issue.line).trim().toLocaleLowerCase('de'),trip=String(issue.tripId).trim().toLocaleLowerCase('de');
 return favorites.some(f=>{
  if(!f||!['line','train'].includes(f.type)||f.source&&f.source!==issue.source)return false;
  const val=String(f.value||'').trim().toLocaleLowerCase('de');
  return !!val&&(val===line||f.type==='train'&&val===trip);
 });
}
export function resolveRollingStock(vehicle){
 if(!vehicle||vehicle.kind!=='train')return {name:'Unbekannt',evidence:'Kein Zugdatensatz'};
 for(const key of ['vehicleModel','rollingStockType','trainType','modelName']){
  const name=vehicle[key];
  if(typeof name==='string'&&name.trim())return {name:name.trim().slice(0,80),evidence:'Modellbezeichnung aus empfangenen Fahrzeugdaten'};
 }
 return {name:'Unbekannt',evidence:'Modell im aktuellen Live-Feed nicht bestätigt'};
}
