/* Radar 5.7 Graphite Intelligence — additive station-first monitor.
   Reuses existing GTFS rows and Radar 5.4 train history. No map rendering changes. */
import {findStations,nearbyStationGroup,buildDepartureRows,romeDay} from './radar51-logic.mjs';
import {mergeStationDepartures} from './radar53-logic.mjs';
import {trainHistory,supportedRecovery} from './radar57-logic.mjs';
import {trainScheduledPosition} from './radar51-logic.mjs';
(()=>{
'use strict';
const KEY='sr57_station_v1',HISTORY='sr54_train_observations_v1';
const $=id=>document.getElementById(id);
const el=(tag,cls='',value)=>{const n=document.createElement(tag);n.className=cls;if(value!==undefined)n.textContent=String(value);return n};
const button=(label,fn,cls='sr57-button')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n};
let bridge,stations=[],chosen=null,filter='all',view,board,search,picker,dialog,request=0,refreshTimer;
function save(st){try{localStorage.setItem(KEY,JSON.stringify({source:st.source,stopId:st.stopId,name:st.name}))}catch{}}
function stored(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function clock(sec){return String(Math.floor(sec/3600)%24).padStart(2,'0')+':'+String(Math.floor(sec%3600/60)).padStart(2,'0')+(sec>=86400?' +1':'')}
function labelDelay(sec){const m=Math.round(sec/60);return (m>0?'+':'')+m+' min'}
function samples(number){
 try{const a=JSON.parse(localStorage.getItem(HISTORY)||'[]');return Array.isArray(a)?a.filter(x=>x&&String(x.number)===String(number)&&Number.isFinite(x.minutes)&&Number.isFinite(x.t)):[]}catch{return []}
}
function historySummary(number){
 const h=trainHistory(samples(number),String(number),romeDay());
 const count=h.count,days=h.dayCount,avg=h.mean;
 const description=!count?'Für diesen Zug wurden auf diesem Gerät noch keine historischen Verspätungen gemessen.':
 'In '+count+' gespeicherten Messungen an '+days+' Tagen lag die gemeldete Verspätung durchschnittlich bei '+(avg>0?'+':'')+avg.toFixed(1)+' Minuten. Messwerte, keine verifizierten Endankünfte.';
 return {...h,days,avg,description};
}
function evidence(row){
 if(row.cancelled)return null;
 const s=bridge?.state,update=s?.updates?.get?.(row.source+':'+row.tripId);
 return supportedRecovery(row,update,s?.statuses,Date.now(),row.serviceDay);
}
function addHistoryChart(h){
 const chart=el('div','sr57-history-chart');
 chart.setAttribute('role','img');chart.setAttribute('aria-label','Historische gemeldete Verspätungen je Tag, fehlende Tage ohne Messung');
 const recent=h.points.slice(-7);
 const max=Math.max(1,...recent.filter(x=>x.count).map(x=>Math.abs(x.minutes)));
 for(const r of recent){
  const cell=el('div','sr57-history-day');
  cell.append(el('span','',r.count?(r.minutes>0?'+':'')+r.minutes.toFixed(0):'–'));
  const bar=el('div','sr57-history-bar'+(r.count?'':' sr57-history-missing'));
  bar.style.height=(r.count?(10+Math.abs(r.minutes)/max*50):8)+'px';
  cell.append(bar,el('small','',r.day.slice(8)));
  cell.title=r.day+': '+(r.count?r.count+' Messungen · Ø '+r.minutes+' Minuten':'Keine Daten');
  chart.append(cell);
 }
 return chart;
}
function vehicleType(row){
 // Vehicle ID / GTFS labels are not vehicle-model identifiers. Only accept an
 // explicitly model-bearing, non-stale feed field, never infer from train number.
 if(row.kind!=='train')return {name:'Kein Zug',confidence:'n/a'};
 const vehicles=bridge?.state?.vehicles;
 const vehicle=vehicles&&[...vehicles.values()].find(v=>v.kind==='train'&&v.source===row.source&&v.tripId===row.tripId&&!v.stale);
 if(!vehicle)return {name:'Unbekannt',confidence:'Keine Fahrzeugkennung im Live-Feed'};
 const raw=[vehicle.vehicleModel,vehicle.rollingStockType,vehicle.trainType,vehicle.modelName].find(v=>typeof v==='string'&&v.trim());
 if(raw)return {name:raw.trim(),confidence:'Modellbezeichnung aus Fahrzeugdaten'};
 return {name:'Unbekannt',confidence:'Fahrzeug-ID '+String(vehicle.vehicleId||'nicht vorhanden')+' · kein verifiziertes Modell'};
}
function showDetails(row){
 if(!dialog){dialog=el('dialog','sr57-dialog');document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()})}
 dialog.replaceChildren();
 const top=el('div','sr57-dialog-head');top.append(el('div','sr57-kicker',row.kind==='train'?'ZUG INTELLIGENCE':'FAHRTDETAILS'),button('✕',()=>dialog.close(),'sr57-close'));
 dialog.append(top,el('h2','sr57-title',row.number),el('p','sr57-destination',row.headsign));
 const stats=el('div','sr57-metrics'),official=el('div','sr57-metric'),radar=el('div','sr57-metric');
 official.append(el('small','','OFFIZIELL'),el('strong','',row.cancelled?'Ausfall':row.delaySec===null?'–':labelDelay(row.delaySec)));
 const recovery=evidence(row);
 radar.append(el('small','','ERWARTETE AUFHOLUNG'),el('strong','',recovery?'↘ '+recovery.gained+' min':'–'));
 stats.append(official,radar);dialog.append(stats);
 dialog.append(el('p','sr57-explain',row.cancelled?'Diese Fahrt ist laut frischer GTFS-RT-Meldung ausgefallen. Es wird keine Zeitaufholung prognostiziert.':recovery?'An diesem Halt prognostiziert GTFS-RT '+recovery.gained+' Minuten weniger Verspätung als am vorherigen gemeldeten Halt. Radar zeigt die Differenz; es ist keine zusätzliche KI-Vorhersage.':'Noch keine unabhängig belastbare Prognose zur Zeitaufholung. GTFS-RT-Verspätung und Ist-/Soll-Abstand bleiben getrennt.'));
 const vehicleInfo=vehicleType(row);if(row.kind==='train')dialog.append(el('p','sr57-vehicle-type','Fahrzeugtyp: '+vehicleInfo.name+' · '+vehicleInfo.confidence));
 const schedule=el('div','sr57-schedule');schedule.append(el('span','','Fahrplan '+clock(row.sec)),el('span','',row.forecast===null?'Livezeit unbekannt':'Gemeldet '+clock(row.forecast)));dialog.append(schedule);
 if(row.kind==='train'){
  const h=historySummary(row.number);
  dialog.append(el('h3','','Historische Verspätungen'),el('p','sr57-explain',h.description));
  if(h.count)dialog.append(addHistoryChart(h));
  if(h.count)dialog.append(el('p','sr57-count','Datengrundlage: '+h.count+' Messungen / '+h.days+' Tage · nur dieses Gerät'));
  dialog.append(el('h3','','Radar Intelligence'),el('p','sr57-explain',!row.cancelled&&h.sufficient?'Die aktuelle offizielle Meldung liegt '+(row.delaySec===null?'nicht vor.':(Math.round(row.delaySec/60)>h.avg?'über':'bei oder unter')+' dem lokal gemessenen Durchschnitt. Diese Daten allein erlauben keine zuverlässige Zeitaufholungsprognose.'): 'Für eine aussagekräftige KI-artige Zusammenfassung fehlen noch genügend unabhängige Messungen.'));
  const v=[...bridge.state.vehicles.values()].find(x=>x.kind==='train'&&x.source===row.source&&x.tripId===row.tripId);
  if(v){
   const compare=trainScheduledPosition(v,bridge.state.indexes,bridge.state.details,bridge.state.shapes,new Date());
   if(compare){
    dialog.append(el('h3','','Ist-/Soll-Position'));
    const comparison=el('div','sr57-position');
    const track=el('div','sr57-position-track');
    const before=compare.relative==='hinter dem Soll-Punkt';
    const observed=el('span','sr57-position-pin sr57-position-observed','●');
    const planned=el('span','sr57-position-pin sr57-position-planned','◆');
    observed.style.left=before?'30%':'70%';planned.style.left=before?'70%':'30%';
    track.append(observed,planned);
    const legend=el('div','sr57-position-legend');legend.append(el('span','','● Ist-Position'),el('span','','◆ Soll-Position'));
    comparison.append(el('div','sr57-position-endpoints',compare.from+' → '+compare.to),track,legend);
    comparison.append(el('strong','sr57-position-distance',compare.differenceKm.toFixed(1)+' km '+compare.relative));
    const info=el('details','sr57-position-info');info.append(el('summary','','Wie wird das berechnet?'),el('p','sr57-explain',compare.note+' Die Grafik ist schematisch, nicht maßstabsgetreu. Kilometerdifferenz ist keine berechnete Verspätung.'));
    comparison.append(info);dialog.append(comparison);
   }
  }
  dialog.append(button('Fahrtverlauf und Historie öffnen ↗',()=>{dialog.close();window.SuedtirolRadar54?.openTrain({source:row.source,tripId:row.tripId,number:row.number})},'sr57-primary'));
 }
 dialog.showModal();
}
function choose(st){chosen=st;save(st);picker.hidden=true;search.value='';$('sr57Station').textContent=st.name;render()}
function renderPicker(q=''){
 const list=$('sr57Options');list.replaceChildren();
 const unique=new Map();
 for(const st of findStations(stations,q,Math.max(200,stations.length))){
  const key=String(st.name||'').normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
  if(!key||unique.has(key))continue;
  unique.set(key,st);
  if(unique.size>=30)break;
 }
 for(const st of unique.values()){
  list.append(button(st.name,()=>choose(st),'sr57-option'));
 }
 if(!list.children.length)list.append(el('p','sr57-explain','Keine passende Station in den geladenen GTFS-Daten.'));
}
function render(){
 const seq=++request;board.replaceChildren();
 if(!chosen){board.append(el('p','sr57-empty','Wähle oben einen Bahnhof, um den Abfahrtsmonitor zu öffnen.'));return}
 if(!bridge?.state?.details){board.append(el('p','sr57-empty','Fahrplandaten werden geladen …'));return}
 const group=nearbyStationGroup(stations,chosen);
 const res=buildDepartureRows(group,bridge.state.indexes,bridge.state.details,bridge.state.updates,bridge.state.statuses,{kind:filter});
 const rows=mergeStationDepartures(res.rows).filter(x=>filter==='all'||x.kind===filter);
 if(seq!==request)return;
 const info=el('div','sr57-boardinfo');info.append(el('span','','ABFAHRTEN · NÄCHSTE 4 STUNDEN'),el('span','',rows.length+' FAHRTEN'));board.append(info);
 if(!rows.length){board.append(el('p','sr57-empty',res.reasons.length?'Keine gültigen Fahrplandaten für diesen Bahnhof.':'Keine Abfahrten im aktuellen Zeitraum gefunden.'));return}
 for(const row of rows){
  const item=button('',()=>showDetails(row),'sr57-row');
  const time=el('div','sr57-time');time.append(el('strong','',clock(row.sec)),el('small','',row.kind==='train'?'🚆 ZUG':'🚌 BUS'));
  const route=el('div','sr57-route');route.append(el('strong','sr57-route-number',row.number),el('span','sr57-route-destination',row.headsign+(row.platform?.current?' · '+(row.kind==='train'?'Gleis ':'Steig ')+row.platform.current:'')));
  const delay=el('div','sr57-delay');
  delay.append(el('strong',row.cancelled?'sr57-bad':row.delaySec>0?'sr57-late':'',row.cancelled?'Ausfall':row.delaySec===null?'–':labelDelay(row.delaySec)));
  const gain=evidence(row);delay.append(el('small','',gain?'↘ '+gain.gained+' min GTFS-RT':row.delaySec===null?'Nur Fahrplan':'GTFS-RT'));
  item.append(time,route,delay);board.append(item);
 }
}
function start(){
 bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!bridge?.getStationList||!window.SuedtirolRadar50)return;
 if($('sr57View'))return;
 view=el('section','sr57-view');view.id='sr57View';
 const head=el('header','sr57-header');
 const brand=el('div','sr57-brand');brand.append(el('span','','RADAR'),el('span','sr57-version','5.7'));
 const live=el('span','sr57-live','● GTFS / LIVE WENN VERFÜGBAR');head.append(brand,live);
 const station=button('Bahnhof auswählen ⌄',()=>{picker.hidden=!picker.hidden;if(!picker.hidden){renderPicker();search.focus()}},'sr57-station');station.id='sr57Station';
 const caption=el('div','sr57-caption','AUSGEWÄHLTER BAHNHOF');const stationbox=el('div','sr57-stationbox');stationbox.append(caption,station);
 const filters=el('div','sr57-filters');
 for(const [value,label] of [['all','Alle'],['train','Züge'],['bus','Busse']]){const b=button(label,()=>{filter=value;for(const n of filters.children)n.setAttribute('aria-pressed',String(n===b));render()},'sr57-filter');b.setAttribute('aria-pressed',String(value===filter));filters.append(b)}
 picker=el('section','sr57-picker');picker.hidden=true;search=el('input','sr57-search');search.type='search';search.placeholder='Bahnhof oder Haltestelle suchen';search.setAttribute('aria-label','Bahnhof suchen');search.addEventListener('input',()=>renderPicker(search.value));picker.append(search,el('div','sr57-options'));picker.lastChild.id='sr57Options';
 board=el('div','sr57-board');view.append(head,stationbox,picker,filters,board);
 const dep=$('sr50DeparturesView');dep?.append(view);
 function active(){const is=location.hash==='#departures'||!['#map','#stats','#favorites'].includes(location.hash);view.classList.toggle('sr57-hidden',!is);if(is){dep?.classList.add('active');render()}}
 const original=window.SuedtirolRadar50.switchTab;
 window.SuedtirolRadar50.switchTab=function(name){original(name);active()};
 document.querySelectorAll('.sr50-nav-btn').forEach(b=>b.addEventListener('click',()=>setTimeout(active,0)));
 window.addEventListener('hashchange',active);
 const prior=stored();
 bridge.getStationList().then(list=>{stations=Array.isArray(list)?list:[];if(prior){const st=stations.find(x=>x.source===prior.source&&String(x.stopId)===String(prior.stopId));if(st)choose(st)}if(!chosen){picker.hidden=false;renderPicker()}render()}).catch(()=>board.append(el('p','sr57-empty','Bahnhöfe konnten nicht geladen werden. Bitte Verbindung prüfen.')));
 document.addEventListener('sr37:feeds',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!view.classList.contains('sr57-hidden'))render()},900)});
 // The monitor is the new home. Keep all existing tabs, map and Map-Sync intact.
 original('departures');
 active();
 document.title='Südtirol Radar 5.7 · Graphite Intelligence';
 const version=document.querySelector('.brand-title em');if(version)version.textContent='5.7';
 window.SuedtirolRadar57={version:'5.7',openStation:choose,refresh:render};
 window.SuedtirolRadar50.openStation=choose;
}
let retries=0;function boot(){if(window.SuedtirolRadar57)return;if(window.SuedtirolRadar37?.state?.map&&window.SuedtirolRadar50){start();return}if(retries++<60)setTimeout(boot,200)}
document.addEventListener('sr37:ready',()=>setTimeout(boot,100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
