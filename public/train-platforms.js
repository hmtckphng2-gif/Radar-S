/* Shared, lazy platform enrichment. One request per train/day, three concurrent at most. */
import {matchPlatform} from './train-platforms-logic.mjs?v=9.6.0';
import {trainNumber} from './radar54-logic.mjs?v=9.6.0';
import {resolveStation,matchRFI} from './rfi-platforms-logic.mjs?v=9.6.0';
const cache=new Map(),queue=[],visible=new Set(),observed=new Set(),bindings=new WeakMap();let active=0;
function pump(){while(active<3&&queue.length){const run=queue.shift();active++;run().finally(()=>{active--;pump()})}}
function loadURL(key,url){
 const old=cache.get(key);
 if(old&&(old.promise||Date.now()-old.at<45000))return old.promise||Promise.resolve(old.data);
 const item={at:Date.now(),data:null,promise:null};
 item.promise=new Promise(resolve=>{queue.push(async()=>{
  try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(r.ok)item.data=await r.json()}catch{}
  item.at=Date.now();item.promise=null;resolve(item.data);
 });});cache.set(key,item);pump();return item.promise||Promise.resolve(item.data);
}
function paint(element,p){
 element.textContent='Gleis '+p.current+(p.changed?' · geändert':p.live?' · gemeldet':' · Plan')+' · '+(p.source==='RFI'?'RFI':'Trenitalia');
 element.title=p.source+(p.changed?' · geplant: Gleis '+p.planned:'');
 element.classList.toggle('sr54-platform-changed',p.changed);element.style.color=p.changed?'#ffc37d':'';
}
async function refresh(element){
 const binding=bindings.get(element);if(!binding||!element.isConnected||document.hidden)return;
 // Clear a previously enriched value before retrying: expired tracks must not look current.
 element.textContent=binding.text;element.title=binding.title;element.style.color=binding.color;
 element.classList.toggle('sr54-platform-changed',binding.changed);
 const c=binding.context;
 const station=resolveStation(c);
 // Prefer station monitors: the legacy train lookup is rejected by the provider in production.
 let p=null;
 if(station){
  const board=await loadURL('rfi:'+station.placeId+':'+Boolean(c.terminal),`/api/station-platforms/${station.placeId}?arrivals=${c.terminal?'1':'0'}`);
  p=matchRFI(board,c);
 }
 if(!p){
  const data=await loadURL(c.number+':'+c.serviceDay,`/api/train-platforms/${c.number}?day=${encodeURIComponent(c.serviceDay)}`);
  p=matchPlatform(data,c);
 }
 if(!element.isConnected||bindings.get(element)!==binding)return;
 if(p&&!binding.base?.live)paint(element,p);
}
const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
 for(const e of entries){if(e.isIntersecting){visible.add(e.target);refresh(e.target)}else visible.delete(e.target)}
}):null;
export function enrichTrainPlatform(element,context,base){
 const number=trainNumber(context.number),day=String(context.serviceDay||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
 if(!number||!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
 bindings.set(element,{context:{...context,number,serviceDay:day},base,text:element.textContent,title:element.title,color:element.style.color,changed:element.classList.contains('sr54-platform-changed')});
 if(observer){observed.add(element);observer.observe(element)}else queueMicrotask(()=>refresh(element));
}
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)for(const element of visible)refresh(element);
});
setInterval(()=>{
 for(const element of observed)if(!element.isConnected){observer?.unobserve(element);observed.delete(element);visible.delete(element)}
 for(const element of visible)refresh(element);
 for(const [key,item] of cache)if(!item.promise&&Date.now()-item.at>300000)cache.delete(key);
},60000);
