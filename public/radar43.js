/* Südtirol Radar 4.3.1 — progressive enhancement over the proven 4.2 app.
 * No map remount, no outside tile API, no fabricated GPS or ETAs.
 */
import {classifyPosition,nearbyStations,followNeedsPan,stopSummary} from './radar43-logic.mjs?v=9.8.0';
import {groupNearby} from './radar44-logic.mjs?v=9.8.0';
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let bridge=null,map=null,clusters=null,stopsLayer=null,stations=[],pinsVisible=false,started=false;
 let clusterTimer=null,pinTimer=null,lastSummary='',onlyReal=false,cleanMap=true,priorityKey=null;
 try{cleanMap=localStorage.getItem('sr43-clean-map')!=='off';}catch{}
 function make(tag,cls,label){const el=document.createElement(tag);if(cls)el.className=cls;if(label!=null)el.textContent=label;return el;}
 function markTheme(){document.documentElement.classList.toggle('sr43-clean-map',cleanMap);}
 function status(v){return classifyPosition(v);}
 function selected(){return bridge?.state?.vehicles?.get(bridge.state.selectedKey)||null;}
 function scheduleClusters(){clearTimeout(clusterTimer);clusterTimer=setTimeout(renderClusters,90);}
 function renderClusters(){
  if(!map||!clusters)return;
  clusters.clearLayers();
  // Reset previously hidden marker DOM on every zoom, filter and source update.
  for(const entry of bridge.state.markers.values()){const element=entry.marker.getElement();element?.classList.remove('sr43-in-cluster');element?.querySelector('.marker-label')?.classList.remove('sr65-label-collision');}
  const zoom=map.getZoom();
  // Labels thin out before clusters appear, without hiding the followed vehicle.
  document.documentElement.classList.toggle('sr431-midwide',zoom<=13);
  document.documentElement.classList.toggle('sr43-wide',zoom<=11);
  document.documentElement.classList.toggle('sr43-very-wide',zoom<=10);
  if(document.documentElement.classList.contains('sr43-no-clusters'))return;
  if(zoom>10){
   // At neighborhood zoom keep every bus pin; hide only colliding route labels.
   const boxes=[];const activeKey=bridge.state.selectedKey;
   for(const [key,entry] of bridge.state.markers){
    const dom=entry.marker.getElement(),label=dom?.querySelector('.marker-label');if(!label)continue;
    label.classList.remove('sr65-label-collision');
    if(key===activeKey)continue;
    const box=label.getBoundingClientRect();if(!box.width||!box.height||box.right<0||box.left>window.innerWidth||box.bottom<0||box.top>window.innerHeight)continue;
    if(boxes.some(b=>box.left<b.right+5&&box.right>b.left-5&&box.top<b.bottom+4&&box.bottom>b.top-4))label.classList.add('sr65-label-collision');
    else boxes.push(box);
   }
   return;
  }
  const bounds=map.getBounds();
  const points=[];
  const active=bridge.followAPI?.getKey?.() || bridge.state.selectedKey;
  if(priorityKey && priorityKey!==active)
   bridge.state.markers.get(priorityKey)?.marker.setZIndexOffset?.(0);
  priorityKey=active;
  if(active)bridge.state.markers.get(active)?.marker.setZIndexOffset?.(1200);
  for(const [key,entry] of bridge.state.markers){
   const v=bridge.state.vehicles.get(key);
   if(!v||!bounds.contains(entry.marker.getLatLng()))continue;
   // The only-late user setting in 4.0 must keep excluded markers excluded.
   const element=entry.marker.getElement();
   if(!element||element.style.display==='none')continue;
   const pt=map.latLngToContainerPoint(entry.marker.getLatLng());
   points.push({key,x:pt.x,y:pt.y,kind:v.kind,stale:status(v).kind!=='current'});
  }
  const clusterRadius=zoom<=6?58:zoom<=7?52:zoom<=8?44:zoom<=9?36:30;
  const grouped=groupNearby(points,clusterRadius,active,zoom>=9?'kind':'all');
  for(const group of grouped.clusters){
   const pt=map.containerPointToLatLng([group.x,group.y]);
   const dominant=group.trains&&!group.buses?'train':group.buses&&!group.trains?'bus':'mixed';
   const detail=group.trains&&group.buses?group.trains+' Züge · '+group.buses+' Busse':group.trains?group.trains+' Züge':group.buses+' Busse';
   const tier=group.count>=24?'xl':group.count>=12?'lg':group.count>=6?'md':'sm';
   const icon=L.divIcon({className:'sr43-cluster-icon',html:
    '<div class="sr43-cluster-circle sr80-group-chip '+dominant+' '+tier+'" aria-hidden="true"><strong>'+group.count+'</strong><small>'+detail+'</small>'+
    (group.staleCount?'<span class="sr431-cluster-stale" title="Letzte bekannte Positionen">◷</span>':'')+'</div>',
    iconSize:[58,32],iconAnchor:[29,16]});
   const marker=L.marker(pt,{icon,title:group.count+' Fahrzeuge'+(group.staleCount?', davon '+group.staleCount+' NICHT LIVE':'')+' – zum Vergrößern tippen',keyboard:true});
   marker.on('click',()=>{
      // Zoom to actual member positions rather than an arbitrary fixed zoom ceiling.
      const members=group.keys.map(key=>bridge.state.markers.get(key)?.marker?.getLatLng()).filter(Boolean);
      if(members.length>1){
       const bounds=L.latLngBounds(members);
       const span=bounds.getNorthEast().distanceTo(bounds.getSouthWest());
       if(span>30){map.fitBounds(bounds.pad(.32),{animate:true,duration:.52,maxZoom:16,padding:[52,52]});return;}
      }
      map.flyTo(pt,Math.min(16,zoom+3),{animate:true,duration:.55});
     });
   marker.addTo(clusters);
   for(const key of group.keys)bridge.state.markers.get(key)?.marker.getElement()?.classList.add('sr43-in-cluster');
  }
 }
 function updateMini(){
  const sheet=$('sheet'),mini=$('sr43Mini');if(!sheet||!mini||!bridge)return;
  const v=selected();
  mini.hidden=!v || !sheet.classList.contains('open');
  if(!v)return;
  const position=status(v);
  const p=position.kind==='current'?bridge.confirmedStopFor?.(v):null;
  const upd=p?bridge.confirmedDelayFor?.(v,p.stopId):null;
  const info=stopSummary(p,upd);
  const secondary=position.kind==='current'?info.meta:
    position.kind==='stale'?'NICHT LIVE · Letzter Feed vor '+position.minutes+' Min.':'Keine aktuelle Position';
  const summary=v.name+'|'+info.title+'|'+secondary;
  if(summary===lastSummary)return;
  lastSummary=summary;
  mini.replaceChildren();
  const head=make('strong','',((v.kind==='train')?'🚆 ':'🚌 ')+v.name);
  const line=make('span','sr43-mini-stop',info.title);
  const sub=make('small','',secondary);
  mini.append(head,line,sub);
  mini.title='Details nach oben ziehen';
 }
 function installMini(){
  const sheet=$('sheet'),heading=sheet?.querySelector('.sheet-heading');
  if(!heading || $('sr43Mini'))return;
  const mini=make('div','sr43-mini');mini.id='sr43Mini';mini.hidden=true;
  mini.setAttribute('aria-live','polite');heading.after(mini);
  document.addEventListener('sr37:selection',()=>{lastSummary='';updateMini();});
  document.addEventListener('sr37:feeds',updateMini);
  const observer=new MutationObserver(updateMini);
  observer.observe(sheet,{attributes:true,attributeFilter:['class','data-sr42-snap']});
  setInterval(()=>{if(sheet.classList.contains('open'))updateMini();},10000);
  updateMini();
 }
 function updateFollower(){
  if(!map||!bridge?.followAPI||document.body.classList.contains('sr71-focusing'))return;
  const key=bridge.followAPI.getKey?.();if(!key||bridge.followAPI.isPaused?.()||document.hidden)return;
  const entry=bridge.state.markers.get(key);const v=bridge.state.vehicles.get(key);
  if(!entry||status(v).kind!=='current')return;
  const p=map.latLngToContainerPoint?.(entry.marker.getLatLng()),size=map.getSize?.();
  if(p&&size&&followNeedsPan(p,{x:size.x/2,y:size.y/2},size.x,size.y)){
   map.panTo(entry.marker.getLatLng(),{animate:true,duration:.42});
  }
 }
 function installFollow(){
  // Existing 3.7 follow button remains primary. Dragging the map pauses rather
  // than cancelling; tapping the follow chip resumes tracking.
  map.on('zoomend',updateFollower);
  document.addEventListener('sr37:feeds',updateFollower);
  setInterval(updateFollower,2000);
 }
 function stopIcon(st){return L.divIcon({className:'sr43-stop-pin',
  html:'<span class="sr43-stop-dot">'+(st.source==='trains'?'🚆':'▦')+'</span>',iconSize:[28,28],iconAnchor:[14,14]});}
 function mapBounds(){const b=map.getBounds();return {south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()};}
 function schedulePins(){clearTimeout(pinTimer);pinTimer=setTimeout(renderPins,110);}
 function renderPins(){
  if(!stopsLayer)return;
  stopsLayer.clearLayers();
  if(!pinsVisible)return;
  const label=$('sr43StopPinCount');if(!label)return;
  if(map.getZoom()<12){label.textContent='Hineinzoomen für Haltestellen';return;}
  const center=map.getCenter();
  const arr=nearbyStations(stations,mapBounds(),[center.lat,center.lng],45);
  for(const st of arr){
   const m=L.marker([st.lat,st.lon],{icon:stopIcon(st),title:st.name+' · '+st.source});
   m.on('click',()=>bridge.openStationFromMap(st).catch(e=>console.warn('Haltestelle:',e)));
   m.addTo(stopsLayer);
  }
  label.textContent=arr.length+' Haltestellen auf Karte';
 }
 async function togglePins(){
  pinsVisible=!pinsVisible;
  const toggle=$('sr43StopPinToggle');
  toggle.hidden=!pinsVisible;
  if(pinsVisible){
   toggle.textContent='▦ Haltestellen · ✕';
   try{stations=await bridge.getStationList();}catch(e){console.warn('Haltestellen konnten nicht geladen werden',e);stations=[];}
  }
  schedulePins();
 }
 function installStationRadar(){
  stopsLayer=L.layerGroup().addTo(map);
  const head=$('stationSheet')?.querySelector('.sheet-heading-main');
  if(head && !$('sr43ShowStops')){
   const btn=make('button','sr43-stops-button','▦ Haltestellen auf Karte');
   btn.id='sr43ShowStops';btn.type='button';
   btn.addEventListener('click',()=>{
    togglePins().catch(e=>console.warn(e));$('closeStations')?.click();
   });
   head.append(btn);
  }
  const floating=make('button','sr43-stop-pin-toggle');floating.id='sr43StopPinToggle';floating.type='button';floating.hidden=true;
  floating.onclick=()=>{pinsVisible=false;floating.hidden=true;renderPins();};
  document.body.append(floating);
  const count=make('span','sr43-stop-count');count.id='sr43StopPinCount';count.hidden=true;
  document.body.append(count);
  map.on('moveend',schedulePins);map.on('zoomend',schedulePins);
  const observer=new MutationObserver(()=>{
   const label=$('sr43StopPinCount');if(label)label.hidden=!pinsVisible;
  });observer.observe(floating,{attributes:true,attributeFilter:['hidden']});
  // Keep station departures usable; the toggle only hides planned-only entries.
  document.addEventListener('sr37:station-board',()=>setTimeout(installRealtimeFilter,200));
  document.addEventListener('sr37:feeds',()=>setTimeout(applyRealtimeFilter,180));
 }
 function installRealtimeFilter(){
  const head=$('radar37StationHead');if(!head)return;
  let wrap=$('sr43RealtimeOnly');
  if(!wrap){
   wrap=make('label','sr43-station-filter');wrap.id='sr43RealtimeOnly';
   const cb=document.createElement('input');cb.type='checkbox';cb.checked=onlyReal;
   cb.onchange=()=>{onlyReal=cb.checked;applyRealtimeFilter();};
   wrap.append(cb,document.createTextNode(' Nur bestätigte Echtzeit / Ausfälle'));
   head.after(wrap);
  }
  applyRealtimeFilter();
 }
 function applyRealtimeFilter(){
  if(!bridge || !$('stationBoard') || $('stationBoard').hidden)return;
  const rows=[...$('stationDepartures')?.querySelectorAll('.radar37-departure')||[]];
  let shown=0;
  for(const row of rows){
   const hasRt=!!row.querySelector('.radar37-real, .radar37-cancelled');
   row.hidden=onlyReal&&!hasRt;
   if(!row.hidden)shown++;
  }
  let empty=$('sr43StationNoRt');
  if(!empty){empty=make('p','radar37-muted');empty.id='sr43StationNoRt';empty.hidden=true;$('stationDepartures')?.after(empty);}
  empty.hidden=!onlyReal||shown>0;
  if(!empty.hidden)empty.textContent='Keine bestätigten Echtzeitmeldungen für diese Haltestelle. Der Fahrplan bleibt über den Filter erreichbar.';
 }
 function installCleanStyle(){
  markTheme();
  const settings=$('radar40Settings');
  if(settings && !$('sr43CleanToggle')){
   const title=settings.querySelector('.sr40-settings-head strong');if(title)title.textContent='Radar 4.4 · Einstellungen';
   const row=make('label','sr40-setting-row');
   const txt=make('span','', 'Ruhigere dunkle Karte (ohne API-Key)');
   const check=document.createElement('input');check.type='checkbox';check.id='sr43CleanToggle';check.checked=cleanMap;
   check.onchange=()=>{cleanMap=check.checked;try{localStorage.setItem('sr43-clean-map',cleanMap?'on':'off');}catch{}markTheme();};
   row.append(txt,check);settings.append(row);
   const note=make('p','sr40-muted','4.3: Clustering bei weitem Zoom; Haltestellen auf der Karte per Haltestellensuche.');
   settings.append(note);
  }
 }
 function start(){
  if(started)return;
  bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
  if(!map||!window.L)return;
  started=true;
  clusters=L.layerGroup().addTo(map);
  installMini();installFollow();installStationRadar();installCleanStyle();
  map.on('zoomend',scheduleClusters);map.on('moveend',scheduleClusters);
  document.addEventListener('sr37:feeds',()=>{scheduleClusters();updateMini();});
  document.addEventListener('sr37:selection',()=>{scheduleClusters();updateMini();});
  document.addEventListener('sr37:sheet-closed',scheduleClusters);
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',scheduleClusters));
  $('search')?.addEventListener('input',scheduleClusters);
  scheduleClusters();updateMini();
  window.SuedtirolRadar43={version:'4.4',renderClusters,renderPins,updateMini,bridge};
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
