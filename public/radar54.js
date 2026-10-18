/* Radar 5.4 — openable timetable journeys and honest device-local delay history. */
import {aggregateDays,recordObservation,trainNumber,platformInfo} from './radar54-logic.mjs';
import {enrichTrainPlatform} from './train-platforms.js?v=5.4.4';
import {romeDay,dateGTFSValid} from './radar51-logic.mjs';
import {isRailRoute,formatClock,vehicleDelayInfo} from './core.js';
(()=>{
'use strict';
const $=id=>document.getElementById(id),mk=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
const btn=(text,fn,cls='sr54-button')=>{const b=mk('button',cls,text);b.type='button';b.onclick=fn;return b};
const KEY='sr54_train_observations_v1';
let bridge,dialog,body,selection=null,days=7,started=false,request=0,samples=[],storageOk=true;
try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');samples=Array.isArray(a)?a.filter(s=>s&&Number.isFinite(s.t)&&Number.isFinite(s.minutes)&&typeof s.number==='string'):[]}catch{storageOk=false}
const validUpdate=(u,source)=>u&&bridge?.state.statuses[source+'_updates']==='ok'&&Number.isFinite(u.fetchedAt)&&Date.now()-u.fetchedAt<=120000&&Date.now()>=u.fetchedAt-30000;
function capture(){
 const state=bridge?.state;if(!state)return;let next=samples;
 for(const [key,u] of state.updates){
  const split=key.indexOf(':'),source=key.slice(0,split),tripId=key.slice(split+1);
  if(!validUpdate(u,source))continue;
  const db=state.indexes[source],trip=db?.trips?.[tripId];
  if(!dateGTFSValid(db)||!trip||!isRailRoute(db.routes?.[trip[0]]?.[2]))continue;
  const number=trainNumber(trip[3]);if(!number)continue;
  const today=romeDay(),day=String(u.tripStartDate||today).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  if(day!==today)continue;
  const vehicle=[...state.vehicles.values()].find(v=>v.source===source&&v.tripId===tripId);
  const info=vehicleDelayInfo(u,vehicle||{});if(info?.delay===null||info?.delay===undefined)continue;
  const minutes=Math.round(Number(info.delay)/60);if(!Number.isFinite(minutes))continue;
  const t=u.timestamp?u.timestamp*1000:u.fetchedAt;
  next=recordObservation(next,{number,day,source,tripId,minutes,t},Date.now());
 }
 if(next!==samples){samples=next;try{localStorage.setItem(KEY,JSON.stringify(samples));storageOk=true}catch{storageOk=false}}
 // The dialog refreshes on explicit selection or range changes, preserving scroll and focus.
}
function historyCard(){
 const card=mk('section','sr54-history');card.append(mk('h3','','Verspätungen der letzten Tage'));
 const controls=mk('div','sr54-periods');
 for(const n of [7,30]){const b=btn(n+' Tage',()=>{days=n;render()},'sr54-filter');b.setAttribute('aria-pressed',String(days===n));controls.append(b)}card.append(controls);
 const rows=aggregateDays(samples,selection.number,days,romeDay()),present=rows.filter(d=>d.count),count=rows.reduce((n,d)=>n+d.count,0);
 if(!count){card.append(mk('p','sr54-empty','Noch keine Messungen für diesen Zug. Die Historie beginnt mit tatsächlich empfangenen Verspätungen ab Nutzung von 5.4.'));}
 else{
  const chart=mk('div','sr54-day-chart');chart.setAttribute('role','img');chart.setAttribute('aria-label','Täglicher Durchschnitt der empfangenen Verspätungswerte in Minuten. Lücken bedeuten keine Daten.');
  const max=Math.max(1,...present.map(x=>Math.abs(x.minutes)));
  for(const r of rows){
   const cell=mk('div','sr54-day'),bar=mk('div','sr54-day-bar');
   if(r.count){bar.style.height=(8+Math.abs(r.minutes)/max*65)+'px';bar.classList.add(r.minutes>0?'late':'ontime');}
   else bar.classList.add('missing');
   cell.title=r.day+': '+(r.count?(r.minutes>0?'+':'')+r.minutes+' Min. · '+r.count+' Messungen':'Keine Messungen');
   const value=mk('span','',r.count?(r.minutes>0?'+':'')+r.minutes:'–');
   cell.append(value,bar,mk('small','',r.day.slice(8)));chart.append(cell);
  }card.append(chart);
  card.append(mk('p','sr54-muted',count+' Messungen an '+present.length+' Tagen · Ø gemeldete Abweichung pro Tag (Min.). Keine Ankunfts- oder Pünktlichkeitsstatistik.'));
 }
 const detail=mk('details','sr54-data-info');detail.append(mk('summary','','Daten & einzelne Tage'));
 detail.append(mk('p','sr54-muted','Auf diesem Gerät gespeichert, während Radar geöffnet ist. Keine rückwirkenden oder geräteübergreifenden Daten. Fehlende Werte heißen nicht pünktlich.'));
 if(count){const table=mk('table','sr54-history-table');const head=mk('tr','');for(const t of ['Datum','Ø Min.','Messungen'])head.append(mk('th','',t));table.append(head);
  for(const r of [...rows].reverse()){const tr=mk('tr','');for(const v of [r.day,r.minutes===null?'–':r.minutes,r.count])tr.append(mk('td','',v));table.append(tr)}detail.append(table)}
 card.append(detail);if(!storageOk)card.append(mk('p','sr54-warning','Speichern nicht verfügbar. Neue Messungen bleiben nur in dieser Sitzung.'));
 return card;
}
function platformText(platform){return 'Gleis '+(platform.current||'unbekannt')+(platform.changed?' · geändert':platform.live?' · gemeldet':platform.current?' · Plan':'')}
function render(){
 if(!selection||!body)return;body.replaceChildren();const s=bridge.state;
 const head=mk('div','sr54-dialog-head');head.append(mk('small','sr54-kicker','FAHRT & VERLAUF · '+romeDay()),mk('h2','','Zug '+selection.number));
 head.append(btn('✕',()=>dialog.close(),'sr54-close'));body.append(head);
 const trip=s.indexes[selection.source]?.trips?.[selection.tripId];
 if(trip){body.append(mk('p','sr54-destination','→ '+(trip[1]||'Ziel unbekannt')));
  const v=[...s.vehicles.values()].find(v=>v.source===selection.source&&v.tripId===selection.tripId);
  if(v&&s.markers.has(v.key))body.append(btn('⌖ Auf Karte öffnen',()=>{dialog.close();document.querySelector('.sr50-nav-btn[data-tab="map"]')?.click();s.markers.get(v.key)?.marker.fire('click')}));
  const det=s.details[selection.source],times=det?.times?.[selection.tripId];
  if(Array.isArray(times)&&dateGTFSValid(s.indexes[selection.source])){
   const u=s.updates.get(selection.source+':'+selection.tripId),useRT=validUpdate(u,selection.source)&&(!u.tripStartDate||String(u.tripStartDate).replaceAll('-','')===romeDay().replaceAll('-',''));
   const cancelled=useRT&&/^(CANCELED|CANCELLED|3)$/i.test(String(u.scheduleRelationship||''));
   if(cancelled)body.append(mk('p','sr54-cancelled','Fahrt fällt aus · laut aktueller Echtzeitmeldung'));
   const route=mk('details','sr54-itinerary');route.open=true;route.append(mk('summary','','Fahrtverlauf · '+times.length+' Halte'));
   const list=mk('ol','sr54-stops');
   for(const [stopId,arrival,departure,seq] of times){const st=det.stops?.[stopId];const rt=useRT?(u.stops||[]).find(x=>String(x.stopId??x.stop_id)===String(stopId)||(!(x.stopId??x.stop_id)&&Number(x.stopSequence??x.stop_sequence)===Number(seq))):null;
    const li=mk('li','sr54-stop'),left=mk('div','');
    const platform=platformInfo(st,rt,det.stops),track=mk('small','',platformText(platform));
    left.append(mk('strong','',st?.[0]||'Haltestelle unbekannt'),track);
    enrichTrainPlatform(track,{number:selection.number,serviceDay:romeDay(),source:selection.source,stopId,stopName:st?.[0],arrival,departure,terminal:times.at(-1)?.[0]===stopId&&times.at(-1)?.[3]===seq},platform);
    const skipped=/^(SKIPPED|1)$/i.test(String(rt?.scheduleRelationship??rt?.schedule_relationship??''));
    const time=departure??arrival;const delay=rt?.departure?.delay??rt?.arrival?.delay;
    const clock=mk('div','sr54-stop-clock');clock.append(mk('strong','',cancelled||skipped?'Entfällt':formatClock(time)));
    if(!cancelled&&!skipped&&delay!==null&&delay!==undefined&&Number.isFinite(Number(delay))){clock.append(mk('small','',`Prognose ${formatClock(Number(time)+Number(delay))} · ${Number(delay)>0?'+':''}${Math.round(Number(delay)/60)}′`));}
    li.append(left,clock);list.append(li);
   }route.append(list);body.append(route);
  }else body.append(mk('p','sr54-empty','Kein gültiger Fahrtverlauf für heute verfügbar.'));
 }else{
  body.append(mk('p','sr54-muted','Zugnummer suchen und vergangene Beobachtungen ansehen. Ein Fahrplan ist keine bestätigte Live-Ortung.'));
  const candidates=[];
  for(const [source,db] of Object.entries(s.indexes))if(dateGTFSValid(db))for(const [tripId,t] of Object.entries(db.trips||{})){
   if(String(t[3])===selection.number&&t[5]!==false&&isRailRoute(db.routes?.[t[0]]?.[2]))candidates.push({source,tripId,number:selection.number,title:t[1]});
  }
  for(const c of candidates.slice(0,8))body.append(btn(c.source.toUpperCase()+' · '+c.title,()=>openTrain(c),'sr54-journey-choice'));
 }
 body.append(historyCard());
}
async function openTrain(value){
 const number=trainNumber(value.number);if(!number)return;
 selection={...value,number};const token=++request;render();
 if(!dialog.open)dialog.showModal();
 // Reuse the application's detail cache and pending request handling.
 try{await bridge.getStationList?.()}catch{}
 if(token===request&&dialog.open)render();
}
function init(){
 if(started)return;bridge=window.SuedtirolRadar37;if(!bridge?.state?.map)return;started=true;
 dialog=mk('dialog','sr54-dialog');dialog.id='sr54TrainDialog';dialog.setAttribute('aria-label','Zugfahrt und Verspätungsverlauf');body=mk('div','sr54-dialog-body');dialog.append(body);document.body.append(dialog);
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 const version=()=>{const v=document.querySelector('.brand-title em');if(v&&v.textContent!=='5.5')v.textContent='5.5';document.title='Südtirol Radar 5.5 · Züge & Busse'};
 version();const brand=document.querySelector('.brand-title');if(brand)new MutationObserver(version).observe(brand,{subtree:true,childList:true,characterData:true});
 const viewport=$('viewportBadge');if(viewport)viewport.setAttribute('title','Fahrzeuge im Kartenausschnitt · Tippen für Übersicht');
 document.addEventListener('sr37:feeds',capture);document.addEventListener('sr54:open-train',e=>openTrain(e.detail));
 window.SuedtirolRadar54={version:'5.4',openTrain};capture();
 // Update freshness and stop old animation jobs even if feeds stop responding.
 setInterval(()=>{if(!document.hidden){bridge.refreshMarkers()}},15000);
}
document.addEventListener('sr37:ready',init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
