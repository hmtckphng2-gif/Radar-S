/* Südtirol Radar 5.0 Final — Modulares Dashboard über der bewährten 4.7-Karte. */
import {calculateNetworkStats,searchTrainStats,searchBusLineStats,vehicleAgeSeconds,HistoricalStorage,tidy} from './radar50-logic.mjs?v=9.7.0';
import {findStations,nearbyStationGroup,buildDepartureRows,romeSeconds,busDelayLabel} from './radar51-logic.mjs?v=9.7.0';
import {mergeStationDepartures} from './radar53-logic.mjs?v=9.7.0';
import {enrichTrainPlatform} from './train-platforms.js?v=9.7.0';
(() => {
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls='',txt=null)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==null)e.textContent=String(txt);return e};
const button=(cls,text,fn)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b};
let bridge=null,history=null,started=false,tab='map',searchTimer=null,stationRequest=0,stationCache=null,searchTrain='',searchLine='',stationSelected=null,boardAllDay=false,boardRequest=0,boardFeedTimer=null,boardKind='all';
const FAV_KEY='sr50_final_favorites_v1';
const saved=()=>{try{
 let f=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');if(!Array.isArray(f))f=[];
 if(!f.length){
  const beta3=JSON.parse(localStorage.getItem('sr50b3_favorites_v1')||'[]');
  if(Array.isArray(beta3) && beta3.length)f=beta3;
 }
 if(!f.length){
  const old=JSON.parse(localStorage.getItem('suedtirol-radar-favorites-v1')||'[]');
  if(Array.isArray(old))f=old.filter(o=>typeof o?.name==='string').slice(0,50).map(o=>{
   const type=o.type==='station'?'station':o.type==='train'?'train':'line';
   const value=tidy(o.stopId||o.id||o.name);const source=tidy(o.source||'');
   return {id:[type,source,value.toLowerCase()].join('|'),type,value,source,title:o.name};
  });
 }
 return f.filter(x=>['station','train','line'].includes(x?.type)&&typeof x.value==='string').slice(0,70)
}catch{return []}};
const store=f=>{try{localStorage.setItem(FAV_KEY,JSON.stringify(f.slice(0,70)))}catch{}}
const favoriteId=(type,value,source='')=>[type,source,tidy(value).toLowerCase()].join('|');
function setFavorite(type,value,source='',title='') {
 const id=favoriteId(type,value,source),a=saved(),i=a.findIndex(f=>f.id===id);
 if(i>=0)a.splice(i,1);else a.unshift({id,type,value:tidy(value),source,title:title||tidy(value)});
 store(a);renderFavorites();return i<0;
}
function favButton(type,value,source='',title=''){
 const present=saved().some(f=>f.id===favoriteId(type,value,source));
 const b=button('sr50-favorite'+(present?' selected':''),present?'★':'☆',()=>{setFavorite(type,value,source,title);b.textContent=saved().some(f=>f.id===favoriteId(type,value,source))?'★':'☆';b.classList.toggle('selected',b.textContent==='★')});
 b.title=present?'Favorit entfernen':'Favorit speichern';b.setAttribute('aria-label',b.title);b.addEventListener('click',event=>event.stopPropagation());return b;
}
function makeRow(primary,secondary,meta){
 const row=el('div','sr50-list-row');const info=el('div','sr50-list-info');info.append(el('strong','',primary),el('small','',secondary));row.append(info);
 if(meta)row.append(el('span','sr50-badge',meta));return row;
}
function timeLabel(ms){return ms>0?new Date(ms).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'unbekannt'};
function ageLabel(seconds){return seconds===null?'Zeit unbekannt':seconds<60?seconds+' s alt':Math.round(seconds/60)+' Min. alt'};
function statusText(status){return status==='ok'?'Antwort OK':status==='old'?'Feed veraltet':'Nicht erreichbar'};
function createNavigation(){
 const nav=el('nav','sr50-bottom-nav');nav.id='sr50BottomNav';nav.setAttribute('aria-label','Hauptnavigation');
 for(const [id,icon,label] of [['map','⌖','Karte'],['departures','▤','Abfahrten'],['stats','▥','Statistik'],['favorites','☆','Favoriten']]){
  const b=button('sr50-nav-btn', '',()=>switchTab(id));b.dataset.tab=id;
  b.append(el('span','sr50-icon',icon),el('span','',label));nav.append(b);
 }
 document.body.append(nav);
}
function createViews(){
 const container=el('main');container.id='sr50Views';
 const dep=el('section','sr50-tab-view');dep.id='sr50DeparturesView';dep.setAttribute('aria-label','Abfahrten');
 dep.innerHTML=`<header class="sr50-header"><div class="sr50-overline">FAHRPLAN · SÜDTIROL</div><h1>Abfahrten</h1><p>Bahnhof oder Haltestelle suchen. Abfahrten ohne Kartenwechsel ansehen.</p></header><div class="sr50-dashboard"><div class="sr50-card"><label for="sr50DepSearch" class="sr50-field-label">Haltestelle oder Bahnhof</label><div class="sr50-search-box"><input type="search" id="sr50DepSearch" placeholder="z. B. Bozen, Meran…" autocapitalize="off" autocomplete="off"/></div><div class="sr50-tip">Abfahrten direkt hier ansehen: Plan und bestätigte GTFS-RT-Meldungen klar getrennt.</div><div id="sr50DepResults" class="sr50-results" aria-live="polite"></div></div><div id="sr51InlineBoard" class="sr51-board sr50-card" hidden></div></div>`;
 const stats=el('section','sr50-tab-view');stats.id='sr50StatsView';stats.setAttribute('aria-label','Statistiken');
 stats.innerHTML=`<header class="sr50-header"><div class="sr50-overline">NETWORK INTELLIGENCE · 5.6</div><h1>Statistik</h1><p>Transparente Echtzeitdaten statt geschätzter Pünktlichkeit.</p></header><div class="sr50-dashboard">
 <section class="sr50-card"><div class="sr50-card-title"><span>Netzwerk jetzt</span><span id="sr50StatsTime" class="sr50-stamp">Noch kein Feed</span></div><div class="sr50-kpi-grid">
 <div class="sr50-kpi-box"><span>Fahrzeuge im Feed</span><strong id="sr50StatTotal">–</strong></div><div class="sr50-kpi-box green"><span>Frische Positionen</span><strong id="sr50StatCurrent">–</strong></div><div class="sr50-kpi-box"><span>Züge / Busse</span><strong id="sr50StatSplit">–</strong></div><div class="sr50-kpi-box orange"><span>Alt / ungeklärt</span><strong id="sr50StatStale">–</strong></div></div>
 <div class="sr50-meter"><div id="sr50MeterFresh"></div><div id="sr50MeterStale"></div></div><p id="sr50QualityNote" class="sr50-tip">„Frisch“ heißt Feedmeldung innerhalb von fünf Minuten – nicht garantiert GPS.</p></section>
 <section class="sr50-card"><div class="sr50-card-title"><span>Aktuell im Netz</span><span class="sr50-sourcetag">SCHNELLZUGRIFF</span></div><div id="sr50QuickLinks" class="sr50-quick-links"><p class="sr50-tip">Lade aktuelle Verbindungen …</p></div></section>
 <section class="sr50-card"><div class="sr50-card-title"><span>Zugnummer finden</span><span class="sr50-sourcetag">GTFS / RT</span></div><form id="sr50TrainForm" class="sr50-search-box"><input id="sr50TrainInput" inputmode="numeric" autocomplete="off" aria-label="Zugnummer" placeholder="z. B. 17120"/><button type="submit" class="sr50-btn">Suchen</button></form><div id="sr50TrainResult" class="sr50-results" aria-live="polite"><p class="sr50-tip">Suche nach einer offiziellen Zugnummer, nicht nach einer Fahrzeug-ID.</p></div></section>
 <section class="sr50-card"><div class="sr50-card-title"><span>Buslinien-Analyse</span><span class="sr50-sourcetag">EXAKTE LINIE</span></div><form id="sr50BusForm" class="sr50-search-box"><input id="sr50BusInput" autocomplete="off" aria-label="Buslinie" placeholder="z. B. 110, 10B, 201"/><button type="submit" class="sr50-btn">Suchen</button></form><div id="sr50BusResult" class="sr50-results" aria-live="polite"><p class="sr50-tip">Linie 10 findet nicht versehentlich 110 oder 10B.</p></div></section>
 <section class="sr50-card"><div class="sr50-card-title"><span>Messhistorie auf diesem Gerät</span><span class="sr50-sourcetag">LOKAL</span></div><div class="sr50-periods" role="group" aria-label="Zeitraum"><button data-days="1" class="active" type="button">24 Std.</button><button data-days="7" type="button">7 Tage</button><button data-days="30" type="button">30 Tage</button></div><div id="sr50HistoryInfo" class="sr50-results">Noch keine Messwerte.</div><div id="sr50HistoryChart" class="sr50-chart"></div><p class="sr50-tip">Speichert höchstens alle fünf Minuten eine Netzwerkmessung im Browser. Die Historie beginnt erst ab Nutzung von Final und funktioniert nicht geräteübergreifend. Keine historischen Verspätungswerte.</p></section>
 <section class="sr50-card"><div class="sr50-card-title"><span>Feed-Diagnose</span><span id="sr50FeedsOk" class="sr50-sourcetag">–</span></div><div id="sr50FeedList" class="sr50-feed-list"></div></section>
 </div>`;
 const fav=el('section','sr50-tab-view');fav.id='sr50FavoritesView';fav.setAttribute('aria-label','Favoriten');
 fav.innerHTML=`<header class="sr50-header"><div class="sr50-overline">SÜDTIROL RADAR</div><h1>Favoriten</h1><p>Deine gespeicherten Haltestellen, Zugnummern und Linien.</p></header><div class="sr50-dashboard"><div id="sr50FavList" class="sr50-card"></div><p class="sr50-tip">Favoriten werden nur in diesem Browser gespeichert.</p></div>`;
 container.append(dep,stats,fav);document.body.append(container);
 $('sr50TrainForm').addEventListener('submit',e=>{e.preventDefault();searchTrain=$('sr50TrainInput').value.trim();renderTrain()});
 $('sr50BusForm').addEventListener('submit',e=>{e.preventDefault();searchLine=$('sr50BusInput').value.trim();renderBus()});
 $('sr50DepSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderStations,180)});
 document.querySelectorAll('.sr50-periods button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.sr50-periods button').forEach(x=>x.classList.toggle('active',x===b));renderHistory()});
}
function switchTab(name){
 if(!['map','departures','stats','favorites'].includes(name))return;
 tab=name;
 document.querySelectorAll('.sr50-nav-btn').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
 for(const [id,n] of [['sr50DeparturesView','departures'],['sr50StatsView','stats'],['sr50FavoritesView','favorites']]){$(id).classList.toggle('active',name===n)}
 const map=$('sr50MapTab');if(map)map.classList.toggle('sr50-map-inactive',name!=='map');
 if(name==='map')requestAnimationFrame(()=>bridge?.state?.map?.invalidateSize?.({pan:false}));
 if(name!=='map' && document.activeElement?.matches?.('input'))document.activeElement.blur();
 if(name==='stats')renderStats();if(name==='favorites')renderFavorites();if(name==='departures')renderStations();
 try { if(location.hash!=='#'+name)window.history?.replaceState?.(null,'','#'+name) }catch {}
}
function updateKpis(){
 if(!bridge)return;
 const s=bridge.state,stats=calculateNetworkStats(s.vehicles,s.statuses,s.indexes);
 $('sr50StatTotal').textContent=stats.total;
 $('sr50StatCurrent').textContent=stats.current;
 $('sr50StatSplit').textContent=stats.trains+' / '+stats.buses;
 $('sr50StatStale').textContent=stats.stale+stats.unknown;
 $('sr50StatsTime').textContent='Feed '+timeLabel(s.fetchedAt);
 const pct=stats.realtimePercent||0; $('sr50MeterFresh').style.width=pct+'%';$('sr50MeterStale').style.width=(stats.realtimePercent===null?0:100-pct)+'%';
 $('sr50QualityNote').textContent=(stats.realtimePercent===null?'Noch keine Positionsdaten.':pct+' % der gespeicherten Fahrzeuge haben eine frische Feedmeldung.')+' · '+stats.simulated+' Positionen sind laut Quelle simuliert/geschätzt. „Frisch“ garantiert kein GPS.';
 const fl=$('sr50FeedList');fl.replaceChildren();
 let healthy=0;for(const {source,status} of stats.sources){if(status==='ok')healthy++;const row=el('div','sr50-feed-row');row.append(el('span','',source.replace('_updates',' · Updates')),el('strong',status==='ok'?'good':status==='old'?'warn':'bad',statusText(status)));fl.append(row)}
 $('sr50FeedsOk').textContent=healthy+'/'+stats.totalFeeds+' Antworten';
}

function renderQuickLinks(){
 const target=$('sr50QuickLinks');if(!target||!bridge?.state)return;
 target.replaceChildren();
 const vehicles=[...bridge.state.vehicles.values()];
 const busCounts=new Map(),trainNums=new Set();
 for(const v of vehicles){
  if(v?.kind==='bus' && v.lineVerified===true && v.name && v.name!=='Linie unbekannt'){
   const label=tidy(v.name);busCounts.set(label,(busCounts.get(label)||0)+1);
  }
  if(v?.kind==='train' && v.nameVerified!==false){
   const num=tidy(v.name).match(/^(?:(?:REG|RE|RV|R|RJX|RJ|EC|IC|FR|FA|EN|S\d{1,2})\s+|Zug\s+)(\d{2,6})[A-Z]?$/i)?.[1];
   if(num)trainNums.add(num);
  }
 }
 const buses=[...busCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de')).slice(0,6);
 const trains=[...trainNums].sort((a,b)=>Number(a)-Number(b)).slice(0,4);
 if(!buses.length&&!trains.length){target.append(el('p','sr50-tip','Noch keine verifizierten Linien oder Zugnummern im aktuellen Feed.'));return}
 if(buses.length){target.append(el('small','sr50-field-label','Buslinien'));
  const row=el('div','sr50-quick-row');for(const [line,count] of buses){const b=button('sr50-quick-btn',line+' · '+count,()=>{
   $('sr50BusInput').value=line;searchLine=line;renderBus();$('sr50BusResult').scrollIntoView({behavior:'smooth',block:'nearest'});
  });b.title='Linie '+line+' analysieren';row.append(b)}target.append(row)}
 if(trains.length){target.append(el('small','sr50-field-label','Züge'));
  const row=el('div','sr50-quick-row');for(const num of trains){const b=button('sr50-quick-btn','🚆 '+num,()=>{
   $('sr50TrainInput').value=num;searchTrain=num;renderTrain();$('sr50TrainResult').scrollIntoView({behavior:'smooth',block:'nearest'});
  });b.title='Zug '+num+' analysieren';row.append(b)}target.append(row)}
}
function renderStats(){updateKpis();renderQuickLinks();if(searchTrain)renderTrain();if(searchLine)renderBus();renderHistory()}
function renderTrain(){
 const target=$('sr50TrainResult');target.replaceChildren();if(!searchTrain)return;
 const s=bridge?.state;if(!s){target.append(el('p','sr50-tip','Feed noch nicht bereit.'));return}
 const result=searchTrainStats(searchTrain,s.vehicles,s.indexes,s.updates,s.statuses);
 if(!result.valid){target.append(el('p','sr50-note','Bitte eine Zugnummer aus 2–6 Ziffern eingeben.'));return}
 const head=el('div','sr50-subtitle',result.live.length+' aktuelle/gespeicherte Fahrzeugpositionen · '+result.planned.length+' heutige Fahrplaneinträge');head.append(favButton('train',result.query));target.append(head);
 for(const v of result.live.slice(0,20)){
  const row=makeRow(v.name,v.headsign+(v.estimated?' · berechnete Position':' · Feedposition'),v.delayMin===null?'Verspätung unbekannt':(v.delayMin>0?'+':'')+v.delayMin+' Min.');
  const meta=el('small','sr50-tip',(v.fresh?'Frische Meldung · ':'Letzte/ungeprüfte Meldung · ')+ageLabel(v.age)+' · '+v.source.toUpperCase());
  row.querySelector('.sr50-list-info').append(meta);row.classList.add('sr50-actionable');row.setAttribute('role','button');row.tabIndex=0;
  row.onclick=()=>window.SuedtirolRadar54?.openTrain({source:v.source,tripId:v.tripId,number:result.query,key:v.key});row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click()}};target.append(row)
 }
 if(result.planned.length){const title=el('p','sr50-tip','Heutiger GTFS-Fahrplan (keine bestätigte Live-Ortung):');target.append(title);
  for(const trip of result.planned.slice(0,8)){
   const row=button('sr50-list-row sr50-actionable', '',()=>window.SuedtirolRadar54?.openTrain({...trip,number:result.query}));
   row.append(el('strong','',trip.source.toUpperCase()+' · '+result.query),el('span','',trip.headsign),el('small','','Fahrt & Verlauf ↗'));target.append(row);
  }
 }
 target.append(button('sr54-history-open','▥ Verspätungen · 7 / 30 Tage',()=>window.SuedtirolRadar54?.openTrain({number:result.query})));
 if(!result.live.length&&!result.planned.length)target.append(el('p','sr50-tip','Keine geprüfte Zuordnung im aktuellen Feed oder heutigen GTFS-Index. Das bedeutet nicht, dass der Zug ausfällt.'));
}
function renderBus(){
 const target=$('sr50BusResult');target.replaceChildren();if(!searchLine)return;
 const s=bridge?.state;if(!s)return;
 const result=searchBusLineStats(searchLine,s.vehicles,s.statuses);
 const summary=el('div','sr50-subtitle',result.activeCount+' Fahrzeuge im Feed · '+result.current+' frisch · '+result.destinations.length+' unterschiedliche Ziele');summary.append(favButton('line',result.query));target.append(summary);
 if(!result.activeCount){target.append(el('p','sr50-tip','Keine verifizierte passende Linie im aktuellen Feed. Prüfe die genaue Liniennummer oder warte auf GTFS-Daten.'));return}
 for(const v of result.vehicles.slice(0,35)){
  const age=vehicleAgeSeconds(v);
  const delay=busDelayLabel(s.vehicles.get(v.key),s.updates,s.statuses);
  const row=makeRow(v.name,v.headsign||'Ziel unbekannt',delay?delay.label+' · '+ageLabel(age):ageLabel(age));
  if(delay){const badge=row.querySelector('.sr50-badge');if(badge)badge.classList.add(delay.minutes>0?'sr51-delay-late':delay.minutes<0?'sr51-delay-early':'sr51-delay-zero');}
  row.classList.add('sr50-actionable');row.tabIndex=0;row.setAttribute('role','button');row.onclick=()=>openVehicle(v.key);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openVehicle(v.key)}};target.append(row)
 }
}
function openVehicle(key){
 const s=bridge?.state,v=s?.vehicles?.get(key);if(!v)return;
 switchTab('map');
 requestAnimationFrame(()=>{
  const marker=s.markers?.get?.(key)?.marker;
  if(marker?.fire)marker.fire('click');
  else if(Number.isFinite(v.lat)&&Number.isFinite(v.lon)){s.map?.panTo?.([v.lat,v.lon]);}
 });
}
function renderHistory(){
 const h=$('sr50HistoryInfo'),c=$('sr50HistoryChart');if(!h||!c)return;
 const days=Number(document.querySelector('.sr50-periods button.active')?.dataset.days)||1;
 const agg=history?.getAggregation(days);h.replaceChildren();c.replaceChildren();
 if(!agg){h.append(el('p','sr50-tip','Noch keine gespeicherten Messungen in diesem Zeitraum. Daten werden ab jetzt lokal erfasst, solange du die App verwendest.'));return}
 const totals=el('div','sr50-history-stats');
 for(const [name,value] of [['Messungen',agg.sampleCount],['Ø Fahrzeuge',agg.avgVehicles],['Max. Fahrzeuge',agg.maxVehicles],['Ø frische Positionen',agg.avgFresh]]){
  const cell=el('div','sr50-history-cell');cell.append(el('small','',name),el('strong','',value));totals.append(cell)}h.append(totals);
 h.append(el('p','sr50-tip','Erster Messpunkt '+new Date(agg.first).toLocaleString('de-DE')+' · letzter '+new Date(agg.last).toLocaleString('de-DE')));
 if(agg.samples.length<2){c.append(el('p','sr50-tip','Grafik erscheint ab der zweiten Messung.'));return}
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 96');svg.setAttribute('role','img');svg.setAttribute('aria-label','Erfasste Fahrzeuge nach Messzeitpunkt');
 const points=agg.samples.slice(-100),lo=points[0].ts,hi=points.at(-1).ts||lo+1,max=Math.max(1,...points.map(x=>x.total));
 const xy=(p,i)=>[(p.ts-lo)/Math.max(1,hi-lo)*304+8,83-(p.total/max)*66];
 const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',points.map((p,i)=>xy(p,i).join(',')).join(' '));poly.setAttribute('stroke','#65b7ff');poly.setAttribute('stroke-width','2.8');poly.setAttribute('stroke-linejoin','round');poly.setAttribute('stroke-linecap','round');poly.setAttribute('fill','none');svg.append(poly);c.append(svg);
}
async function renderStations(){
 const target=$('sr50DepResults');if(!target)return;
 target.hidden=false;
 const seq=++stationRequest,q=tidy($('sr50DepSearch')?.value);
 // Keep the selected station board visible when the feed refreshes.
 if(stationSelected && !$('sr51InlineBoard')?.hidden)return;
 target.replaceChildren();target.append(el('p','sr50-tip',stationCache?'Suche läuft …':'Lade Haltestellen aus GTFS-Daten …'));
 try{
  if(!stationCache)stationCache=await bridge.getStationList();if(seq!==stationRequest||tab!=='departures')return;
  const matches=findStations(stationCache,q,q?45:24);
  target.replaceChildren();if(!matches.length){
   target.append(el('p','sr50-note','Keine passenden Haltestellen im geladenen GTFS-Index gefunden. Suche alternativ nach Bolzano/Bozen oder Salorno/Salurn. Prüfe ggf. den GTFS-Import.'));return;
  }
  for(const st of matches){
   const row=makeRow(st.name,(st.source||'GTFS').toUpperCase());
   row.classList.add('sr50-actionable');row.tabIndex=0;row.setAttribute('role','button');
   row.onclick=()=>openStation(st);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openStation(st)}};
   row.append(favButton('station',st.stopId,st.source,st.name));target.append(row);
  }
 }catch(e){if(seq===stationRequest){target.replaceChildren();target.append(el('p','sr50-note','Haltestellen konnten nicht geladen werden. Bitte GTFS-Import und Netzwerk prüfen.'))}}
}
async function openStation(st){
 stationSelected=st;boardAllDay=false;
 // No map pan, no background sheet. This also prevents an iOS focus zoom when switching.
 if(document.activeElement?.matches?.('input'))document.activeElement.blur();
 switchTab('departures');
 await renderInlineBoard();
}
async function renderInlineBoard(){
 const container=$('sr51InlineBoard');if(!container||!stationSelected)return;
 if($('sr50DepResults'))$('sr50DepResults').hidden=true;
 // Search stays above the board; no nested scroll area.
 const seq=++boardRequest;
 const savedBoardScroll=container.querySelector('.sr51-departure-list')?.scrollTop||0;
 container.hidden=false;container.replaceChildren();
 const head=el('div','sr51-board-head');
 const title=el('div','');title.append(el('small','sr50-overline','ABFAHRTSMONITOR · 5.6'),el('h2','',stationSelected.name));
 const back=button('sr51-back','← Suche',()=>{stationSelected=null;boardRequest++;container.hidden=true;container.replaceChildren();if($('sr50DepResults'))$('sr50DepResults').hidden=false;renderStations()});
 head.append(title,back);container.append(head,el('p','sr50-tip','Lade Fahrplan und verfügbare GTFS-RT-Meldungen …'));
 // No new network requests: getStationList already made all station details available.
 await Promise.resolve();
 if(seq!==boardRequest)return;
 const state=bridge?.state;const group=nearbyStationGroup(stationCache||[stationSelected],stationSelected);
 const chosen=group.filter(x=>x?.source && x?.stopId);
 const result=buildDepartureRows(chosen,state?.indexes,state?.details,state?.updates,state?.statuses,{allDay:boardAllDay,kind:boardKind});
 const seenDepartures=new Set();
  const visibleRows=mergeStationDepartures(result.rows).filter(r=>{
    if(boardKind!=='all'&&r.kind!==boardKind)return false;
    const id=[r.source,r.tripId,r.serviceDay,r.sec].join(':');
    if(seenDepartures.has(id))return false;
    seenDepartures.add(id);return true;
  });
 if(seq!==boardRequest)return;
 container.replaceChildren(head);
 const serviceDate=new Intl.DateTimeFormat('de-IT',{timeZone:'Europe/Rome',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
  const note=el('p','sr50-tip','Fahrplan für '+serviceDate+' · Zeitzone Europe/Rome · Livezeiten nur bei frischen, passenden GTFS-RT-Meldungen.');
 container.append(note);
 const controls=el('div','sr51-board-controls');
 controls.append(button('sr51-toggle',boardAllDay?'Nächste 4 Stunden':'Ganzer Fahrplantag',()=>{boardAllDay=!boardAllDay;renderInlineBoard()}));
 controls.append(button('sr51-map-station','⌖ Auf Karte',()=>{
   bridge.openStationFromMap?.(stationSelected).then(()=>switchTab('map')).catch(()=>{});
 }));
 for(const [value,label] of [['all','Alle'],['train','Züge'],['bus','Busse']]){
  const b=button('sr54-filter',label,()=>{boardKind=value;renderInlineBoard()});b.setAttribute('aria-pressed',String(boardKind===value));controls.append(b);
 }
 container.append(controls);
 const summary=el('div','sr51-board-summary',`${visibleRows.length} ${boardAllDay?'Fahrplaneinträge heute':'Abfahrten innerhalb der nächsten 4 Stunden'} · ${chosen.length} Haltestellen-Datensatz${chosen.length===1?'':'e'}`);
 container.append(summary);
 if(!visibleRows.length){
  container.append(el('p','sr50-note',result.reasons.length?'Keine verlässlichen Abfahrten: '+[...new Set(result.reasons)].join('; '):
    'Keine Abfahrten in diesem Zeitraum im gültigen GTFS-Index. Das bedeutet NICHT, dass der Bahnhof stillgelegt ist oder alle Züge ausfallen. Probiere „Ganzer Fahrplantag“.'));
  return;
 }
 const list=el('div','sr51-departure-list');
 for(const d of visibleRows){
  const row=el('div','sr51-departure-row');
  const main=el('div','sr51-departure-main');
  const hasTrainNum=d.kind!=='train'||/^\d{2,6}$/.test(String(d.number||''));
   main.append(el('strong','',(hasTrainNum?d.number:'REG · Zugnummer unbekannt')+' · '+d.headsign),el('small','',d.source.toUpperCase()+' · '+(d.cancelled?'Ausfall laut GTFS-RT':d.delaySec===null?'Nur Fahrplan · keine Livezeit':'GTFS-RT: '+(d.delaySec>0?'+':'')+Math.round(d.delaySec/60)+' Min.')));
  const platform=d.platform;
  const track=el('small','sr54-platform',(d.kind==='train'?'Gleis ':'Steig ')+(platform?.current||'unbekannt')+(platform?.changed?' · geändert':platform?.live?' · gemeldet':platform?.current?' · Plan':''));main.append(track);
  if(platform?.changed)track.classList.add('sr54-platform-changed');
  if(d.kind==='train'){
   const det=bridge.state.details[d.source],timing=det?.times?.[d.tripId]?.find(t=>String(t[0])===String(d.stopId)&&Number(t[2]??t[1])===d.sec);
   enrichTrainPlatform(track,{number:d.number,serviceDay:d.serviceDay,source:d.source,stopId:d.stopId,stopName:det?.stops?.[d.stopId]?.[0],arrival:timing?.[1],departure:timing?.[2],terminal:Boolean(timing&&timing===det?.times?.[d.tripId]?.at(-1))},platform);
  }
  if(d.kind==='train'&&/^\d{2,6}$/.test(d.number)){
   row.setAttribute('role','button');row.tabIndex=0;row.classList.add('sr50-actionable');
   row.onclick=()=>window.SuedtirolRadar54?.openTrain({source:d.source,tripId:d.tripId,number:d.number});
   row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click()}};
  }
  const sec=d.forecast??d.sec;
  const fmt=n=>`${String(Math.floor(n/3600)%24).padStart(2,'0')}:${String(Math.floor(n%3600/60)).padStart(2,'0')}${n>=86400?' +1':''}`;
  const clock=el('div','sr51-departure-time');clock.append(el('strong','',fmt(sec)));
  if(d.delaySec!==null)clock.append(el('small','',`Plan ${fmt(d.sec)}`));
  row.append(main,clock);if(d.cancelled)row.classList.add('sr51-cancelled');list.append(row);
 }
 container.append(list);list.scrollTop=savedBoardScroll;
}
async function renderFavorites(){
 const target=$('sr50FavList');if(!target)return;target.replaceChildren();const favs=saved();
 if(!favs.length){target.append(el('p','sr50-tip','Noch keine Favoriten gespeichert. Tippe in der Zug-, Linien- oder Haltestellensuche auf ☆.'));return}
 for(const f of favs){const row=makeRow(f.title||f.value,f.type==='station'?'Haltestelle':f.type==='train'?'Zugnummer':'Buslinie');row.classList.add('sr50-fav-row');
 const open=button('sr50-fav-open','Öffnen',async()=>{
  if(f.type==='train'){switchTab('stats');$('sr50TrainInput').value=f.value;searchTrain=f.value;renderTrain()}
  else if(f.type==='line'){switchTab('stats');$('sr50BusInput').value=f.value;searchLine=f.value;renderBus()}
  else{switchTab('departures');try{const list=stationCache||await bridge.getStationList();stationCache=list;const found=list.find(s=>(s.stopId===f.value||s.name===f.value||s.name===f.title)&&(!f.source||s.source===f.source));if(found){if(window.SuedtirolRadar57?.openStation)window.SuedtirolRadar57.openStation(found);else openStation(found)}else $('sr50DepResults').textContent='Haltestelle im aktuellen Fahrplan nicht gefunden.'}catch{}}
 });const del=button('sr50-fav-remove','✕',()=>{store(saved().filter(x=>x.id!==f.id));renderFavorites()});del.setAttribute('aria-label','Favorit entfernen');row.append(open,del);target.append(row)}
}
function start(){
 if(started)return;bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!bridge?.getStationList)return;
 started=true;history=new HistoricalStorage();createNavigation();createViews();switchTab(['#departures','#stats','#favorites'].includes(location.hash)?location.hash.slice(1):'map');
 document.addEventListener('sr37:feeds',()=>{const s=bridge?.state;if(s?.fetchedAt)history.saveSnapshot(calculateNetworkStats(s.vehicles,s.statuses,s.indexes),s.fetchedAt);if(tab==='stats')renderStats();if(tab==='departures'&&stationSelected){clearTimeout(boardFeedTimer);boardFeedTimer=setTimeout(renderInlineBoard,700)}});
 if(bridge.state.fetchedAt)history.saveSnapshot(calculateNetworkStats(bridge.state.vehicles,bridge.state.statuses,bridge.state.indexes),bridge.state.fetchedAt);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden && tab==='stats')renderStats()});
 window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['map','departures','stats','favorites'].includes(next)&&next!==tab)switchTab(next)});
 window.SuedtirolRadar50={version:'5.4',switchTab,updateStatsTab:renderStats,openVehicle,openStation};
}
document.addEventListener('sr37:ready',start);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
