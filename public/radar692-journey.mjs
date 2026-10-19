export function findItineraries({index,details,origin,destination,nowSeconds,minTransfer=240,maxResults=8}={}){
if(!index?.meta?.ready||!index?.trips||!details?.times||!origin||!destination)return {results:[],reason:'Fahrplandaten fehlen'};
if(origin===destination)return {results:[],reason:'Start und Ziel sind gleich'};
const first=[],last=new Map();
for(const [id,times] of Object.entries(details.times)){const trip=index.trips[id];if(!trip||trip[5]===false||!Array.isArray(times))continue;
const name=String(trip[3]||index.routes?.[trip[0]]?.[0]||'Fahrt');
for(let i=0;i<times.length;i++){const row=times[i],stop=String(row[0]),dep=Number(row[2]??row[1]),arr=Number(row[1]??row[2]);
if(stop===String(origin)&&Number.isFinite(dep)&&dep>=nowSeconds-120&&dep<=nowSeconds+21600)
for(let j=i+1;j<times.length;j++){const end=times[j],arrival=Number(end[1]??end[2]);if(Number.isFinite(arrival)&&arrival>=dep)first.push({id,name,dep,arr:arrival,stop:String(end[0])});}
if(stop===String(destination)&&Number.isFinite(arr))
for(let j=0;j<i;j++){const start=times[j],departure=Number(start[2]??start[1]);if(!Number.isFinite(departure)||departure>arr)continue;const key=String(start[0]);if(!last.has(key))last.set(key,[]);last.get(key).push({id,name,dep:departure,arr});}
}}
const found=[],seen=new Set();
for(const a of first){if(a.stop===String(destination)){const key=a.id+':'+a.dep;if(!seen.has(key)){seen.add(key);found.push({legs:[a],dep:a.dep,arr:a.arr,transfer:null});}continue;}
for(const b of last.get(a.stop)||[]){if(a.id===b.id||b.dep<a.arr+minTransfer||b.dep>a.arr+5400)continue;const key=a.id+':'+b.id+':'+a.dep;if(seen.has(key))continue;seen.add(key);found.push({legs:[a,b],dep:a.dep,arr:b.arr,transfer:a.stop,margin:b.dep-a.arr});}}
found.sort((a,b)=>a.dep-b.dep||a.arr-b.arr||a.legs.length-b.legs.length);
return {results:found.slice(0,maxResults),reason:found.length?'':'Keine passende Direkt- oder Umsteigeverbindung in dieser GTFS-Quelle'};}