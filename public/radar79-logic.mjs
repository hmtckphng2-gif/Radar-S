/* Radar 7.9 — pure, non-predictive transport source diagnostics. */
import {vehicleLiveQuality} from './radar78-logic.mjs';
const SOURCES=['sta','sta_direct','trentino','trains'];
export function feedHealthRows(vehicles,statuses={},now=Date.now()){
 const map=new Map(SOURCES.map(source=>[source,{source,status:statuses[source]||'unbekannt',total:0,current:0,delayed:0,estimated:0,last:0,newestAge:null}]));
 for(const v of vehicles||[]){const source=String(v?.source||'');if(!map.has(source))continue;const row=map.get(source),q=vehicleLiveQuality(v,now);row.total++;row[q.kind]++;if(Number.isFinite(q.age)&&q.age>=0&&(row.newestAge===null||q.age<row.newestAge))row.newestAge=q.age}
 return [...map.values()];
}
export function formatAge(age){return age===null||!Number.isFinite(age)?'Alter unbekannt':age<60?`${age} Sek.`:`${Math.floor(age/60)} Min.`}
export function stationKey(st){return st&&typeof st.source==='string'&&typeof st.stopId==='string'?st.source+':'+st.stopId:null}
export function safeFavoriteRecords(records,stops){const wanted=new Set((Array.isArray(records)?records:[]).filter(x=>typeof x==='string').slice(0,40));return (stops||[]).filter(st=>wanted.has(stationKey(st))||wanted.has(st.stopId)).slice(0,12)}
