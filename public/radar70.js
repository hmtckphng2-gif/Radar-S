/* Südtirol Radar 7.0 – Horizon Home, search, journey and menu architecture.
 * Existing Leaflet, GTFS, Ist/Soll, favorites and analysis modules are not replaced. */
import {findStations,romeDay,romeSeconds} from './radar51-logic.mjs?v=9.9.0';
import {buildTimetable,searchJourneys,walkEstimate,transferAssessment} from './radar70-route.mjs?v=9.9.0';
import {assessJourneys,orderJourneys,explainRecommendation,answerLocally,summarizeJourneyOptions} from './radar703-advisor.mjs?v=9.9.0';
import {groupJourneyChoices} from './radar705-groups.mjs?v=9.9.0';
import {toggleJourneyFavorite,isJourneyFavorite} from './app-state.js?v=9.9.0';
(()=>{'use strict';
const $=id=>document.getElementById(id);
const E=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const B=(cls,txt,fn)=>{const b=E('button',cls,txt);b.type='button';if(fn)b.addEventListener('click',fn);return b};
const paths={home:'<path d="m3 10 9-7 9 7v10H3zM9 21v-7h6v7"/>',map:'<path d="m3 5 6-2 6 3 6-3v16l-6 3-6-3-6 2zM9 3v17m6-14v16"/>',route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a3 3 0 0 1 3 3v9M17 19H8a3 3 0 0 1-3-3V8"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',train:'<rect x="5" y="2" width="14" height="18" rx="4"/><path d="M5 10h14M8 16h1m6 0h1M8 20l-2 2m10-2 2 2"/>',star:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>',brain:'<path d="M12 4a4 4 0 0 0-7 3 4 4 0 0 0-1 7 4 4 0 0 0 4 6 4 4 0 0 0 4-3V4Zm0 0a4 4 0 0 1 7 3 4 4 0 0 1 1 7 4 4 0 0 1-4 6 4 4 0 0 1-4-3"/>',alert:'<path d="m12 3 10 18H2L12 3ZM12 9v5m0 3v.5"/>',network:'<circle cx="12" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><path d="M12 6 4 18m8-12 8 12M6 20h12"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',swap:'<path d="M7 3v17m-4-4 4 4 4-4M17 21V4m-4 4 4-4 4 4"/>',back:'<path d="m15 18-6-6 6-6"/>',chev:'<path d="m9 18 6-6-6-6"/>'};
function I(name){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width','1.8');s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');s.setAttribute('aria-hidden','true');s.innerHTML=paths[name]||paths.grid;return s}
const clock=n=>Number.isFinite(n)?String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0'):'–';
let bridge,home,more,dock,stage,page='home',pane='search',mode='journey',stationPromise=null,stations=[],net=null,netDay='',journeys=[],selected={from:null,to:null},fields={},departure='now',vehicleMode='all';
let rankingMode='recommended',chatBusy=false,chatHistory=[];
function nativeTab(id){window.SuedtirolRadar50?.switchTab?.(id)}
function navigate(to,hashChange=false){
 if(!['home','map','journey','more'].includes(to))to='home';
 const previous=page;
 page=to;home.hidden=to==='map'||to==='more';more.hidden=to!=='more';
 home.classList.toggle('sr70-journey-active',to==='journey');
 const discover=home.querySelector('.sr70-discover'),footer=home.querySelector('.sr70-foot');
 if(discover)discover.hidden=to!=='home';
 if(footer)footer.hidden=to!=='home';
 nativeTab('map');
 if(to==='journey'){mode='journey';if(previous!==to||pane==='search')drawSearch()}
 else if(to==='home'&&(previous!==to||pane!=='search'))drawSearch();
 document.body.classList.toggle('sr70-home-active',!home.hidden);document.body.classList.toggle('sr70-more-active',!more.hidden);
 for(const b of dock.querySelectorAll('[data-page]'))b.setAttribute('aria-current',b.dataset.page===to?'page':'false');
 if(!hashChange)history.replaceState(null,'','#'+to);
 if(to==='map')requestAnimationFrame(()=>bridge.state.map?.invalidateSize?.({pan:false}));
}
function legacy(id,action){
 navigate('map');if(id)nativeTab(id);
 if(id==='departures')for(const b of dock?.querySelectorAll('[data-page]')||[])b.setAttribute('aria-current',b.dataset.page==='departures'?'page':'false');
 if(action)requestAnimationFrame(()=>{try{const task=action();task?.catch?.(console.warn)}catch(e){console.warn('Radar-Menü',e)}});
}
function feature(id){
 switch(id){
 case 'map':navigate('map');break;
 case 'station':legacy('map',()=>bridge.showStations?.());break;
 case 'departures':legacy('departures');break;
 case 'favorites':legacy('favorites');break;
 case 'stats':legacy('stats');break;
 case 'issues':case 'intelligence':case 'alerts':case 'health':case 'network':case 'search':legacy('map',()=>window.SuedtirolRadar58?.open?.(({intelligence:'network',issues:'issues',alerts:'alerts',health:'health',network:'network',search:'search'})[id]));break;
 case 'settings':legacy('map',()=>$('rhToolsTrigger')?.click());break;
 }
}
function card(id,name,detail,color,ico){const x=B('sr70-tile',undefined,()=>feature(id));x.classList.add('sr70-'+color);x.append(I(ico),E('strong','',name),E('small','',detail));return x}
function homeHeader(){const h=E('header','sr70-head'),branding=E('div','sr70-brand'),logo=E('span','sr70-logo');logo.append(I('train'));branding.append(logo);const t=E('div');t.append(E('strong','','Südtirol Radar'),E('small','','PROJECT HORIZON · 7.0'));branding.append(t);const settings=B('sr70-icon-btn',undefined,()=>feature('settings'));settings.append(I('grid'));settings.setAttribute('aria-label','Werkzeuge und Einstellungen');h.append(branding,settings);return h}
function initHome(){home=E('section','sr70-home');home.id='sr70Home';home.setAttribute('aria-label','Radar Startseite');home.append(homeHeader());stage=E('main','sr70-stage');home.append(stage);const discover=E('section','sr70-discover');discover.append(E('h2','','Entdecken'));
const tiles=E('div','sr70-grid');for(const data of [['map','Live Radar','Züge & Busse','blue','map'],['station','Bahnhöfe','Abfahrten & Gleise','mint','train'],['intelligence','Intelligence','Analysen & Datenqualität','violet','brain'],['issues','Meldungen','Störungen & Hinweise','orange','alert'],['favorites','Mein Radar','Favoriten & Reisen','gold','star'],['network','Netzwerk','Linien & Datenqualität','slate','network']])tiles.append(card(...data));
discover.append(tiles);home.append(discover,E('p','sr70-foot','Fahrpläne und Feed-Daten werden getrennt gekennzeichnet. Keine GPS- oder Verspätungswerte werden erfunden.'));document.body.append(home);
more=E('section','sr70-more');more.id='sr70More';more.hidden=true;more.append(E('h1','','Alle Funktionen'));const list=E('div','sr70-grid');for(const data of [['departures','Abfahrten','Fahrplanmonitor','mint','train'],['stats','Verbindungen · bisher','Statistik & Werkzeuge','blue','route'],['favorites','Favoriten','Gespeicherte Linien','gold','star'],['search','Globale Suche','Züge, Busse und Orte','blue','search'],['intelligence','Radar Intelligence','Netzwerkanalysen','violet','brain'],['issues','Störungen','Offizielle Meldungen','orange','alert'],['health','Datenqualität','Feedstatus & Herkunft','slate','network'],['alerts','Benachrichtigungen','Bestehende Alarme','orange','alert']])list.append(card(...data));more.append(list);document.body.append(more);
}
function makeDock(){dock=E('nav','sr70-dock');dock.id='sr70Dock';dock.setAttribute('aria-label','Hauptnavigation');for(const [id,name,ico] of [['home','Home','home'],['map','Karte','map'],['departures','Abfahrten','train'],['journey','Reisen','route'],['more','Mehr','grid']]){const b=B('sr70-nav',undefined,()=>id==='departures'?legacy('departures'):navigate(id));b.dataset.page=id;b.append(I(ico),E('span','',name));dock.append(b)}document.body.append(dock)}
function message(txt){const x=$('sr70Message');if(x){x.textContent=txt;x.hidden=false}}
function loadStations(){if(!stationPromise)stationPromise=bridge.getStationList().then(x=>{stations=Array.isArray(x)?x:[];return stations}).catch(e=>{stationPromise=null;throw e});return stationPromise}
function choose(which,s){selected[which]=s;fields[which].input.value=s.name;fields[which].list.hidden=true;fields[which].list.replaceChildren()}
function stationField(which,label){const box=E('div','sr70-field'),lab=E('label','',label),input=E('input'),list=E('div','sr70-suggestions');input.id='sr70-'+which;lab.htmlFor=input.id;input.type='search';input.autocomplete='off';input.placeholder=which==='from'?'Startbahnhof oder Haltestelle':'Zielbahnhof oder Haltestelle';list.hidden=true;fields[which]={input,list};
 input.addEventListener('focus',()=>loadStations().then(()=>{if(input.value.length>1)input.dispatchEvent(new Event('input'))}).catch(()=>message('Haltestellen konnten nicht geladen werden.')));
 input.addEventListener('input',()=>{selected[which]=null;list.replaceChildren();if(input.value.trim().length<2){list.hidden=true;return}for(const s of findStations(stations,input.value.trim(),9)){const b=B('sr70-suggestion',s.name+' · '+s.source.toUpperCase(),()=>choose(which,s));list.append(b)}list.hidden=!list.children.length});
 box.append(lab,input,list);return box}
function drawSearch(){
 pane='search';stage.replaceChildren();const head=E('div','sr70-title');head.append(E('p','sr70-overline',page==='journey'?'DEIN REISEPLANER · HORIZON':'PROJECT HORIZON · 7.0'),E('h1','',page==='journey'?'Reisen planen':"Wohin geht's?"),E('p','',page==='journey'?'Finde passende Fahrten, vergleiche Umstiege und prüfe den Fahrplan.':'Finde deine nächste Verbindung.'));stage.append(head);
 if(page==='home'){const modes=E('div','sr70-modes');for(const [id,name] of [['journey','Verbindung'],['train','Zug'],['station','Bahnhof']]){const b=B('sr70-mode',name,()=>{mode=id;drawSearch()});b.setAttribute('aria-pressed',String(mode===id));modes.append(b)}stage.append(modes);}
 if(mode==='journey'){
  const form=E('div','sr70-form');form.append(stationField('from','Abfahrt'),stationField('to','Ankunft'));for(const k of ['from','to'])if(selected[k])fields[k].input.value=selected[k].name;
  const swap=B('sr70-swap',undefined,()=>{[selected.from,selected.to]=[selected.to,selected.from];fields.from.input.value=selected.from?.name||'';fields.to.input.value=selected.to?.name||''});swap.append(I('swap'));swap.setAttribute('aria-label','Start und Ziel tauschen');form.append(swap);stage.append(form);
   if(page==='journey'){const row=E('div','sr70-controls'),time=E('label','', 'Abfahrt'),timeSelect=E('select'),clockInput=E('input');
  for(const [value,text] of [['now','Jetzt'],['later','Später (heute)']]){const x=E('option','',text);x.value=value;timeSelect.append(x)}timeSelect.value=departure;
  clockInput.type='time';clockInput.id='sr70Time';clockInput.value=clock(romeSeconds());clockInput.hidden=departure!=='later';
  timeSelect.onchange=()=>{departure=timeSelect.value;clockInput.hidden=departure!=='later'};time.append(timeSelect,clockInput);
   const kind=E('label','', 'Verkehrsmittel'),kindSelect=E('select');for(const [v,name] of [['all','Zug + Bus'],['train','Nur Zug'],['bus','Nur Bus']]){const x=E('option','',name);x.value=v;kindSelect.append(x)}kindSelect.value=vehicleMode;kindSelect.onchange=()=>vehicleMode=kindSelect.value;kind.append(kindSelect);row.append(time,kind);stage.append(row);}
   const go=B('sr70-primary',page==='home'?'Verbindungen anzeigen':'Verbindungen suchen',page==='home'?()=>{navigate('journey');search()}:search);go.prepend(I('route'));stage.append(go);
   if(page==='journey'){const helper=E('aside','sr70-journey-help');helper.append(E('strong','','Anschlüsse einschätzen'),E('p','','Wir prüfen den Fahrplan und zeigen geschätzte Umsteigewege. Echtzeit-Anschlüsse bewerten wir nur, wenn aktuelle Prognosen für beide Fahrten vorliegen.'));stage.append(helper)}
 }else{
  const input=E('input','sr70-query');input.type='search';input.placeholder=mode==='train'?'Zugnummer, z. B. 16712':'Bahnhof, z. B. Bozen';stage.append(input);const b=B('sr70-primary','Suchen',()=>simpleSearch(input.value));b.prepend(I('search'));stage.append(b);input.addEventListener('keydown',e=>{if(e.key==='Enter')simpleSearch(input.value)});
 }
 const p=E('p','sr70-msg');p.id='sr70Message';p.hidden=true;p.setAttribute('role','status');stage.append(p);
 home.scrollTo?.({top:0});
}
function simpleSearch(raw){const q=raw.trim();if(q.length<2)return message('Bitte mindestens zwei Zeichen eingeben.');
 if(mode==='train'){legacy('map',()=>{window.SuedtirolRadar58?.open?.('search');const i=document.querySelector('.sr58-search');if(i){i.value=q;i.dispatchEvent(new Event('input'))}})}
 else loadStations().then(()=>{const s=findStations(stations,q,1)[0];if(!s)return message('Bahnhof nicht gefunden');legacy('map',()=>bridge.openStationFromMap?.(s))}).catch(()=>message('Stationsdaten nicht verfügbar'));
}
async function search(){
 if(!selected.from||!selected.to)return message('Bitte Start und Ziel aus den Vorschlägen auswählen.');
 const day=romeDay(),a=selected.from,b=selected.to;message('Lade heutige Fahrpläne und prüfe Umstiege …');
 try{
  await loadStations();if(netDay!==day||!net){net=buildTimetable(bridge.state.indexes,bridge.state.details,day);netDay=day}
  let start=romeSeconds();if(departure==='later'){const str=$('sr70Time')?.value;if(!/^\d{2}:\d{2}$/.test(str||''))return message('Wähle eine Uhrzeit.');const t=str.split(':').map(Number);start=t[0]*3600+t[1]*60;if(start<romeSeconds()-120)return message('Bitte eine spätere Uhrzeit für heute auswählen.')}
  chatHistory=[];const r=searchJourneys(net,a,b,start,{maxLegs:3,maxResults:12,types:vehicleMode==='all'?['train','bus']:[vehicleMode]});
  journeys=r.results;drawResults(a,b,r.reason);
 }catch(e){console.warn('Horizon Routensuche',e);message('Verbindungssuche fehlgeschlagen. Datenquellen prüfen.')}
}
function back(title,fn){const h=E('div','sr70-backrow');const b=B('sr70-back','Zurück',fn);b.prepend(I('back'));h.append(b,E('strong','',title));return h}
function planChat(){
 const region=E('section','sr703-chat');
 region.append(E('div','sr703-chat-title','RADAR INTELLIGENCE · REISEBERATUNG'));
 const hint=E('p','sr703-muted','Radar prüft alle angezeigten Verbindungen bereits automatisch. Die echte KI erklärt die Fahrplanbewertung auf Nachfrage; bei Ausfall gibt es eine regelbasierte Antwort.');
 region.append(hint);
 const history=E('div','sr703-history');history.setAttribute('aria-live','polite');
 region.append(history);
 const input=E('textarea','sr703-question');input.rows=2;input.maxLength=280;input.placeholder='Zum Beispiel: Welche Verbindung würdest du empfehlen?';input.setAttribute('aria-label','Frage an Radar Intelligence');
 const actions=E('div','sr703-chat-actions');
 const send=B('sr703-send','Fragen',async ()=>{
  const question=input.value.trim();if(!question||chatBusy)return;
  input.value='';chatBusy=true;send.disabled=true;
  const mine=E('p','sr703-bubble sr703-mine',question);history.append(mine);
  const answer=E('p','sr703-bubble sr703-answer','KI-Anbindung wird geprüft …');history.append(answer);answer.scrollIntoView?.({block:'nearest'});
  let text='',isAI=false;
  try{
   const controller=new AbortController(),id=setTimeout(()=>controller.abort(),13500);
   try{
    const response=await fetch('/api/ai/journey-chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,journeys:summarizeJourneyOptions(journeys),history:chatHistory.slice(-6)}),signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(response.ok&&typeof body.answer==='string'&&body.answer.trim()){text=body.answer.trim();isAI=body.ai===true}
   }finally{clearTimeout(id)}
  }catch(error){console.warn('Radar Journey Chat',error?.message||error)}
  if(!text)text=answerLocally(question,journeys);
  answer.textContent=(isAI?'KI-Einschätzung · ':'Fahrplananalyse · ')+text;
  chatHistory.push({role:'user',content:question},{role:'assistant',content:text});chatHistory=chatHistory.slice(-6);
  chatBusy=false;send.disabled=false;input.focus();
 });
 actions.append(input,send);region.append(actions);
 for(const phrase of ['Welche Verbindung empfiehlst du?','Welche hat die wenigsten Umstiege?']){
  const quick=B('sr703-prompt',phrase,()=>{input.value=phrase;input.focus()});region.append(quick);
 }
 return region;
}
function drawResults(from,to,reason){
 pane='results';stage.replaceChildren(back('Verbindungen',drawSearch));
 const head=E('div','sr70-resulthead');head.append(E('h2','',from.name+' → '+to.name),E('p','','GTFS-Fahrplan · Umstiege nicht live garantiert'));stage.append(head);
 if(!journeys.length){stage.append(E('p','sr70-msg',reason||'Keine passende Verbindung gefunden'));home.scrollTo?.({top:0});return}
 const ranked=assessJourneys(journeys),top=ranked[0];
 const advice=E('section','sr703-advice');advice.append(E('small','sr703-kicker','RADAR EMPFIEHLT · FAHRPLANBASIERTE AUSWERTUNG'),E('strong','',clock(top.trip.departure)+' → '+clock(top.trip.arrival)),E('p','',explainRecommendation(top)));
 const note=E('small','sr703-muted','Alle unterschiedlichen Fahrten bleiben erreichbar; gleiche Varianten werden entfernt. Radar bewertet automatisch den gesamten Ergebnisbestand, die KI erklärt auf Nachfrage. Keine Anschlussgarantie.');
 advice.append(note);stage.append(advice);
 const sortbar=E('label','sr703-sort','Verbindungen sortieren');
 const sorter=E('select');sorter.setAttribute('aria-label','Verbindungen sortieren');
 for(const [key,label] of [['recommended','Empfohlen'],['departure','Nächste Abfahrt'],['fastest','Schnellste'],['fewest','Wenigste Umstiege']]){const o=E('option','',label);o.value=key;sorter.append(o)}
 sorter.value=rankingMode;sortbar.append(sorter);stage.append(sortbar);
 const list=E('div','sr703-results');stage.append(list);
 function makeJourneyCard(entry){
   const trip=entry.trip,card=B('sr70-result',undefined,()=>drawDetail(entry.index));const topRow=E('div','sr70-resulttop');
   topRow.append(E('strong','',clock(trip.departure)+' → '+clock(trip.arrival)),E('small','',Math.round((trip.arrival-trip.departure)/60)+' Min.'));
   card.append(topRow);
   if(entry.index===top.index)card.append(E('span','sr703-badge','Empfohlen · laut Fahrplan'));
   const legs=E('div','sr70-legs');trip.legs.forEach((l,j)=>{legs.append(E('span',l.type==='train'?'sr70-train':'sr70-bus',l.name));if(j<trip.legs.length-1)legs.append(I('chev'))});card.append(legs);
   const risks=entry.missed?'Anschluss rechnerisch nicht erreichbar':entry.risky?'knapper Umstieg':'laut Fahrplan';
   card.append(E('small','',trip.legs.length===1?'Direkt · '+risks:(trip.legs.length-1)+' Umstieg(e) · '+risks));
   return card;
 }
 function renderList(){
  list.replaceChildren();const sorted=orderJourneys(journeys,rankingMode),families=groupJourneyChoices(sorted);
  for(const group of families){
   const section=E('section','sr705-journey-group');section.append(makeJourneyCard(group.primary));
   if(group.alternatives.length){
    const more=E('details','sr705-journey-alternatives'),line=group.primary.trip.legs[0].name;
    more.append(E('summary','',group.alternatives.length+' weitere Anschlussmöglichkeit'+(group.alternatives.length===1?'':'en')+' mit '+line));
    for(const entry of group.alternatives)more.append(makeJourneyCard(entry));
    section.append(more);
   }
   list.append(section);
  }
 }

 sorter.onchange=()=>{rankingMode=sorter.value;renderList()};renderList();
 stage.append(planChat());home.scrollTo?.({top:0});
}
function freshDelay(leg,end){const state=bridge.state,upd=state.updates?.get?.(leg.source+':'+leg.tripId);if(!upd||state.statuses?.[leg.source+'_updates']!=='ok'||!Number.isFinite(+upd.fetchedAt)||Date.now()-Number(upd.fetchedAt)>120000||Date.now()<Number(upd.fetchedAt)-30000)return null;
 if(upd.tripStartDate&&String(upd.tripStartDate).replaceAll('-','')!==romeDay().replaceAll('-',''))return null;
 const stopId=end?leg.toStop.id:leg.fromStop.id;const row=upd.stops?.find(x=>String(x.stopId??x.stop_id??'')===String(stopId)),value=end?(row?.arrival||row?.departure):(row?.departure||row?.arrival);
 return value?.delay==null||!Number.isFinite(+value.delay)?null:Number(value.delay);
}
function drawDetail(i){const trip=journeys[i];if(!trip)return;pane='detail';stage.replaceChildren(back('Reisedetails',()=>drawResults(selected.from,selected.to,'')));
 const head=E('section','sr70-detailhead');head.append(E('p','sr70-overline','DEINE REISE'),E('h2','',clock(trip.departure)+' → '+clock(trip.arrival)),E('p','',trip.legs.length+' Fahrt(en) · GTFS-Fahrplan, kein Ticketangebot'));stage.append(head,E('p','sr70-hint','Umsteigewege sind nur aus Luftlinie geschätzt. Prognosen stammen ausschließlich aus aktuellen GTFS-RT-Meldungen, wenn sie für beide Fahrten verfügbar sind.'));
  const favKey=selected.from.name+'→'+selected.to.name+':'+trip.departure;
  const favBtn=B('sr70-primary-fav',isJourneyFavorite(favKey)?'★ Aus Favoriten':'☆ Als Favorit',()=>{toggleJourneyFavorite(favKey);favBtn.textContent=isJourneyFavorite(favKey)?'★ Aus Favoriten':'☆ Als Favorit';drawDetail(i);});
  head.append(favBtn);
 const timeline=E('div','sr70-timeline');for(let j=0;j<trip.legs.length;j++){const leg=trip.legs[j];
  const a=E('div','sr70-stop');a.append(E('time','',clock(leg.departure)),E('strong','',leg.fromStop.name),E('small','',leg.fromStop.platform?'Steig/Gleis '+leg.fromStop.platform:'Steig/Gleis unbekannt'));timeline.append(a);
  const line=E('div','sr70-ride');line.append(E('span',leg.type==='train'?'sr70-train':'sr70-bus',leg.name),E('span','',leg.headsign));const delay=freshDelay(leg,false);if(delay!==null)line.append(E('small','sr70-delay','GTFS-RT '+(delay>=0?'+':'')+Math.round(delay/60)+' Min.'));timeline.append(line);
  const b=E('div','sr70-stop');b.append(E('time','',clock(leg.arrival)),E('strong','',leg.toStop.name),E('small','',leg.toStop.platform?'Steig/Gleis '+leg.toStop.platform:'Steig/Gleis unbekannt'));timeline.append(b);
  if(j<trip.transfers.length){const tr=trip.transfers[j],next=trip.legs[j+1],la=freshDelay(leg,true),lb=freshDelay(next,false);const assessment=transferAssessment({arrival:leg.arrival,departure:next.departure,walkSeconds:tr.meters<25?0:walkEstimate(tr.meters),liveArrival:la===null?null:leg.arrival+la,liveDeparture:lb===null?null:next.departure+lb});
   const t=E('section','sr70-transfer '+assessment.status);t.append(E('strong','',assessment.label),E('p','',Math.round(Math.max(0,assessment.margin)/60)+' Minuten geschätzter Restpuffer'),E('small','',Math.round(tr.meters)+' m Luftlinie · '+(assessment.live?'Aktuelle Prognosen beider Fahrten':'Nur Fahrplan, keine Echtzeitbestätigung')));timeline.append(t)}
 }
 stage.append(timeline);home.scrollTo?.({top:0});
}
function init(){
 bridge=window.SuedtirolRadar37;if(!bridge?.state?.map||!window.SuedtirolRadar50?.switchTab)return false;
 if($('sr70Home'))return true;
 document.body.classList.add('sr70-ready');initHome();makeDock();drawSearch();
 const first=location.hash.slice(1);
 // Preserve direct links to the legacy departures/stats/favorites tabs.
 // Radar 5.0 may open one of these before Horizon finishes initializing.
 const legacyStartup=['departures','stats','favorites'].includes(first);
 navigate(legacyStartup?'map':(['home','map','journey','more'].includes(first)?first:'home'),true);
 if(legacyStartup){nativeTab(first);if(first==='departures')for(const b of dock?.querySelectorAll('[data-page]')||[])b.setAttribute('aria-current',b.dataset.page==='departures'?'page':'false');}
 window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(['home','map','journey','more'].includes(p)&&p!==page)navigate(p,true)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!home.hidden){if(pane==='detail')drawResults(selected.from,selected.to,'');else if(pane==='results')drawSearch()}});
 window.SuedtirolRadar70={openHome:()=>navigate('home'),openJourney:()=>navigate('journey'),navigate,search:searchJourneys};
 return true;
}
let tries=0;const timer=setInterval(()=>{if(init()||++tries>=100)clearInterval(timer)},250);document.addEventListener('sr37:ready',()=>{if(init())clearInterval(timer)});
})();
