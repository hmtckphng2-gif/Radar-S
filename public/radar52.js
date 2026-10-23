/* Südtirol Radar 5.2 — cinematic focus, route, verified delay history,
   arrival board and same-line vehicles. No changes to feed/map renderer. */
import {sameLine,shapeSections,addDelaySample,localTime} from './radar52-logic.mjs?v=9.9.0';
(function(){
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const button=(txt,fn,cls='sr52-button')=>{const b=el('button',cls,txt);b.type='button';b.onclick=fn;return b};
const rm=matchMedia('(prefers-reduced-motion: reduce)');
let bridge=null,map=null,started=false,focusKey=null,previous=null,focusTimer=0,animating=false,userMoved=false,routeLayer=null,routeCard=null,delayCard=null,lineCard=null,delayHistory=new Map(),boardObserver=null;
const current=()=>bridge?.state?.vehicles?.get(bridge.state.selectedKey)||null;
const active=()=>bridge?.state?.activeSheet==='vehicle'&&!!current();
function clearLayers(){routeLayer?.clearLayers()}
function focus(v){
 if(window.SuedtirolRadar71?.enabled)return;
 if(!map||!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon)))return;
 if(focusKey===v.key)return;
 if(focusKey!==v.key){previous={center:map.getCenter(),zoom:map.getZoom()};userMoved=false}
 focusKey=v.key;
 const marker=bridge.state.markers.get(v.key)?.marker;
 const pos=marker?.getLatLng?.()||[v.lat,v.lon];
 const zoom=Math.min(map.getMaxZoom?.()||17,Math.max(13,Math.min(15,map.getZoom()+2)));
 const height=$('sheet')?.getBoundingClientRect().height||200;
 const offset=Math.min(map.getSize().y*.24,height*.45);
 const centered=map.unproject(map.project(pos,zoom).add([0,offset]),zoom);
 map.stop();
 animating=true;clearTimeout(focusTimer);
 try{
  if(rm.matches)map.setView(centered,zoom,{animate:false});
  else map.flyTo(centered,zoom,{animate:true,duration:.75,easeLinearity:0.22});
 }catch(e){console.info('Radar 5.2 focus fallback',e);map.setView(centered,zoom,{animate:false})}
 focusTimer=setTimeout(()=>{animating=false},1400);
}
function resetFocus(){
 clearLayers();focusKey=null;clearTimeout(focusTimer);
 const saved=previous;previous=null;
 if(saved&&!userMoved&&map&&$('sr50MapTab')&&!$('sr50MapTab').classList.contains('sr50-map-inactive')){
  animating=true;
  try{if(rm.matches)map.setView(saved.center,saved.zoom,{animate:false});else map.flyTo(saved.center,saved.zoom,{duration:.8,animate:true})}catch{}
  focusTimer=setTimeout(()=>animating=false,1100);
 }
 userMoved=false;
}
function routeVisual(){
 if(!routeCard||!active())return;
 routeCard.replaceChildren();clearLayers();const v=current();
 const title=el('div','sr52-card-title','◉ Streckenverfolgung 2.0');routeCard.append(title);
 const target=bridge.routeMatchFor?.(v),path=target?.path;
 const pieces=shapeSections(path,target?.along);
 if(!pieces){routeCard.append(el('p','sr52-muted','Keine eindeutig zugeordnete GTFS-Strecke. Route wird nicht geraten.'));return}
 const bounds=map.getBounds();
 const options={interactive:false,smoothFactor:1.2,weight:4,opacity:.9};
 const make=(coords,style)=>{if(coords.length>1)L.polyline(coords,{...options,...style}).addTo(routeLayer)};
 make(pieces.past,{color:'#51c6ff'});
 make(pieces.future,{color:'#a4b7d4',dashArray:'6 9',opacity:.72,weight:3});
 routeCard.append(el('p','sr52-muted','Blau: GTFS-Strecke bis zur letzten Feedposition. Gestrichelt: folgende Strecke. Das ist kein aufgezeichneter GPS-Verlauf.'));
 routeCard.append(button('Gesamte Strecke zeigen',()=>{
  if(!path?.length)return;
  const latlngs=path.filter(x=>Array.isArray(x)&&x.length>=2);
  if(latlngs.length>1)map.fitBounds(L.latLngBounds(latlngs),{padding:[48,48],maxZoom:13,animate:!rm.matches});
 }));
}
function updateDelayHistory(){
 const s=bridge?.state;if(!s)return;
 for(const v of s.vehicles.values()){
  if(!v.tripId||s.statuses?.[v.source+'_updates']!=='ok')continue;
  const update=s.updates?.get(v.source+':'+v.tripId);
  if(!update || (v.tripStartDate&&update.tripStartDate&&String(v.tripStartDate).replaceAll('-','')!==String(update.tripStartDate).replaceAll('-','')))continue;
  const key=v.source+':'+v.tripId+':'+(v.tripStartDate||'');
  const old=delayHistory.get(key)||[];const next=addDelaySample(old,update);
  if(next.length!==old.length)delayHistory.set(key,next);
 }
 if(delayHistory.size>400){const activeKeys=new Set([...s.vehicles.values()].map(v=>v.source+':'+v.tripId+':'+(v.tripStartDate||'')));for(const k of delayHistory.keys())if(!activeKeys.has(k))delayHistory.delete(k)}
}
function renderDelay(){
 if(!delayCard||!active())return;delayCard.replaceChildren();
 delayCard.append(el('div','sr52-card-title','▥ Verspätungsverlauf'));
 const v=current(),key=v.source+':'+v.tripId+':'+(v.tripStartDate||''),points=delayHistory.get(key)||[];
 if(!points.length){delayCard.append(el('p','sr52-muted','Noch keine frischen, passenden GTFS-RT-Verspätungswerte empfangen.'));return}
 const last=points.at(-1);delayCard.append(el('strong','sr52-delay-value',(last.min>0?'+':'')+last.min+' Min.'));
 if(points.length<2){delayCard.append(el('p','sr52-muted','Erster Messwert gespeichert. Die Kurve erscheint nach einer weiteren aktualisierten Meldung.'));return}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 115');svg.setAttribute('role','img');svg.setAttribute('aria-label','Tatsächlich empfangene Verspätungsmeldungen im Verlauf dieser Sitzung');
 const min=Math.min(0,...points.map(p=>p.min))-1,max=Math.max(0,...points.map(p=>p.min))+1;
 const first=points[0].t,end=points.at(-1).t;
 const xy=p=>[12+(p.t-first)/Math.max(1,end-first)*296,100-(p.min-min)/(max-min)*85];
 const poly=document.createElementNS(ns,'polyline');poly.setAttribute('points',points.map(p=>xy(p).join(',')).join(' '));poly.setAttribute('fill','none');poly.setAttribute('stroke','#56d4ff');poly.setAttribute('stroke-width','3');poly.setAttribute('stroke-linecap','round');poly.setAttribute('stroke-linejoin','round');svg.append(poly);
 const line=document.createElementNS(ns,'line');const zero=100-(0-min)/(max-min)*85;for(const [k,v] of Object.entries({x1:12,y1:zero,x2:308,y2:zero,stroke:'#7d92ac','stroke-dasharray':'3 6'}))line.setAttribute(k,v);svg.insertBefore(line,poly);
 delayCard.append(svg,el('p','sr52-muted',points.length+' verschiedene Feedmeldungen · nur diese geöffnete App-Sitzung · keine erfundene Historie.'));
}
function renderLine(){
 if(!lineCard||!active())return;lineCard.replaceChildren();const v=current();
 if(v.kind!=='bus'||v.lineVerified!==true){lineCard.hidden=true;return}lineCard.hidden=false;
 const vehicles=[...bridge.state.vehicles.values()].filter(other=>sameLine(v,other));
 lineCard.append(el('div','sr52-card-title','▤ Linie '+v.name+' · '+vehicles.length+' Fahrzeuge im Feed'));
 for(const other of vehicles.slice(0,12)){
  const row=button((other.key===v.key?'● ':'○ ')+(other.headsign||'Ziel unbekannt'),()=>{
   if(other.key===v.key)return;
   const marker=bridge.state.markers.get(other.key)?.marker;
   if(marker?.fire)marker.fire('click');
  },'sr52-line-row');row.title='Fahrzeug auf Karte auswählen';lineCard.append(row)
 }
 lineCard.append(el('p','sr52-muted','Fahrzeuge derselben verifizierten Linie. Unterschiedliche Fahrtziele können beide Richtungen umfassen.'));
}
function makeCards(){
 const sheet=$('sheet'),container=sheet?.querySelector('.sheet-scroll');if(!container)return;
 routeCard=el('section','sr52-card');routeCard.id='sr52RouteCard';
 delayCard=el('section','sr52-card');delayCard.id='sr52DelayCard';
 lineCard=el('section','sr52-card');lineCard.id='sr52LineCard';
 const cmp=$('sr51TrainCompare');if(cmp)cmp.insertAdjacentElement('afterend',routeCard);else container.prepend(routeCard);
 routeCard.insertAdjacentElement('afterend',delayCard);delayCard.insertAdjacentElement('afterend',lineCard);
}
function selected(){
 if(!active())return;
 const v=current();focus(v);
 setTimeout(()=>{if(active()&&current()?.key===v.key){routeVisual();renderDelay();renderLine()}},100);
}
function refresh(){updateDelayHistory();if(active()){routeVisual();renderDelay();renderLine()}}
function addArrivalToggle(){
 const board=$('sr51InlineBoard');if(!board||board.hidden||board.querySelector('#sr52ArrivalsToggle'))return;
 const title=board.querySelector('.sr51-board-head h2')?.textContent?.trim();if(!title)return;
 const controls=board.querySelector('.sr51-board-controls');if(!controls)return;
 const b=button('Ankünfte',()=>toggleArrivals(board,b,title));b.id='sr52ArrivalsToggle';controls.append(b);
}
async function toggleArrivals(board,buttonEl,name){
 const existing=board.querySelector('#sr52Arrivals');if(existing){existing.remove();board.querySelector('.sr51-departure-list')?.removeAttribute('hidden');buttonEl.textContent='Ankünfte';return}
 const list=el('div','sr52-arrivals');list.id='sr52Arrivals';list.append(el('p','sr52-muted','Lade Ankünfte aus GTFS …'));board.append(list);
 board.querySelector('.sr51-departure-list')?.setAttribute('hidden','');buttonEl.textContent='Abfahrten';
 try{
  const all=await bridge.getStationList();if(!list.isConnected)return;
  const st=all.filter(s=>s.name===name).slice(0,12);
  if(!st.length){list.textContent='Kein eindeutig passender Haltestellendatensatz.';return}
  const rows=[],now=new Date();const rome=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const parts=Object.fromEntries(rome.map(x=>[x.type,x.value]));const sec=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const d=Object.fromEntries(day.map(x=>[x.type,x.value]));const date=`${d.year}-${d.month}-${d.day}`;
  for(const station of st){const s=bridge.state,db=s.indexes?.[station.source],details=s.details?.[station.source];if(!db?.meta?.ready||!db.meta.days?.includes(date)||!details?.times)continue;
   for(const [tripId,times] of Object.entries(details.times)){
    const trip=db.trips?.[tripId];if(!trip||trip[5]===false)continue;
    for(const item of times){if(String(item[0])!==String(station.stopId))continue;
     const t=Number(item[1]);if(!Number.isFinite(t)||t<sec-180||t>sec+14400)continue;
     const line=station.source==='trains'?String(trip[3]||'Zug'):String(db.routes?.[trip[0]]?.[0]||'Bus');
     rows.push({id:station.source+':'+tripId+':'+t,line,dest:String(trip[1]||'Ziel unbekannt'),t,source:station.source});
    }
   }
  }
  rows.sort((a,b)=>a.t-b.t);list.replaceChildren(el('p','sr52-muted','Ankünfte in den nächsten 4 Stunden · ausschließlich heutiger GTFS-Fahrplan. Keine Echtzeitankunft ohne zugeordnete Meldung.'));
  const seen=new Set();let count=0;for(const row of rows){if(seen.has(row.id)||count>=50)continue;seen.add(row.id);count++;
   const item=el('div','sr52-arrival-row');item.append(el('strong','',row.line+' · '+row.dest),el('span','',localTime(row.t)+' · Plan'));list.append(item)
  }
  if(!count)list.append(el('p','sr52-muted','Keine Ankünfte in diesem Zeitraum im gültigen GTFS-Index.'));
 }catch(err){list.textContent='Ankunftsdaten konnten nicht geladen werden.';console.info('Radar 5.2 arrivals',err)}
}
function init(){
 if(started)return;bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
 if(!map||!window.L||!$('sheet')||!$('sr50MapTab'))return;
 started=true;routeLayer=L.layerGroup().addTo(map);makeCards();
 map.on('movestart',()=>{if(focusKey&&!animating)userMoved=true});
 const interrupt=()=>{if(focusKey){userMoved=true;map.stop();animating=false;clearTimeout(focusTimer)}};
 map.on('dragstart',interrupt);
 map.getContainer().addEventListener('wheel',interrupt,{passive:true});
 map.getContainer().addEventListener('touchstart',e=>{if(e.touches.length>1)interrupt()},{passive:true});
 document.addEventListener('sr37:selection',selected);
 document.addEventListener('sr37:sheet-closed',resetFocus);
 document.addEventListener('sr37:feeds',refresh);
 document.addEventListener('sr37:shapes',()=>{if(active())routeVisual()});
 boardObserver=new MutationObserver(()=>{if(!$('sr51InlineBoard')?.hidden&&!$('sr52ArrivalsToggle'))queueMicrotask(addArrivalToggle)});
 const b=$('sr51InlineBoard');if(b)boardObserver.observe(b,{childList:true,subtree:true,attributes:false});
 updateDelayHistory();if(active())selected();
 window.SuedtirolRadar52={version:'5.2',refresh};
}
document.addEventListener('sr37:ready',init);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
