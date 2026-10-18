/* Shared, lazy platform enrichment. One request per train/day, three concurrent at most. */
import {matchPlatform} from './train-platforms-logic.mjs';
import {trainNumber} from './radar54-logic.mjs';
const cache=new Map(),queue=[],visible=new Set(),observed=new Set(),bindings=new WeakMap();let active=0;
function pump(){while(active<3&&queue.length){const run=queue.shift();active++;run().finally(()=>{active--;pump()})}}
function load(number,day){
 const key=number+':'+day,old=cache.get(key);
 if(old&&(old.promise||Date.now()-old.at<45000))return old.promise||Promise.resolve(old.data);
 const item={at:Date.now(),data:null,promise:null};
 item.promise=new Promise(resolve=>{queue.push(async()=>{
  try{const r=await fetch(`/api/train-platforms/${number}?day=${encodeURIComponent(day)}`,{signal:AbortSignal.timeout(20000)});if(r.ok)item.data=await r.json()}catch{}
  item.at=Date.now();item.promise=null;resolve(item.data);
 });});cache.set(key,item);pump();return item.promise||Promise.resolve(item.data);
}
function paint(element,p){
 element.textContent='Gleis '+p.current+(p.changed?' · geändert':p.live?' · gemeldet':' · Plan')+' · Trenitalia';
 element.title=p.source+(p.changed?' · geplant: Gleis '+p.planned:'');
 element.classList.toggle('sr54-platform-changed',p.changed);element.style.color=p.changed?'#ffc37d':'';
}
async function refresh(element){
 const binding=bindings.get(element);if(!binding||!element.isConnected||document.hidden)return;
 // Clear a previously enriched value before retrying: expired tracks must not look current.
 element.textContent=binding.text;element.title=binding.title;element.style.color=binding.color;
 element.classList.toggle('sr54-platform-changed',binding.changed);
 const data=await load(binding.context.number,binding.context.serviceDay);
 if(!element.isConnected||bindings.get(element)!==binding)return;
 const p=matchPlatform(data,binding.context);
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
setInterval(()=>{
 for(const element of observed)if(!element.isConnected){observer?.unobserve(element);observed.delete(element);visible.delete(element)}
 for(const element of visible)refresh(element);
 for(const [key,item] of cache)if(!item.promise&&Date.now()-item.at>300000)cache.delete(key);
},60000);
