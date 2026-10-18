/* Südtirol Radar 4.7 – observation trail, RT board, confirmed-stop progress, diagnostics.
 * Optional enhancement to 4.6. No new requests, prediction, map engine changes or GTFS rewrites.
 */
(function(root){
 'use strict';
 const U={
  recentPosition(v,nowMs=Date.now()){
   const t=Number(v?.timestamp),age=nowMs/1000-t;
   return Boolean(v&&!v.stale&&Number.isFinite(t)&&t>=1e9&&age>=-30&&age<=300&&
    Number.isFinite(Number(v.lat))&&Number.isFinite(Number(v.lon)) &&
    Math.abs(Number(v.lat))<=90&&Math.abs(Number(v.lon))<=180);
  },
  // The progress bar counts confirmed stop intervals, NOT distance or journey time.
  confirmedProgress(confirmation){
   const rows=confirmation?.rows,index=Number(confirmation?.index);
   if(!Array.isArray(rows)||rows.length<2||!Number.isInteger(index)||index<0||index>=rows.length)return null;
   const done=confirmation.atStop?index:Math.max(0,index-1);
   return {done,total:rows.length-1,percent:Math.round(done/(rows.length-1)*100),
     next:confirmation.name||'Haltestelle',atStop:!!confirmation.atStop};
  },
  qualityCounts(vehicles,nowMs=Date.now()){
   const out={current:0,stale:0,unknown:0};
   for(const v of vehicles){if(U.recentPosition(v,nowMs))out.current++;
    else if(v?.stale||(Number(v?.timestamp)>1e9&&nowMs/1000-Number(v.timestamp)>300))out.stale++;
    else out.unknown++;}
   return out;
  },
  boardCounts(rows){const out={all:0,realtime:0,planned:0,cancelled:0};
   for(const r of rows){out.all++;
    if(r.cancelled){out.cancelled++;out.realtime++;}
    else if(r.realtime)out.realtime++;
    else out.planned++;}
   return out;
  },
  sampleAdd(points,v,nowMs=Date.now()){
   if(!U.recentPosition(v,nowMs))return points;
   const t=Number(v.timestamp),latest=points.at(-1);
   if(latest && t<=latest.ts)return points;
   const next={lat:Number(v.lat),lon:Number(v.lon),ts:t};
   if(latest){
    const radians=Math.PI/180,dLat=(next.lat-latest.lat)*radians,dLon=(next.lon-latest.lon)*radians;
    const a=Math.sin(dLat/2)**2+Math.cos(latest.lat*radians)*Math.cos(next.lat*radians)*Math.sin(dLon/2)**2;
    const metres=12742000*Math.asin(Math.min(1,Math.sqrt(a)));
    if(metres<5)return points; // Do not claim an unchanged location was another observation.
    if(metres>15000 && t-latest.ts<120)return [next]; // Avoid impossible teleport trails.
   }
   return [...points,next].slice(-45);
  },
  elapsed(time,now=Date.now()){
   if(!Number.isFinite(time)||time<=0)return 'noch nicht';
   const seconds=Math.max(0,Math.floor((now-time)/1000));
   return seconds<60?'vor '+seconds+' Sek.':'vor '+Math.floor(seconds/60)+' Min.';
  },
  todayRome(now=new Date()){
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
   const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return [p.year,p.month,p.day].join('-');
  },
  gtfsValid(db,now=new Date()){
   return Boolean(db?.meta?.ready&&Array.isArray(db.meta.days)&&db.meta.days.includes(U.todayRome(now)));
  }
 };
 if(typeof module==='object'&&module.exports)module.exports={radar47:U};
 if(!root?.document)return;
 const document=root.document, $=id=>document.getElementById(id);
 const make=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el;};
 const names={sta:'Südtirol (STA)',trentino:'Trentino',trains:'Züge'};
 const feeds=['sta','sta_updates','trentino','trentino_updates','trains','trains_updates'];
 let bridge=null,started=false,trailLayer=null,trailEnabled=true,trailControl=null,trailDescription=null;
 let progressEl=null,diagnostics=null,boardBar=null,boardInfo=null,boardOnlyBtn=null,boardEmpty=null;
 let boardOnlyRealtime=false,boardKey='',boardTimer=0,lastFeedSeen=0;
 const observations=new Map();
 const observeIdentity=new Map();
 function current(){return bridge?.state?.vehicles.get(bridge.state.selectedKey)||null;}
 function activeSelection(){return bridge?.state?.activeSheet==='vehicle'&&!!$('sheet')?.classList.contains('open');}
 function record(){
  const state=bridge?.state;if(!state||!state.fetchedAt||lastFeedSeen===state.fetchedAt)return;
  lastFeedSeen=state.fetchedAt;
  for(const [key,v] of state.vehicles){
   if(!U.recentPosition(v))continue;
   const trip=[v.tripId||'',v.tripStartDate||U.todayRome(),v.routeId||'',v.directionId||''].join('|');
   if(observeIdentity.has(key)&&observeIdentity.get(key)!==trip)observations.delete(key);
   observeIdentity.set(key,trip);
   observations.set(key,U.sampleAdd(observations.get(key)||[],v));
  }
  if(observations.size>600){
   for(const key of observations.keys())if(!state.vehicles.has(key)){
    observations.delete(key);observeIdentity.delete(key);
   }
  }
 }
 function drawTrail(){
  if(!trailLayer||!bridge)return;
  trailLayer.clearLayers();
  const v=activeSelection()?current():null;
  const points=v?observations.get(v.key)||[]:[];
  if(trailDescription){
   trailDescription.hidden=!v;
   if(v)trailDescription.textContent=points.length?
    points.length+' empfangene Messpunkte seit Öffnen der App · keine historische GPS-Spur. Eine gegebenenfalls sichtbare gestrichelte Linie verbindet Messpunkte, keine garantierte Straßenroute.':
    'Noch keine frischen Messpunkte für diese Fahrt gesammelt.';
  }
  if(trailControl){trailControl.hidden=!v;trailControl.setAttribute('aria-pressed',String(trailEnabled));
   trailControl.textContent=trailEnabled?'◉ Spur':'◎ Spur';}
  if(!v||!trailEnabled)return;
  // Complement the pre-existing 4.0 dashed path with small, observed-only dots.
  for(let i=0;i<points.length;i++){
   const p=points[i];
   L.circleMarker([p.lat,p.lon],{
    pane:'sr47-observations',radius:i===points.length-1?4.5:2.7,
    color:'#74edd4',weight:1.5,opacity:.92,fillColor:'#105f68',fillOpacity:.9,
    interactive:false
   }).addTo(trailLayer);
  }
 }
 function renderProgress(){
  if(!progressEl||!bridge)return;
  const v=activeSelection()?current():null;
  progressEl.hidden=!v;
  if(!v)return;
  progressEl.replaceChildren();
  const h=make('div','sr47-card-head');h.append(make('strong','', 'Fahrt-Fortschritt'));
  h.append(make('small','','Nach bestätigten Halten, nicht nach Kilometern'));
  progressEl.append(h);
  const p=typeof bridge.confirmedStopFor==='function'?bridge.confirmedStopFor(v):null;
  const progress=U.confirmedProgress(p);
  if(!progress){
   progressEl.append(make('p','sr47-subtle','Kein sicher bestätigter aktueller Halt. Ohne passende, frische GTFS-RT-Haltmeldung wird kein Fortschritt geschätzt.'));
   if(!v.tripId)progressEl.append(make('small','sr47-muted','Für diese Position fehlt eine passende Fahrt-ID.'));
   return;
  }
  const labels=make('div','sr47-progress-meta');
  labels.append(make('strong','',progress.done+' / '+progress.total+' Abschnitte bestätigt'));
  labels.append(make('span','',progress.percent+' % der Halteabschnitte'));
  progressEl.append(labels);
  const bar=make('div','sr47-progressbar');bar.setAttribute('role','progressbar');
  bar.setAttribute('aria-label','Bestätigte Halteabschnitte');bar.setAttribute('aria-valuemin','0');
  bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(progress.percent));
  const fill=make('div','sr47-progress-fill');fill.style.width=progress.percent+'%';bar.append(fill);
  progressEl.append(bar);
  progressEl.append(make('p','sr47-progress-next',
   (progress.atStop?'● Am Halt: ':'→ Nächster gemeldeter Halt: ')+progress.next));
 }
 function stationRows(){
  return [...($('stationDepartures')?.querySelectorAll('.radar37-departure')||[])].map(el=>({
   el,realtime:!!el.querySelector('.radar37-real'),
   cancelled:!!el.querySelector('.radar37-cancelled')
  }));
 }
 function syncBoard(){
  const st=bridge?.state?.stationChoice;
  if(!boardBar||!st)return;
  const shown=bridge.state.activeSheet==='station'&&!$('stationBoard')?.hidden;
  boardBar.hidden=!shown;
  if(!shown)return;
  const key=st.source+':'+st.stopId;
  if(key!==boardKey){boardKey=key;boardOnlyRealtime=false;}
  const rows=stationRows(),c=U.boardCounts(rows);
  if(boardInfo){boardInfo.textContent=c.all+' Abfahrten in 4 Std. · '+c.realtime+' mit GTFS-RT · '+c.planned+' nur Fahrplan';}
  if(boardOnlyBtn){boardOnlyBtn.setAttribute('aria-pressed',String(boardOnlyRealtime));
   boardOnlyBtn.textContent=boardOnlyRealtime?'✓ Nur GTFS-RT':'Alle / nur GTFS-RT';}
  for(const row of rows)row.el.hidden=boardOnlyRealtime&&!row.realtime&&!row.cancelled;
  if(boardEmpty){boardEmpty.hidden=!(boardOnlyRealtime&&c.realtime===0);
   boardEmpty.textContent='Keine Abfahrt mit passender GTFS-RT-Meldung. Geplante Fahrten sind über „Alle“ sichtbar.';}
 }
 function queueBoard(){clearTimeout(boardTimer);boardTimer=setTimeout(syncBoard,145);}
 function initBoard(){
  const board=$('stationBoard'),list=$('stationDepartures');
  if(!board||!list)return;
  boardBar=make('div','sr47-boardbar');boardBar.id='sr47BoardBar';boardBar.hidden=true;
  const intro=make('div','sr47-board-title');intro.append(make('strong','', 'Live-Abfahrtstafel'));
  intro.append(make('small','','GTFS-Plan + passende Echtzeitmeldungen'));
  boardBar.append(intro);
  const opts=make('div','sr47-board-options');
  boardInfo=make('span','sr47-board-info','Lade Abfahrten …');
  boardOnlyBtn=make('button','sr47-secondary','Alle / nur GTFS-RT');boardOnlyBtn.type='button';
  boardOnlyBtn.id='sr47BoardToggle';boardOnlyBtn.setAttribute('aria-pressed','false');
  boardOnlyBtn.onclick=()=>{boardOnlyRealtime=!boardOnlyRealtime;syncBoard();};
  opts.append(boardInfo,boardOnlyBtn);boardBar.append(opts);
  boardEmpty=make('p','sr47-muted');boardEmpty.hidden=true;boardBar.append(boardEmpty);
  list.before(boardBar);
  new MutationObserver(queueBoard).observe(list,{childList:true});
 }
 function tagRow(parent,head,value,status){
  const row=make('div','sr47-diagnostic-row');
  row.append(make('span','',head));
  const val=make('strong',status||'',value);row.append(val);parent.append(row);
 }
 function diagnosticRender(){
  if(!diagnostics||diagnostics.hidden||!bridge)return;
  const s=bridge.state;
  const content=$('sr47DiagContent');if(!content)return;
  content.replaceChildren();
  const q=U.qualityCounts(s.vehicles.values());
  const overview=make('section','sr47-diagnostic-group');
  overview.append(make('h3','', 'Positionsqualität'));
  tagRow(overview,'Fahrzeuge im Speicher',String(s.vehicles.size));
  tagRow(overview,'Frische Positionen (≤ 5 Min.)',String(q.current),'good');
  tagRow(overview,'Veraltete Positionen',String(q.stale),q.stale?'warn':'');
  tagRow(overview,'Zeit unbekannt / unbestätigt',String(q.unknown));
  tagRow(overview,'Letzter Feed-Abruf',U.elapsed(s.fetchedAt));
  const darkSelected=root.SuedtirolRadar44?.getMode?.()==='radar';
  tagRow(overview,'Kartenmodus',darkSelected?(root.SuedtirolRadar45?.getVectorReady?.()?'Radar · bereit':'Radar · wird geladen'):'Classic');
  content.append(overview);
  const feedsSection=make('section','sr47-diagnostic-group');feedsSection.append(make('h3','','Datenquellen'));
  for(const source of feeds){
   const type=s.statuses[source],label=source.replace('_updates',' · TripUpdates');
   const first=make('div','sr47-diagnostic-source');
   const left=make('div','');left.append(make('strong','',label));
   const last=make('small','', 'Letzte gültige Antwort '+U.elapsed(s.lastSuccess[source]));left.append(last);
   const right=make('span','sr47-source-state '+(type==='ok'?'good':type==='old'?'warn':'bad'),
    type==='ok'?'OK':type==='old'?'VERALTET':'KEIN AKTUELLER FEED');
   first.append(left,right);feedsSection.append(first);
   if(!source.endsWith('_updates')){
    const count=s.counts[source];if(count){
     const n=Number(count.vehicles?.length)||0,issues=count.invalid||{};
     feedsSection.append(make('small','sr47-source-detail',
      n+' Positionen verarbeitet · '+Number(count.totalEntities||0)+' Feed-Einträge · '+
      (Number(issues.missingPosition||0)+Number(issues.invalidCoordinates||0)+Number(issues.missingIdentity||0))+' verworfen'));
    }
   }
  }
  content.append(feedsSection);
  const staticSection=make('section','sr47-diagnostic-group');staticSection.append(make('h3','','GTFS-Fahrpläne'));
  for(const source of ['sta','trentino','trains']){
   tagRow(staticSection,names[source],U.gtfsValid(s.indexes[source])?'Heute gültig':'Fehlt / nicht heute gültig',
    U.gtfsValid(s.indexes[source])?'good':'warn');
  }
  content.append(staticSection);
  content.append(make('p','sr47-muted','„Feed OK“ bestätigt nur eine aktuelle Feedantwort – kein echtes GPS, keine vollständige Fahrzeugabdeckung und keine Echtzeitprognose für jede Abfahrt. Trenitalia/Trentino können simulierte Positionen liefern.'));
 }
 function initDiagnostics(){
  const actions=document.querySelector('.map-actions');if(!actions)return;
  const button=make('button','round-action','☷');button.type='button';button.id='sr47DiagOpen';
  button.title='Live-Daten-Diagnose';button.setAttribute('aria-label','Live-Daten-Diagnose öffnen');
  button.setAttribute('aria-expanded','false');actions.append(button);
  diagnostics=make('aside','sr47-diagnostics');diagnostics.id='sr47Diagnostics';diagnostics.hidden=true;
  diagnostics.setAttribute('aria-label','Live-Daten-Diagnose');
  const head=make('div','sr47-diagnostic-head');
  const title=make('div','');title.append(make('strong','','Live-Daten-Diagnose'));
  title.append(make('small','','Radar 4.7 · Datenstatus ohne zusätzliche API-Aufrufe'));
  const close=make('button','sr47-close','✕');close.type='button';close.setAttribute('aria-label','Diagnose schließen');
  close.onclick=()=>{diagnostics.hidden=true;button.setAttribute('aria-expanded','false');};
  head.append(title,close);diagnostics.append(head);
  const content=make('div','sr47-diagnostic-content');content.id='sr47DiagContent';diagnostics.append(content);
  document.body.append(diagnostics);
  button.onclick=()=>{diagnostics.hidden=!diagnostics.hidden;button.setAttribute('aria-expanded',String(!diagnostics.hidden));diagnosticRender();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!diagnostics.hidden){diagnostics.hidden=true;button.setAttribute('aria-expanded','false');}});
 }
 function initVehicle(){
  const scroll=$('sheet')?.querySelector('.sheet-scroll');
  const actions=$('sr46Actions');
  if(!scroll)return;
  progressEl=make('section','sr47-progress');progressEl.id='sr47Progress';progressEl.hidden=true;
  const quality=$('sr46Quality');if(quality)quality.after(progressEl);else scroll.prepend(progressEl);
  trailDescription=make('div','sr47-tracknote');trailDescription.id='sr47TrackNote';trailDescription.hidden=true;
  progressEl.after(trailDescription);
  if(actions){
   trailControl=make('button','sr46-action sr47-trailbtn','◉ Spur');trailControl.id='sr47TrailBtn';
   trailControl.type='button';trailControl.setAttribute('aria-pressed','true');
   trailControl.title='Messpunkte auf der Karte ein- oder ausblenden';
   trailControl.onclick=()=>{trailEnabled=!trailEnabled;drawTrail();};actions.append(trailControl);
  }
  if(window.L?.layerGroup && bridge.state.map){
   const pane=bridge.state.map.createPane('sr47-observations');
   pane.style.zIndex='446';pane.style.pointerEvents='none';
   trailLayer=L.layerGroup().addTo(bridge.state.map);
  }
 }
 function refresh(){
  try{record();renderProgress();drawTrail();queueBoard();diagnosticRender();}
  catch(e){console.warn('Radar 4.7 Anzeige konnte nicht vollständig aktualisiert werden:',e);}
 }
 function start(){
  if(started)return;
  bridge=root.SuedtirolRadar37;
  if(!bridge?.state?.map)return;
  started=true;
  // 4.6 and all 4.5.2 scripts remain authoritative; enhancement only.
  initVehicle();initBoard();initDiagnostics();
  const ver=document.querySelector('.brand-title em');if(ver)ver.textContent='4.7';
  document.title='Südtirol Radar 4.7 · Züge & Busse';
  const heading=$('radar40Settings')?.querySelector('.sr40-settings-head strong');
  if(heading)heading.textContent='Radar 4.7 · Einstellungen';
  for(const name of ['sr37:feeds','sr37:selection','sr37:sheet-closed','sr37:shapes','sr37:station-board'])
   document.addEventListener(name,()=>{
    // Existing 3.7 renders are asynchronous. Do not reimplement their boarding logic.
    refresh();
   });
  setInterval(()=>{if(!document.hidden){if(activeSelection())renderProgress();diagnosticRender();if(boardBar&&!boardBar.hidden)queueBoard();}},15000);
  root.SuedtirolRadar47={version:'4.7',refresh,diagnostics:diagnosticRender};
  refresh();
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='undefined'?null:window);
