/* Radar 5.5 Mobile Experience: additive enhancement on top of 5.4.
   Source positions and timetable remain the source of truth; no synthetic GPS or delays. */
import {isRailRoute,formatClock} from './core.js?v=9.7.0';
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const button=(text,fn,cls='sr55-action')=>{const b=make('button',cls,text);b.type='button';b.addEventListener('click',fn);return b};
let bridge,map,ready=false,follow=false,followKey=null,followStopUntil=0,followLast=null,followBtn,toolMenu,panel,panelBody,searchList,stationCache=null,searchSeq=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const selected=()=>bridge?.state?.activeSheet==='vehicle'?bridge.state.vehicles.get(bridge.state.selectedKey):null;
const visible=()=>!$('sr50MapTab')?.classList.contains('sr50-map-inactive');
const today=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
const nowSeconds=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(p.hour)*3600+Number(p.minute)*60+Number(p.second)};
function announce(text){let a=$('sr55Announce');if(!a){a=make('div','sr55-sr-only');a.id='sr55Announce';a.setAttribute('aria-live','polite');document.body.append(a)}a.textContent=text}
function openPanel(title,description){if(!panel){panel=make('section','sr55-popover');panel.id='sr55Panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Zusatzinformationen');const heading=make('div','sr55-row');const titleEl=make('h3','');titleEl.id='sr55PanelTitle';heading.append(titleEl,button('Ô£ò',()=>closePanel()));panelBody=make('div');panelBody.id='sr55PanelBody';panel.append(heading,panelBody);document.body.append(panel)}$('sr55PanelTitle').textContent=title;panelBody.replaceChildren();if(description)panelBody.append(make('p','',description));panel.hidden=false}
function closePanel(){if(panel)panel.hidden=true}
function tools(){
 const group=document.querySelector('.map-actions');if(!group||$('sr55ToolBtn'))return;
 const b=button('Ôï»',()=>{toolMenu.hidden=!toolMenu.hidden;b.setAttribute('aria-expanded',String(!toolMenu.hidden))},'sr55-toolbtn');b.id='sr55ToolBtn';b.title='Weitere Kartenwerkzeuge';b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Kartenwerkzeuge ├Âffnen');
 toolMenu=make('div','sr55-toolmenu');toolMenu.id='sr55ToolMenu';toolMenu.hidden=true;
 for(const [label,id] of [['Ôûª Haltestellen','stationBtn'],['­ƒôì Ort w├ñhlen','areaBtn'],['­ƒù║ Kartenstil','tileBtn']]){
   toolMenu.append(button(label,()=>{toolMenu.hidden=true;b.setAttribute('aria-expanded','false');$(id)?.click()}));
 }
 group.append(b,toolMenu);
 document.addEventListener('click',e=>{if(!group.contains(e.target)){toolMenu.hidden=true;b.setAttribute('aria-expanded','false')}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){toolMenu.hidden=true;b.setAttribute('aria-expanded','false');closePanel()}});
}
function setFollow(on,reason=''){
 follow=!!on&&!!selected()&&visible();followKey=follow?selected().key:null;followLast=null;
 if(followBtn){followBtn.setAttribute('aria-pressed',String(follow));followBtn.textContent=follow?'Ôùë Folge aktiv':'ÔùÄ Live folgen'}
 if(reason)announce(reason);
}
function updateFollow(){
 if(!follow||!visible()||Date.now()<followStopUntil||document.body.classList.contains('sr71-focusing'))return;
 const v=selected();if(!v||v.key!==followKey){setFollow(false);return}
 if(v.stale||!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon)))return;
 const pos=bridge.state.markers.get(v.key)?.marker?.getLatLng?.();
 if(!pos||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lng))return;
 // Do not interpolate across implausible jumps; prefer reported positions.
 if(followLast){const distance=map.distance(followLast,pos);if(distance>4000){followLast=pos;return}if(distance<12)return}
 followLast=pos;
 const size=map.getSize();const sheet=$('sheet');const height=sheet?.classList.contains('open')?Math.min(size.y*.48,sheet.getBoundingClientRect().height):0;
 const zoom=map.getZoom();const adjusted=map.unproject(map.project(pos,zoom).add([0,height*.32]),zoom);
 if(map.distance(map.getCenter(),adjusted)<20)return;
 map.panTo(adjusted,{animate:!reduced.matches,duration:reduced.matches?0:.7,easeLinearity:.3});
}
function setupFollow(){
 const bar=$('sr46Actions');if(!bar||$('sr55Follow'))return false;
 followBtn=button('ÔùÄ Live folgen',()=>{setFollow(!follow,!follow?'Live-Folge beendet':'Live-Folge aktiviert')});
 followBtn.id='sr55Follow';followBtn.setAttribute('aria-pressed','false');followBtn.title='Kamera folgt neuen gemeldeten Positionen. Bei manueller Kartenbewegung wird sie angehalten.';
 const menu=$('sr53ActionMenu');
 if(!menu)return false;
 followBtn.classList.add('sr46-action');
 menu.append(followBtn);
 map.on('dragstart',()=>{if(follow)setFollow(false,'Live-Folge durch Kartenbewegung beendet')});
 map.on('zoomstart',()=>{if(follow)setFollow(false,'Live-Folge durch Zoom beendet')});
 // Focus from 5.2 is allowed to finish before the first tracking pan.
 document.addEventListener('sr37:selection',()=>{if(follow)setFollow(false)});
 document.addEventListener('sr37:sheet-closed',()=>setFollow(false));
 document.addEventListener('sr37:feeds',()=>{if(follow){followStopUntil=Date.now()+800;setTimeout(updateFollow,850)}});
 return true;
}
function setupInformation(){
 const cmp=$('sr51TrainCompare');if(!cmp||$('sr55DataExplainer'))return;
 const b=button('Ôôÿ Daten erkl├ñrt',()=>{
  openPanel('Wie zuverl├ñssig sind die Werte?','Die Ist-Position stammt aus einem Feed und kann gemeldet oder gesch├ñtzt sein. Die Soll-Position ist ein Fahrplanmodell. 10 km hinter Soll bedeuten nicht automatisch 10 Minuten Versp├ñtung. Die Versp├ñtungsanzeige ist ein eigener GTFS-RT-Wert und kann trotz gro├ƒer Positionsabweichung +0 melden.');
  panelBody.append(make('p','sr55-empty','Bei fehlenden oder alten Meldungen kann keine tats├ñchliche Ankunftszeit best├ñtigt werden.'))
 });b.id='sr55DataExplainer';b.style.marginTop='4px';cmp.append(b);
}
function prepareSearch(){
 const input=$('search');if(!input||$('sr55Suggest'))return;
 const wrap=input.closest('.search-wrap');if(!wrap)return;
 wrap.style.position='relative';searchList=make('div','sr55-toolmenu');searchList.id='sr55Suggest';searchList.hidden=true;searchList.style.cssText='left:0;right:0;bottom:auto;top:calc(100% + 5px);width:auto;max-height:42dvh;overflow:auto';wrap.append(searchList);
 input.setAttribute('placeholder','Zug, Bus oder Bahnhof');
 let timer=0;input.addEventListener('input',()=>{clearTimeout(timer);const q=input.value.trim().toLocaleLowerCase('de');const seq=++searchSeq;if(q.length<2){searchList.hidden=true;return}timer=setTimeout(()=>suggest(q,seq),180)});
 input.addEventListener('keydown',e=>{if(e.key==='Escape')searchList.hidden=true});
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))searchList.hidden=true});
}
async function suggest(q,seq){
 if(!bridge)return;
 searchList.replaceChildren();
 const matches=[...bridge.state.vehicles.values()].filter(v=>(String(v.name||'')+' '+String(v.headsign||'')).toLocaleLowerCase('de').includes(q)).slice(0,4);
 for(const v of matches){searchList.append(button((v.kind==='train'?'­ƒÜå ':'­ƒÜî ')+(v.name||'Fahrzeug')+' ┬À '+(v.headsign||''),()=>{searchList.hidden=true;$('search').blur();bridge.state.markers.get(v.key)?.marker?.fire('click')}))}
 try{if(!stationCache)stationCache=await bridge.getStationList?.();}catch{stationCache=[]}
 if(seq!==searchSeq)return;
 const seen=new Set();for(const s of (stationCache||[])){
  if(seen.size>=5)break;
  const name=String(s.name||'');if(!name.toLocaleLowerCase('de').includes(q)||seen.has(name.toLocaleLowerCase('de')))continue;seen.add(name.toLocaleLowerCase('de'));
  searchList.append(button('Ôûª '+name,()=>{searchList.hidden=true;$('search').blur();document.querySelector('.sr50-nav-btn[data-tab="departures"]')?.click();setTimeout(()=>{const i=$('sr50DepSearch');if(i){i.value=name;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus()}},100)}));
 }
 searchList.hidden=!searchList.children.length;
}
function nextStopAndConnections(v){
 const s=bridge.state,source=v.source,db=s.indexes[source],details=s.details[source],times=details?.times?.[v.tripId];
 if(!Array.isArray(times)||!db?.trips?.[v.tripId]||!details?.times||!details?.stops||!db?.meta?.days?.includes(today()))return null;
 const now=nowSeconds(),arrivals=times.filter(x=>Number.isFinite(Number(x[1]??x[2]))&&Number(x[1]??x[2])>=now-300);
 const next=arrivals[0];if(!next)return null;
 const arrival=Number(next[1]??next[2]);const stopId=String(next[0]);const stopName=details.stops[stopId]?.[0]||'N├ñchster Halt';
 const rows=[];
 for(const [tripId,stops] of Object.entries(details.times)){
  if(tripId===v.tripId||!Array.isArray(stops))continue;
  const trip=db.trips?.[tripId];if(!trip||trip[5]===false)continue;
  const dep=stops.find(x=>String(x[0])===stopId&&Number.isFinite(Number(x[2]))&&Number(x[2])>=arrival+180&&Number(x[2])<arrival+3600);
  if(!dep)continue;
  const dest=String(trip[1]||'Ziel unbekannt');const rail=isRailRoute(db.routes?.[trip[0]]?.[2]);
  rows.push({tripId,dest,dep:Number(dep[2]),buffer:Number(dep[2])-arrival,rail});
 }
 rows.sort((a,b)=>a.dep-b.dep);
 return {next,stopName,arrival,rows:rows.slice(0,12)};
}
function openConnections(){
 const v=selected();if(!v)return;
 openPanel('Anschluss-Radar','Fahrplanpr├╝fung am n├ñchsten Halt. Echtzeit-Erreichbarkeit wird nicht best├ñtigt, solange keine verl├ñsslichen Prognosen f├╝r beide Fahrten vorliegen.');
 const data=nextStopAndConnections(v);
 if(!data){panelBody.append(make('p','sr55-empty','Kein eindeutig zugeordneter aktueller Fahrtverlauf. Anschl├╝sse k├Ânnen nicht zuverl├ñssig gepr├╝ft werden.'));return}
 panelBody.append(make('p','sr55-label',data.stopName+' ┬À geplante Ankunft '+formatClock(data.arrival)));
 if(!data.rows.length){panelBody.append(make('p','sr55-empty','Keine passenden Anschlussfahrten aus dieser Fahrplandatenquelle im n├ñchsten Zeitfenster gefunden. Andere Verkehrsunternehmen sind m├Âglicherweise nicht enthalten.'));return}
 for(const r of data.rows){
  const row=make('div','sr55-row');const left=make('div');left.append(make('strong','',(r.rail?'­ƒÜå ':'­ƒÜî ')+r.dest),make('div','sr55-muted','Abfahrt '+formatClock(r.dep)+' ┬À '+Math.round(r.buffer/60)+' Min. planm├ñ├ƒige Umsteigezeit'));
  row.append(left,make('small','sr55-muted','Nur Plan'));panelBody.append(row)
 }
 panelBody.append(make('p','sr55-empty','Verbindungen basieren auf Stop-ID und Fahrplan derselben Quelle; Gleiswege, Ausf├ñlle und andere Datenquellen sind hier nicht vollst├ñndig gepr├╝ft.'));
}
function openDisruptions(){
 openPanel('St├Ârungscenter','Aktuelle Fahrtausf├ñlle und unvollst├ñndige Feedmeldungen. Dies ist keine amtliche Gesamtliste aller Betriebsst├Ârungen.');
 const s=bridge.state,affected=[];
 for(const [key,u] of s.updates||[]){if(/^(CANCELED|CANCELLED|3)$/i.test(String(u.scheduleRelationship||''))&&Date.now()-(u.fetchedAt||0)<120000)affected.push(key)}
 if(affected.length){panelBody.append(make('p','sr55-label',affected.length+' aktuelle Ausfallmeldungen'));for(const k of affected.slice(0,25))panelBody.append(make('div','sr55-row','Fahrt '+k+' ┬À Ausfall laut Feed'))}
 else panelBody.append(make('p','sr55-empty','Keine aktuellen Ausfallmeldungen im empfangenen Trip-Update-Cache erkannt. Das bedeutet nicht, dass es keine St├Ârungen gibt.'));
 for(const [key,status] of Object.entries(s.statuses||{}))if(status!=='ok')panelBody.append(make('div','sr55-row',key+': '+status));
}
function openAnalytics(){
 openPanel('Analytics Pro','Datenqualit├ñt und Anzahl der aktuell empfangenen Fahrzeuge. Die Versp├ñtungshistorie einzelner Z├╝ge bleibt in den bestehenden 5.4-Zugdetails.');
 const s=bridge.state,vehicles=[...s.vehicles.values()];const trains=vehicles.filter(v=>v.kind==='train').length;
 for(const [name,value] of [['Fahrzeuge im Feed',vehicles.length],['Z├╝ge',trains],['Busse',vehicles.filter(v=>v.kind==='bus').length],['Letzte bekannte Position',vehicles.filter(v=>v.stale).length]]){
  const row=make('div','sr55-row');row.append(make('span','',name),make('strong','',String(value)));panelBody.append(row)
 }
 panelBody.append(make('p','sr55-empty','Momentaufnahme, keine historische P├╝nktlichkeitsquote. F├╝r Trends sind wiederholte valide Messungen n├Âtig.'));
}
function extras(){
 const attempt=()=>{
  const menu=$('sr53ActionMenu');if(!menu||$('sr55Connections'))return false;
  const b=button('Ôåö Anschl├╝sse',openConnections,'sr46-action');b.id='sr55Connections';menu.append(b);
  return true;
 };
 let tries=0;const spin=()=>{if(!attempt()&&++tries<35)setTimeout(spin,220)};spin();
 // Extra tools live in existing stats/departures view, no fifth navigation tab.
 const nav=document.querySelector('.sr50-bottom-nav');if(!nav)return;
 const panelButton=button('ÔÜá St├Ârungen',openDisruptions);panelButton.id='sr55Disruptions';
 const analyticsButton=button('ÔûÑ Analytics',openAnalytics);analyticsButton.id='sr55Analytics';
 const insert=()=>{const view=$('sr50StatsView');if(view&&!view.querySelector('#sr55Analytics')){const row=make('div','sr55-tools');row.append(analyticsButton,panelButton);view.prepend(row)}};
 insert();document.addEventListener('click',e=>{if(e.target.closest('.sr50-nav-btn'))setTimeout(insert,80)});
}
function setupMoreMenuPortal(){
 const menu=$('sr53ActionMenu'),trigger=$('sr53More'),sheet=$('sheet');
 if(!menu||!trigger||!sheet)return false;
 if(menu.parentElement!==document.body)document.body.append(menu);
 const place=()=>{
  if(menu.hidden)return;
  const rect=trigger.getBoundingClientRect();
  const width=Math.max(170,Math.min(224,window.innerWidth-24));
  menu.style.position='fixed';
  menu.style.width=width+'px';
  menu.style.left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left))+'px';
  menu.style.top=Math.max(12,Math.min(window.innerHeight-menu.offsetHeight-12,rect.bottom+7))+'px';
  menu.style.right='auto';
  menu.style.zIndex='14000';
 };
 // Handler runs after the existing 5.3 toggle listener.
 trigger.addEventListener('click',()=>requestAnimationFrame(place));
 const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false')};
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!trigger.contains(e.target))close()});
 document.addEventListener('sr37:sheet-closed',close);
 document.addEventListener('sr37:selection',close);
 const scroll=sheet.querySelector('.sheet-scroll');
 scroll?.addEventListener('scroll',()=>{if(scroll.scrollTop>38)close()},{passive:true});
 window.addEventListener('resize',()=>{if(!menu.hidden)place()},{passive:true});
 menu.addEventListener('click',e=>{if(e.target.closest('button')&&e.target.id!=='sr55Follow')close()});
 return true;
}
function sheetGestures(){
 const sheet=$('sheet'),handle=sheet?.querySelector('.handle');if(!handle)return;
 handle.setAttribute('role','button');handle.setAttribute('tabindex','0');handle.setAttribute('aria-label','Fahrzeugdetails schlie├ƒen oder erweitern');
 let y=null;
 handle.addEventListener('pointerdown',e=>{if(e.isPrimary)y=e.clientY});
 handle.addEventListener('pointerup',e=>{if(y===null)return;const distance=e.clientY-y;y=null;if(distance>65){$('closeSheet')?.click()}else if(distance< -60){$('sr53Expand')?.click()}});
 handle.addEventListener('pointercancel',()=>{y=null});
 handle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('sr53Expand')?.click()}});
}
function setupCompactBadge(){
 const pill=$('sr53DelayPill');if(!pill)return;
 const update=()=>{
   const value=pill.textContent||'';
   const minutes=value.match(/([+ÔêÆ-]?\d+)\s*(?:Min\.|ÔÇ▓|min)/i);
   pill.dataset.short=minutes?minutes[1].replace('ÔêÆ','-'):(/p├╝nktlich/i.test(value)?'0':'ÔÇô');
 };
 update();
 new MutationObserver(update).observe(pill,{childList:true,characterData:true,subtree:true});
}
function setupScrollActions(){
 const sheet=$('sheet'),scroller=sheet?.querySelector('.sheet-scroll');
 if(!sheet||!scroller)return;
 let frame=0,collapsed=false;
 const refresh=()=>{
   frame=0;
   if(!sheet.classList.contains('open'))return;
   const top=scroller.scrollTop;
   const next=collapsed?top>10:top>42;
   if(next===collapsed)return;
   collapsed=next;
   sheet.classList.toggle('sr55-scrolled',collapsed);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(refresh)};
 scroller.addEventListener('scroll',schedule,{passive:true});
 document.addEventListener('sr37:selection',()=>{collapsed=false;sheet.classList.remove('sr55-scrolled')});
 document.addEventListener('sr37:sheet-closed',()=>{collapsed=false;sheet.classList.remove('sr55-scrolled')});
}
function init(){
 if(ready)return;bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
 if(!map||!$('sheet')||!document.querySelector('.sr50-bottom-nav'))return;
 let menuTries=0;const mount=()=>{if(!setupMoreMenuPortal()&&++menuTries<40)setTimeout(mount,160)};mount();
 if(!setupFollow()){let n=0;const poll=()=>{if(!setupFollow()&&++n<30)setTimeout(poll,200)};setTimeout(poll,220)}
 setupInformation();
 document.addEventListener('sr37:selection',()=>setTimeout(setupInformation,250));
 document.addEventListener('sr37:feeds',()=>{stationCache=null});
 window.SuedtirolRadar55={version:'5.5',openConnections,openAnalytics,openDisruptions};
}
document.addEventListener('sr37:ready',init);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
// Radar 5.0 builds navigation asynchronously; do not depend on module execution order.
let attempts=0;const bootCheck=setInterval(()=>{if(ready||++attempts>50){clearInterval(bootCheck);return}init()},200);
})();