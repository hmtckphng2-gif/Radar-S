/* Südtirol Radar 5.6 — additive intelligence, mobile UI, no map renderer changes.
   All "live" labels require fresh matching GTFS-RT. No fabricated GPS or delay. */
import {freshUpdate,stopDelay,tripCancelled,findConnections,feedQuality,spatialWarning,journeyProgress,aggregateHistory,readableTime} from './radar56-logic.mjs';
import {romeDay,romeSeconds,findStations,nearbyStationGroup,buildDepartureRows,dateGTFSValid,trainScheduledPosition} from './radar51-logic.mjs';
import {displayDelay} from './radar53-logic.mjs';
import {isRailRoute,feedAgeSeconds} from './core.js';
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const mk=(tag,cls='',txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e};
const btn=(text,fn,cls='sr56-btn')=>{const b=mk('button',cls,text);b.type='button';b.addEventListener('click',fn);return b};
const line=(name,value,cls='')=>{const r=mk('div','sr56-line '+cls);r.append(mk('span','',name),mk('strong','',value));return r};
let bridge,started=false,card=null,qualityCard=null,journeyCard=null,overlay=null,overlayBody=null,stationList=null;
let selectedKey=null,scheduled=0,boardObserver=null,analyticsRows=[],analyticsStorage=true,lastObservationAt=0,viewsReady=false;
const HISTORY_KEY='sr56_network_delay_history_v1';
const selected=()=>bridge?.state?.activeSheet==='vehicle'?bridge.state.vehicles.get(bridge.state.selectedKey):null;
const status=()=>bridge?.state?.statuses||{};
const sourceValid=s=>s?.source && status()[s.source]==='ok';
const txtTime=sec=>readableTime(Number(sec));
const APP=window.SuedtirolRadar56={version:'5.6'};
function safeHistory(){
 try {const v=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(Array.isArray(v))analyticsRows=v.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&Number.isFinite(x.observed)).slice(-31)}catch{analyticsStorage=false}
}
function openPanel(title,description=''){
 if(!overlay){
  overlay=mk('section','sr56-overlay');overlay.id='sr56Overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','false');overlay.setAttribute('aria-label','Radar 5.6 Information');
  const bar=mk('div','sr56-overlay-head');const h=mk('h2','');h.id='sr56OverlayTitle';const close=btn('✕',closePanel,'sr56-close');close.setAttribute('aria-label','Ansicht schließen');bar.append(h,close);
  overlayBody=mk('div','sr56-overlay-body');overlay.append(bar,overlayBody);document.body.append(overlay);
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()});
 }
 $('sr56OverlayTitle').textContent=title;overlayBody.replaceChildren();
 if(description)overlayBody.append(mk('p','sr56-note',description));
 overlay.hidden=false;overlay.querySelector('button')?.focus({preventScroll:true});
}
function closePanel(){if(overlay){overlay.hidden=true;overlayBody?.replaceChildren()}}
function closeMoreMenu(){const menu=$('sr53ActionMenu');if(menu)menu.hidden=true;const more=$('sr53More');more?.setAttribute('aria-expanded','false')}
function isVisible(){return $('sheet')?.classList.contains('open')&&selected()}
function delayLabel(min){return min===null?'Zeit unbekannt':min===0?'0 Min.':(min>0?'+':'')+min+' Min.'}
function positionQuality(){
 const v=selected(),box=qualityCard;if(!box)return;
 box.hidden=!v;if(!v)return;
 const q=feedQuality(v,status());box.className='sr56-quality '+q.level;box.replaceChildren();
 const top=mk('div','sr56-line');
 top.append(mk('span','sr56-quality-label',q.label),mk('strong','sr56-quality-age',q.age===null?'Alter unbekannt':Math.round(q.age)+' Sek.'));
 box.append(top);
 const note=mk('p','sr56-note',q.detail+(v.kind==='train'?' · Zugposition kann modelliert sein':'')+' · '+String(v.source||'').toUpperCase());
 box.append(note);
}
function ensureUI(){
 const sheet=$('sheet'),scroll=sheet?.querySelector('.sheet-scroll'),badges=$('sheetBadges');
 if(!scroll||!badges)return false;
 if(!qualityCard){qualityCard=mk('section','sr56-quality');qualityCard.id='sr56Quality';qualityCard.hidden=true;badges.insertAdjacentElement('afterend',qualityCard)}
 if(!card){card=mk('section','sr56-compare');card.id='sr56Compare';card.hidden=true;const legacy=$('sr51TrainCompare');if(legacy)legacy.insertAdjacentElement('afterend',card);else qualityCard.after(card)}
 if(!journeyCard){journeyCard=mk('section','sr56-journey');journeyCard.id='sr56Journey';journeyCard.hidden=true;const progress=$('sr47Progress');if(progress)progress.insertAdjacentElement('afterend',journeyCard);else $('scheduleSection')?.insertAdjacentElement('beforebegin',journeyCard)}
 return true;
}
function positionComparison(){
 if(!card)return;
 const v=selected();card.replaceChildren();card.hidden=true;
 if(!v||v.kind!=='train')return;
 const s=bridge.state,calc=trainScheduledPosition(v,s.indexes,s.details,s.shapes);
 if(!calc)return; // Original Ist-/Soll-Grafik remains fully intact.
 const delay=displayDelay(v,s),q=feedQuality(v,status());
 const warning=spatialWarning(Number(calc.differenceKm),delay,q);
 if(!warning)return;
 card.hidden=false;
 card.append(mk('div','sr56-title-line','Ist-/Soll-Analyse 2.0'));
 card.append(mk('p','sr56-alert',warning));
 card.append(mk('p','sr56-note','Räumliche Abweichung und GTFS-RT-Verspätung sind unterschiedliche Informationen. Der Sollpunkt wird anhand des Fahrplans modelliert.'));
}
function journey(){
 if(!journeyCard)return;
 const v=selected(),s=bridge.state;journeyCard.replaceChildren();journeyCard.hidden=true;
 if(!v?.tripId||!s.details?.[v.source]?.times?.[v.tripId]||!dateGTFSValid(s.indexes?.[v.source]))return;
 const times=s.details[v.source].times[v.tripId];
 const progress=journeyProgress(times,romeSeconds());if(!progress)return;
 journeyCard.hidden=false;
 const heading=mk('div','sr56-line');heading.append(mk('strong','','Live Journey 3.0'),mk('span','sr56-kicker','Fahrplanfortschritt'));journeyCard.append(heading);
 const ratio=progress.total?Math.max(0,Math.min(100,progress.plannedPassed/Math.max(1,progress.total-1)*100)):0;
 const track=mk('div','sr56-progress');const fill=mk('div','sr56-progress-fill');fill.style.width=ratio+'%';track.append(fill);journeyCard.append(track);
 const next=progress.next;
 const name=next?(s.details[v.source].stops?.[String(next[0])]?.[0]||'Halt unbekannt'):'Fahrplanende';
 const text=next?'Planmäßig als Nächstes: '+name+' · '+txtTime(next[1]??next[2]):'Alle Halte laut Fahrplan erreicht';
 journeyCard.append(mk('p','sr56-note',text+' · '+progress.plannedPassed+'/'+progress.total+' planmäßig vorherige Halte'));
 if(v.currentStopId){journeyCard.append(mk('p','sr56-note','Vom Feed gemeldeter nächster Halt: '+String(s.details[v.source].stops?.[v.currentStopId]?.[0]||v.currentStopId)))}
}
function queueUI(){
 if(scheduled||document.hidden)return;scheduled=requestAnimationFrame(()=>{scheduled=0;const key=selected()?.key;if(!isVisible()){if(card)card.hidden=true;if(qualityCard)qualityCard.hidden=true;if(journeyCard)journeyCard.hidden=true;return}ensureUI();selectedKey=key;positionQuality();positionComparison();journey()});
}

function createRailRow(title,detail,secondary=''){
 const row=mk('div','sr56-item');const t=mk('div','sr56-item-body');
 t.append(mk('strong','',title),mk('small','',detail));
 row.append(t,mk('span','sr56-item-time',secondary));return row;
}
async function stationPro(){
 const board=$('sr51InlineBoard'),name=board?.querySelector('.sr51-board-head h2')?.textContent?.trim();
 if(!name)return;
 openPanel('Station Pro · '+name,'Die bestehende Abfahrtstafel bleibt erhalten. Hier siehst du ergänzend Ankünfte, Gleise und die Herkunft der Angaben.');
 overlayBody.append(mk('p','sr56-note','Lade heute gültige GTFS-Stationen …'));
 let all=[];try{all=await bridge.getStationList()}catch{}
 if(overlay.hidden)return;
 const matches=findStations(all,name,40).filter(s=>s.name===name);
 const match=matches[0]||findStations(all,name,1)[0];
 if(!match){overlayBody.append(mk('p','sr56-note','Keine eindeutig zuordenbare Station im geladenen GTFS gefunden.'));return}
 const selectedGroup=nearbyStationGroup(all,match);
 const group=selectedGroup.filter(s=>s?.source&&s?.stopId);
 const s=bridge.state,day=romeDay(),nowSec=romeSeconds();
 const boardRows=buildDepartureRows(group,s.indexes,s.details,s.updates,s.statuses,{kind:'all'});
 const valid=boardRows.rows.filter(r=>r.sec>=nowSec-90&&r.sec<=nowSec+7200);
 const trainCount=valid.filter(r=>r.kind==='train').length,busCount=valid.filter(r=>r.kind==='bus').length;
 overlayBody.replaceChildren();
 const summary=mk('div','sr56-kpis');
 for(const [label,count] of [['Abfahrten 2 Std.',valid.length],['Züge',trainCount],['Busse',busCount]]){
  const x=mk('div','sr56-kpi');x.append(mk('strong','',count),mk('small','',label));summary.append(x)
 }overlayBody.append(summary);
 overlayBody.append(mk('h3','sr56-small-head','Nächste Abfahrten'));
 for(const r of valid.slice(0,8)){
  const when=(r.forecast??r.sec),label=r.number+' · '+r.headsign;
  const platform=r.platform?.current?(' · '+(r.kind==='train'?'Gleis ':'Steig ')+r.platform.current+(r.platform.live?' gemeldet':' laut Plan')):' · Steig/Gleis nicht verfügbar';
  const detail=r.cancelled?'Ausfall gemeldet':r.delaySec===null?'Nur Fahrplan':(r.delaySec>0?'+':'')+Math.round(r.delaySec/60)+' Min. GTFS-RT';
  overlayBody.append(createRailRow(label,detail+platform,readableTime(when)));
 }
 if(!valid.length)overlayBody.append(mk('p','sr56-note','Keine verifizierbaren kommenden Abfahrten aus dem aktuellen GTFS-Import.'));
 overlayBody.append(mk('h3','sr56-small-head','Ankünfte · laut Fahrplan / GTFS-RT'));
 const arrivals=[],keys=new Set();
 for(const st of group){
  const db=s.indexes[st.source],details=s.details[st.source];
  if(!dateGTFSValid(db)||!details?.times)continue;
  for(const [tripId,rows] of Object.entries(details.times)){
   const trip=db.trips?.[tripId];if(!trip||trip[5]===false||!Array.isArray(rows))continue;
   for(const row of rows){
    if(String(row[0])!==String(st.stopId))continue;
    const arr=Number(row[1]??row[2]);if(!Number.isFinite(arr)||arr<nowSec-90||arr>nowSec+7200)continue;
    const key=st.source+':'+tripId+':'+st.stopId+':'+arr;
    if(keys.has(key))continue;keys.add(key);
    const update=s.updates.get(st.source+':'+tripId);
    const current=freshUpdate(update,st.source,s.statuses,day);
    const canceled=tripCancelled(update,st.source,s.statuses,day);
    const rt=current?stopDelay(update,st.stopId,Number(row[3])||0,'arrival'):null;
    const kind=isRailRoute(db.routes?.[trip[0]]?.[2])?'🚆':'🚌';
    const num=trip[3]||db.routes?.[trip[0]]?.[0]||'Fahrt';
    arrivals.push({name:kind+' '+num,source:st.source,arr:arr+(rt??0),scheduled:arr,rt,canceled,platform:String(details.stops?.[st.stopId]?.[3]||'')});
    break;
   }
  }
 }
 arrivals.sort((a,b)=>a.arr-b.arr);
 for(const a of arrivals.slice(0,12))overlayBody.append(createRailRow(a.name,
  (a.canceled?'Ausfall laut GTFS-RT':a.rt===null?'Nur Fahrplan':'GTFS-RT '+(a.rt>0?'+':'')+Math.round(a.rt/60)+' Min.')+
  (a.platform?' · Gleis/Steig laut GTFS '+a.platform:'')+' · '+a.source.toUpperCase(),readableTime(a.arr)));
 if(!arrivals.length)overlayBody.append(mk('p','sr56-note','Heute keine passenden Ankünfte gefunden. Manche Quellen enthalten keine vollständigen Haltezeiten.'));
 overlayBody.append(mk('p','sr56-footnote','Kleine Datenbasis: nur die tatsächlich geladenen GTFS-Stationen. Live-Gleise nur bei explizit gemeldeter Quelle, nicht aus der Fahrplan-Spalte abgeleitet.'));
}
function stationButton(){
 const board=$('sr51InlineBoard'),head=board?.querySelector('.sr51-board-head');
 if(!head||board.hidden||board.querySelector('#sr56StationPro'))return;
 const b=btn('▦ Station Pro',stationPro,'sr56-btn sr56-station-open');b.id='sr56StationPro';head.append(b);
}
function connections2(){
 const v=selected();
 if(!v?.tripId){openPanel('Anschluss-Radar 2.0','Bitte zuerst einen Zug oder Bus mit bestätigter Fahrt-ID auswählen.');return}
 const s=bridge.state,day=romeDay(),data=findConnections({
  source:v.source,tripId:v.tripId,db:s.indexes[v.source],details:s.details[v.source],updates:s.updates,
  statuses:s.statuses,serviceDay:day,nowSec:romeSeconds(),minTransfer:240
 });
 closeMoreMenu();
 openPanel('Anschluss-Radar 2.0','GTFS-RT-Prognosen werden nur bei frischen, haltgenau passenden Meldungen beider Fahrten berücksichtigt. Keine garantierte Anschlusssicherung.');
 if(!data.station){overlayBody.append(mk('p','sr56-note',data.reason));return}
 const st=data.station;
 overlayBody.append(line('Nächster geprüfter Halt',st.name));
 overlayBody.append(line('Ankunft laut Fahrplan',readableTime(st.arr)));
 overlayBody.append(mk('p','sr56-note','Mindestwechselzeit für die rechnerische Einschätzung: 4 Minuten (kein geprüfter Gleisweg).'));
 if(!data.rows.length){overlayBody.append(mk('p','sr56-note',data.reason));return}
 for(const c of data.rows){
  const a=c.assessment,row=mk('div','sr56-connection '+a.kind);
  row.append(mk('div','sr56-connection-top',c.line+' → '+c.destination));
  const m=mk('div','sr56-connection-meta');m.append(mk('strong','',readableTime(c.departure+(a.live?(c.departureDelaySec??0):0))),mk('span','sr56-chip '+a.kind,a.label));row.append(m);
  row.append(mk('small','',Math.round(a.margin/60)+' Min. '+(a.live?'prognostizierter':'planmäßiger')+' Übergang · '+c.source.toUpperCase()));
  overlayBody.append(row);
 }
 overlayBody.append(mk('p','sr56-footnote','Wichtig: Der Anschlussvergleich prüft nur eindeutige Stop-IDs innerhalb derselben Datenquelle. Verkehrsmittel aus anderen Feeds und tatsächliche Wege zwischen Gleisen sind nicht automatisch abgedeckt.'));
}
function disruptionsPro(){
 const s=bridge.state,day=romeDay(),issues=[],seen=new Set();
 for(const [src,health] of Object.entries(s.statuses||{})){
  if(health==='ok')continue;
  const key='feed:'+src;if(seen.has(key))continue;seen.add(key);
  issues.push({title:'Datenquelle '+src.toUpperCase(),detail:'Meldung: '+String(health)+' · Verfügbarkeit nicht bestätigt',level:'unknown'});
 }
 for(const [key,u] of s.updates||[]){
  const n=key.indexOf(':');if(n<0)continue;
  const source=key.slice(0,n),tripId=key.slice(n+1),db=s.indexes[source],trip=db?.trips?.[tripId];
  if(!trip||trip[5]===false||!dateGTFSValid(db)||!freshUpdate(u,source,s.statuses,day))continue;
  const cancelled=tripCancelled(u,source,s.statuses,day), delay=u.delay===null||u.delay===undefined?null:Number(u.delay);
  if(!cancelled&&(!Number.isFinite(delay)||delay<600))continue;
  if(seen.has(key))continue;seen.add(key);
  const label=String(trip[3]||db.routes?.[trip[0]]?.[0]||tripId);
  issues.push({title:(cancelled?'Ausfall':'Größere Verspätung')+' · '+label,detail:cancelled?'Bestätigte GTFS-RT-Ausfallmeldung':Math.round(delay/60)+' Min. Fahrtwert laut GTFS-RT (nicht zwingend nächster Halt)',level:cancelled?'danger':'delay'});
 }
 issues.sort((a,b)=>({danger:0,delay:1,unknown:2}[a.level]??3)-({danger:0,delay:1,unknown:2}[b.level]??3));
 openPanel('Störungscenter Pro','Live-Meldungen aus den tatsächlich angeschlossenen Feeds – keine vollständige offizielle Betriebsstörungsliste.');
 const bar=mk('div','sr56-filter');overlayBody.append(bar);
 const list=mk('div');overlayBody.append(list);
 let filter='all';
 const render=()=>{list.replaceChildren();const rows=issues.filter(x=>filter==='all'||x.level===filter);
  if(!rows.length)list.append(mk('p','sr56-note','Keine passenden Meldungen im aktuell empfangenen Feed. Fehlende Meldungen bedeuten keine garantierte Störungsfreiheit.'));
  for(const item of rows.slice(0,45))list.append(createRailRow(item.title,item.detail));
 };
 for(const [value,name] of [['all','Alle'],['danger','Ausfälle'],['delay','Verspätungen'],['unknown','Quellen']]){
  const b=btn(name,()=>{filter=value;bar.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});b.setAttribute('aria-pressed',String(value==='all'));bar.append(b);
 }
 render();
 overlayBody.append(mk('p','sr56-footnote','Nur heutige, gültige GTFS-Fahrten und frische Updates. Gleiswechsel ohne gültige Änderungsmeldung werden nicht behauptet.'));
}

function captureAnalytics(){
 if(!bridge||document.hidden)return;
 const now=Date.now(),s=bridge.state;
 const stamp=Number(s.fetchedAt);
 if(!Number.isFinite(stamp)||stamp<now-180000||stamp>now+30000)return;
 if(now-lastObservationAt<300000)return;
 const counted=new Set();let sum=0,observed=0,delayed=0,reported=0;
 const sources={};
 for(const v of s.vehicles.values()){
  if(!v.tripId||v.stale||!sourceValid(v))continue;
  const key=v.source+':'+v.tripId;if(counted.has(key))continue;
  const info=feedQuality(v,status());
  if(info.level==='stale'||info.level==='unknown')continue;
  const minutes=displayDelay(v,s);
  if(!Number.isFinite(minutes))continue;
  counted.add(key);observed++;sum+=minutes;
  if(minutes>2)delayed++;
  if(info.level==='reported')reported++;
  sources[v.source]=(sources[v.source]||0)+1;
 }
 lastObservationAt=now;
 const day=romeDay();
 let row=analyticsRows.find(x=>x.day===day);
 if(!row){row={day,samples:0,observed:0,delayed:0,sum:0,reported:0,sources:{},lastAt:0};analyticsRows.push(row)}
 row.samples++;row.observed+=observed;row.delayed+=delayed;row.sum+=sum;row.reported+=reported;row.lastAt=now;
 for(const [source,count] of Object.entries(sources))row.sources[source]=(row.sources[source]||0)+count;
 const daysAgo=new Date(now-31*86400000).toISOString().slice(0,10);
 analyticsRows=analyticsRows.filter(x=>x.day>=daysAgo).sort((a,b)=>a.day.localeCompare(b.day)).slice(-31);
 try{localStorage.setItem(HISTORY_KEY,JSON.stringify(analyticsRows));analyticsStorage=true}catch{analyticsStorage=false}
}
function analyticsPro(){
 const now=romeDay();
 openPanel('Analytics Pro 2.0','Messungen aus diesem Browser. Keine landesweite Pünktlichkeitsquote und keine historische Rekonstruktion vor der Datensammlung.');
 const filters=mk('div','sr56-filter'),summary=mk('div'),chart=mk('div','sr56-chart');overlayBody.append(filters,summary,chart);
 const render=period=>{
  summary.replaceChildren();chart.replaceChildren();
  const a=aggregateHistory(analyticsRows,period,now),grid=mk('div','sr56-kpis');
  for(const [label,value] of [['Feed-Messungen',a.samples],['Fahrten-Beobachtungen',a.observed],['Ø Verspätung',a.average===null?'–':a.average.toFixed(1)+' Min.'],['Über +2 Min.',a.latePercent===null?'–':a.latePercent.toFixed(0)+'%']]){
   const k=mk('div','sr56-kpi');k.append(mk('strong','',value),mk('small','',label));grid.append(k)
  }summary.append(grid);
  if(!a.samples){chart.append(mk('p','sr56-note','Noch keine gespeicherten Beobachtungen in diesem Zeitraum. Die Messungen beginnen erst mit diesem Update.'));return}
  const max=Math.max(1,...a.rows.map(r=>r.observed));
  for(const row of a.rows){
   const item=mk('div','sr56-chart-row'),label=mk('span','',row.day.slice(5)),bar=mk('div','sr56-chart-track'),fill=mk('div','sr56-chart-fill');
   fill.style.width=(100*row.observed/max)+'%';bar.append(fill);item.append(label,bar,mk('strong','',row.observed+' Fahrten'));chart.append(item);
  }
  chart.append(mk('p','sr56-footnote','Ein Feed-Update kann dieselbe Fahrt in einer späteren Messung erneut zählen. Deshalb heißen diese Werte Beobachtungen, nicht unterschiedliche Reisende oder Fahrten.'));
 };
 for(const [period,label] of [[1,'Heute'],[7,'7 Tage'],[30,'30 Tage']]){
  const b=btn(label,()=>{filters.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render(period)});
  b.setAttribute('aria-pressed',String(period===7));filters.append(b);
 }
 render(7);
 overlayBody.append(mk('p','sr56-footnote',analyticsStorage?'Lokal im aktuellen Browser gespeichert. Kein geräteübergreifender Verlauf.':'Browser-Speicherung nicht verfügbar; Historie nur während dieser Sitzung.'));
}
function attachActions(){
 // Capture prevents the 5.5 handlers from opening a second dialog.
 document.addEventListener('click',event=>{
  const b=event.target?.closest?.('button');
  if(!b)return;
  if(b.id==='sr55Connections'){event.preventDefault();event.stopImmediatePropagation();connections2()}
  else if(b.id==='sr55Disruptions'){event.preventDefault();event.stopImmediatePropagation();disruptionsPro()}
  else if(b.id==='sr55Analytics'){event.preventDefault();event.stopImmediatePropagation();analyticsPro()}
 },true);
}
function setupBoard(){
 const board=$('sr51InlineBoard');if(!board)return false;
 let r=0;
 const schedule=()=>{if(r)return;r=requestAnimationFrame(()=>{r=0;stationButton()})};
 boardObserver=new MutationObserver(schedule);boardObserver.observe(board,{childList:true,subtree:false,attributes:true,attributeFilter:['hidden']});
 schedule();return true;
}
function setVersion(){
 const title='Südtirol Radar 5.6 · Züge & Busse';
 const brand=document.querySelector('.brand-title em');if(brand&&brand.textContent!=='5.6')brand.textContent='5.6';
 if(document.title!==title)document.title=title;
 const info=document.querySelector('meta[name=description]');
 if(info)info.setAttribute('content','Südtirol Radar 5.6: Live-Tracking, Ist-/Soll 2.0, Stations Pro und Anschluss-Radar.');
}
function init(){
 if(started)return;
 bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!$('sheet')||!$('sr50DeparturesView')||!$('sr50StatsView'))return;
 started=true;
 safeHistory();
 lastObservationAt=Math.max(0,...analyticsRows.map(x=>Number(x.lastAt)||0));
 document.body.classList.add('sr56-ready');setVersion();
 // Do not register a second map controller or touch the MapLibre/Leaflet sync.
 ensureUI();attachActions();setupBoard();
 document.addEventListener('sr37:selection',()=>{closePanel();queueUI()});
 document.addEventListener('sr37:sheet-closed',()=>{closePanel();queueUI()});
 document.addEventListener('sr37:feeds',()=>{captureAnalytics();queueUI()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueUI()});
 window.addEventListener('hashchange',()=>{closePanel()});
 // Update only the small 5.6 intelligence panels; no changes to marker polling.
 let lastSelected='';
 document.addEventListener('click',()=>{const k=selected()?.key||'';if(k!==lastSelected){lastSelected=k;queueUI()}});
 captureAnalytics();queueUI();stationButton();
 APP.openStations=stationPro;APP.openConnections=connections2;APP.openDisruptions=disruptionsPro;APP.openAnalytics=analyticsPro;
}
document.addEventListener('sr37:ready',init);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
let startAttempts=0;const retry=setInterval(()=>{if(started||++startAttempts>50){clearInterval(retry);return}init()},200);
})();
