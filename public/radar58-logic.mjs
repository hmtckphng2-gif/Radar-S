/* Radar 5.8: verifiable issues, source health, favorites and model evidence. */
import {freshUpdate,tripCancelled} from './radar56-logic.mjs';
import {romeDay,romeSeconds,dateGTFSValid} from './radar51-logic.mjs';
import {isRailRoute} from './core.js';

const numberOrNull=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const canon=v=>String(v??'').trim().toLocaleLowerCase('de');

export function collectTrafficIssues(state,now=Date.now(),limit=80){
 const date=new Date(now), day=romeDay(date), nowSec=romeSeconds(date), found=[];
 for(const [key,update] of state?.updates||[]){
  const pos=key.indexOf(':');if(pos<1)continue;
  const source=key.slice(0,pos),tripId=key.slice(pos+1),db=state.indexes?.[source];
  const trip=db?.trips?.[tripId];
  if(!trip||trip[5]===false||!dateGTFSValid(db,date)||
     !freshUpdate(update,source,state.statuses,day,now))continue;
  const route=db.routes?.[trip[0]],kind=isRailRoute(route?.[2])?'train':'bus';
  const line=String(kind==='train'?(trip[3]||route?.[0]||'Zug unbekannt'):(route?.[0]||'Linie unbekannt')).trim();
  const times=state.details?.[source]?.times?.[tripId];
  // Exclude finished services when the timetable is available.
  if(Array.isArray(times)&&times.length&&!times.some(t=>{
    const arrive=numberOrNull(t[1]),depart=numberOrNull(t[2]);
    return (depart??arrive??-Infinity)>=nowSec-3600&&(arrive??depart??Infinity)<=nowSec+21600;
  }))continue;
  const cancelled=tripCancelled(update,source,state.statuses,day,now);
  const wholeDelay=numberOrNull(update.delay);
  const stopDelay=(Array.isArray(update.stops)?update.stops:[])
   .flatMap(stop=>[numberOrNull(stop?.departure?.delay),numberOrNull(stop?.arrival?.delay)])
   .filter(v=>v!==null);
  const delay=stopDelay.length?Math.max(...stopDelay):wholeDelay;
  if(!cancelled&&(delay===null||delay<600))continue;
  const severity=cancelled?'danger':'delay',minutes=cancelled?null:Math.round(delay/60);
  found.push({
   id:day+':'+source+':'+tripId+':'+severity,source,tripId,line,kind,severity,minutes,
   title:(kind==='train'?'Zug ':'Bus ')+line+(cancelled?' · Ausfall':' · +'+minutes+' Min.'),
   detail:cancelled?'Ausfall aus frischem GTFS-RT-TripUpdate':
    (stopDelay.length?'Größte gemeldete Halteverspätung':'Fahrtweite Verspätung')+'; nicht für alle Halte bestätigt',
   stopIds:Array.isArray(times)?times.map(t=>String(t[0])):[],
   verified:true
  });
 }
 found.sort((a,b)=>Number(b.severity==='danger')-Number(a.severity==='danger')||(b.minutes??0)-(a.minutes??0));
 const used=new Set();
 return found.filter(x=>{if(used.has(x.id))return false;used.add(x.id);return true}).slice(0,limit);
}
export function summarizeNetwork(issues){
 const counts=new Map();
 for(const i of issues||[]){
  const k=i.source+':'+i.kind+':'+i.line;
  const v=counts.get(k)||{source:i.source,kind:i.kind,line:i.line,cancelled:0,delayed:0,maxDelay:0};
  if(i.severity==='danger')v.cancelled++;
  else{v.delayed++;v.maxDelay=Math.max(v.maxDelay,i.minutes||0)}
  counts.set(k,v);
 }
 return [...counts.values()].sort((a,b)=>b.cancelled-a.cancelled||b.maxDelay-a.maxDelay||a.line.localeCompare(b.line));
}
export function feedDiagnostics(statuses){
 return Object.entries(statuses||{}).map(([source,status])=>({source,status:String(status),ok:status==='ok'}))
 .sort((a,b)=>Number(a.ok)-Number(b.ok)||a.source.localeCompare(b.source));
}
export function matchesFavorite(issue,favorites){
 if(!issue||!Array.isArray(favorites))return false;
 return favorites.some(f=>{
  if(!f||!['line','train','station'].includes(f.type))return false;
  if(f.source&&canon(f.source)!==canon(issue.source))return false;
  const val=canon(f.value);
  if(!val)return false;
  if(f.type==='station')return (issue.stopIds||[]).some(id=>canon(id)===val);
  return val===canon(issue.line)||(f.type==='train'&&val===canon(issue.tripId));
 });
}
export function resolveRollingStock(vehicle){
 if(!vehicle||vehicle.kind!=='train'||vehicle.stale)
  return {name:'Unbekannt',evidence:'Kein aktueller Zugdatensatz'};
 for(const key of ['vehicleModel','rollingStockType','modelName']){
  const label=vehicle[key];
  if(typeof label==='string'&&label.trim().length>=2&&label.trim().length<=80)
   return {name:label.trim(),evidence:'Modellbezeichnung im Fahrzeugdatensatz'};
 }
 return {name:'Unbekannt',evidence:'Fahrzeug-ID und Zugnummer beweisen keinen Fahrzeugtyp'};
}
