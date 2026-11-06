import {normalizeStation,stationTokens} from './radar51-logic.mjs?v=9.9.5';
import {formatStationName,sourceLabel} from './radar92-details.mjs?v=9.9.5&rev=station-labels-2';

function canonicalStationTokens(name){return [...new Set(stationTokens(name).filter(t=>!['di','del','della','dello','dei','degli','delle','the','of'].includes(t)))].sort()}
function stationDistanceMeters(a,b){
 const lat1=Number(a?.lat),lon1=Number(a?.lon),lat2=Number(b?.lat),lon2=Number(b?.lon);
 if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return 0;
 const r=Math.PI/180,dLat=(lat2-lat1)*r,dLon=(lon2-lon1)*r,h=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function groupStationChoices(stations,maxDistance=350){
 const groups=[];
 for(const st of Array.isArray(stations)?stations:[]){
  const nameKey=canonicalStationTokens(st?.name).join('|')||normalizeStation(st?.name),source=String(st?.source||''),stopId=String(st?.stopId??'');
  if(!nameKey||!source||!stopId)continue;
  let group=groups.find(g=>g.source===source&&g.nameKey===nameKey&&stationDistanceMeters(g,st)<=maxDistance);
  if(!group){group={...st,nameKey,stopIds:[]};groups.push(group)}
  if(!group.stopIds.includes(stopId))group.stopIds.push(stopId);
 }
 return groups.map(({nameKey,...g})=>({...g,stopIds:g.stopIds.slice(),stopCount:g.stopIds.length}));
}
export function formatConnectionStationChoice(station){
 const raw=normalizeStation(station?.name),tokens=canonicalStationTokens(station?.name),isBolzano=tokens.includes('bolzano')&&tokens.every(t=>t==='bolzano'||t==='bozen'),name=station?.source==='trains'&&isBolzano?'Bolzano/Bozen Bahnhof':formatStationName(station?.name);
 const source=sourceLabel(station?.source),count=Array.isArray(station?.stopIds)?station.stopIds.length:1;
 return name+' · '+source+(count>1?' · '+count+' Haltestellen':'');
}

export function findItineraries({index,details,origin,destination,nowSeconds,minTransfer=240,maxResults=8}={}){
if(!index?.meta?.ready||!index?.trips||!details?.times||origin==null||destination==null)return {results:[],reason:'Fahrplandaten fehlen'};
const origins=new Set((Array.isArray(origin)?origin:[origin]).map(String).filter(Boolean));
const destinations=new Set((Array.isArray(destination)?destination:[destination]).map(String).filter(Boolean));
if(!origins.size||!destinations.size)return {results:[],reason:'Fahrplandaten fehlen'};
if([...origins].some(id=>destinations.has(id)))return {results:[],reason:'Start und Ziel sind gleich'};
const first=[],last=new Map();
for(const [id,times] of Object.entries(details.times)){const trip=index.trips[id];if(!trip||trip[5]===false||!Array.isArray(times))continue;
const name=String(trip[3]||index.routes?.[trip[0]]?.[0]||'Fahrt');
for(let i=0;i<times.length;i++){const row=times[i],stop=String(row[0]),dep=Number(row[2]??row[1]),arr=Number(row[1]??row[2]);
if(origins.has(stop)&&Number.isFinite(dep)&&dep>=nowSeconds-120&&dep<=nowSeconds+21600)
for(let j=i+1;j<times.length;j++){const end=times[j],arrival=Number(end[1]??end[2]);if(Number.isFinite(arrival)&&arrival>=dep)first.push({id,name,dep,arr:arrival,stop:String(end[0])});}
if(destinations.has(stop)&&Number.isFinite(arr))
for(let j=0;j<i;j++){const start=times[j],departure=Number(start[2]??start[1]);if(!Number.isFinite(departure)||departure>arr)continue;const key=String(start[0]);if(!last.has(key))last.set(key,[]);last.get(key).push({id,name,dep:departure,arr});}
}}
const found=[],seen=new Set();
for(const a of first){if(destinations.has(a.stop)){const key=a.id+':'+a.dep;if(!seen.has(key)){seen.add(key);found.push({legs:[a],dep:a.dep,arr:a.arr,transfer:null});}continue;}
for(const b of last.get(a.stop)||[]){if(a.id===b.id||b.dep<a.arr+minTransfer||b.dep>a.arr+5400)continue;const key=a.id+':'+b.id+':'+a.dep;if(seen.has(key))continue;seen.add(key);found.push({legs:[a,b],dep:a.dep,arr:b.arr,transfer:a.stop,margin:b.dep-a.arr});}}
found.sort((a,b)=>a.dep-b.dep||a.arr-b.arr||a.legs.length-b.legs.length);
return {results:found.slice(0,maxResults),reason:found.length?'':'Keine passende Direkt- oder Umsteigeverbindung in dieser GTFS-Quelle'};}
