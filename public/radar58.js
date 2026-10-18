/* Radar 5.8 Traffic Intelligence: additive, no replacement of 5.7 map logic */
import {collectTrafficIssues,feedDiagnostics,summarizeNetwork,matchesFavoriteIssue,resolveRollingStock} from './radar58-logic.mjs';
import {findConnections} from './radar56-logic.mjs';
import {romeDay,romeSeconds} from './radar51-logic.mjs';
(()=>{
'use strict';
const $=id=>document.getElementById(id),e=(tag,cls='',txt)=>{const n=document.createElement(tag);n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
const btn=(txt,fn,cls='sr58-btn')=>{const b=e('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b};
let bridge,banner,dialog,body,issues=[],diagnostics=[],alarmIds=new Set(),lastUpdate=0,stationCache=null,notificationsSeeded=false,dismissedAlertIds=new Set();
const STORE='sr58_alert_preferences_v1';
let prefs={enabled:false,delay:10,cancel:true,delayAlerts:true,platform:true,favoritesOnly:true};
try{prefs={...prefs,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(prefs))}catch{}}
function favorites(){try{const data=JSON.parse(localStorage.getItem('sr50_final_favorites_v1')||'[]');return Array.isArray(data)?data:[]}catch{return []}}
function fmt(sec){return String(Math.floor(sec/3600)%24).padStart(2,'0')+':'+String(Math.floor(sec%3600/60)).padStart(2,'0')}
function refresh(){
 if(!bridge)return;
 lastUpdate=Date.now();
 issues=collectTrafficIssues(bridge.state);
 diagnostics=feedDiagnostics(bridge.state.statuses);
 const cancel=issues.filter(x=>x.severity==='danger'),severe=issues.filter(x=>x.severity==='delay'&&x.minutes>=10);
 const alerts=[...cancel,...severe],groups=summarizeNetwork(alerts);
 if(alerts.length){
  const activeIds=alerts.map(x=>x.id);
  const hasNew=activeIds.some(id=>!dismissedAlertIds.has(id));
  banner.hidden=!hasNew;banner.classList.add('sr58-warning');
  $('sr58BannerTitle').textContent=groups.length+' betroffene Linien · '+alerts.length+' Meldungen';
  $('sr58BannerDetail').textContent=groups.slice(0,2).map(x=>(x.kind==='train'?'Zug ':'Bus ')+x.line+(x.cancelled?' · Problem/Ausfall':' · +'+x.maxDelay+' Min.')).join('  ·  ');
 }else{
  banner.hidden=true;dismissedAlertIds.clear();
 }
 if(dialog?.open && ['issues','network','health','vehicles'].includes(current))renderCurrent();
 const allNotices=issues.filter(x=>x.severity==='danger'||x.severity==='info'||x.severity==='delay'&&x.minutes>=5);
 const newlySeen=allNotices.filter(x=>{if(alarmIds.has(x.id))return false;alarmIds.add(x.id);return true});
 // Never show a storm of old alerts when the page starts or alerts are enabled.
 if(!notificationsSeeded){notificationsSeeded=true;return}
 if(prefs.enabled&&!document.hidden){
  const favs=favorites();let shown=0;
  for(const x of newlySeen){
   if(prefs.favoritesOnly&&!matchesFavoriteIssue(x,favs))continue;
   if(x.severity==='danger'&&!prefs.cancel||x.severity==='info'&&!prefs.platform||x.severity==='delay'&&(!prefs.delayAlerts||x.minutes<prefs.delay))continue;
   if(shown>=2)break;
   const toast=e('div','sr58-toast',x.title);
   toast.setAttribute('role','status');toast.addEventListener('click',()=>{toast.remove();open('issues')});
   document.body.append(toast);shown++;setTimeout(()=>toast.remove(),8000);
  }
 }
}
let current='issues',connectionKey='';
function showConnections(v){connectionKey=v.key;open('connections')}
function open(tab){
 current=tab;
 if(!dialog){
  dialog=e('dialog','sr58-dialog');dialog.setAttribute('aria-label','Radar Verkehrsintelligenz');
  const head=e('header','sr58-dialog-head');head.append(e('strong','','RADAR 5.8 · INTELLIGENCE'),btn('✕',()=>dialog.close(),'sr58-close'));
  body=e('div','sr58-body');dialog.append(head,body);document.body.append(dialog);
 }
 renderCurrent();if(!dialog.open)dialog.showModal();
}
function textRow(title,detail,level=''){
 const row=e('div','sr58-issue '+level);row.append(e('strong','',title),e('small','',detail));return row;
}
function renderCurrent(){
 body.replaceChildren();
 const tabs=e('nav','sr58-tabs');
 for(const [key,name] of [['issues','Störungen'],['network','Netzwerk'],['connections','Anschlüsse'],['health','Daten'],['search','Suche'],['vehicles','Fahrzeuge'],['alerts','Alarme']]){
  const b=btn(name,()=>open(key),'sr58-tab');b.setAttribute('aria-pressed',String(current===key));tabs.append(b)
 }
 body.append(tabs);
 if(current==='issues'){
  body.append(e('h2','','Aktuelle Störungen'));
  if(!issues.length)body.append(e('p','sr58-muted','Keine bestätigten größeren Fahrtstörungen in den aktuell empfangenen Updates. Das bedeutet nicht, dass keine Probleme bestehen.'));
  for(const issue of issues.slice(0,60))body.append(textRow(issue.title,issue.detail+' · '+issue.source.toUpperCase(),issue.severity));
 }
 if(current==='network'){
  body.append(e('h2','','Netzwerk-Radar'));
  const groups=summarizeNetwork(issues);
  if(!groups.length)body.append(e('p','sr58-muted','Keine verwertbaren Störungsmeldungen. Keine Aussage über das gesamte Verkehrsnetz.'));
  for(const x of groups.slice(0,60))body.append(textRow((x.kind==='train'?'🚆 ':'🚌 ')+x.line,[x.cancelled?x.cancelled+' Ausfälle/entfallene Halte':'',x.delayed?x.delayed+' verspätete Fahrten · max. +'+x.maxDelay+' Min.':'',x.changed?x.changed+' Gleiswechsel':''].filter(Boolean).join(' · '),x.cancelled?'danger':x.delayed?'delay':'info'));
 }
 if(current==='health'){
  body.append(e('h2','','Feed Health Center'));
  for(const f of diagnostics)body.append(textRow(f.source.toUpperCase(),f.ok?'Quelle meldet OK':'Feed-Status: '+f.status,f.ok?'good':'unknown'));
  const at=Number(bridge.state.fetchedAt)||0;
  if(at)body.append(e('p','sr58-muted','Letzter insgesamt vermerkter Feed-Abruf: '+new Date(at).toLocaleTimeString('de-DE')));
  body.append(e('p','sr58-muted','Feed OK bedeutet nicht, dass jedes Fahrzeug Echtzeitpositionen sendet. Fehlende Feeds sind keine Betriebsstörungen.'));
 }
 if(current==='alerts'){
  body.append(e('h2','','Benachrichtigungen'));
  const en=e('label','sr58-setting'),ck=e('input');ck.type='checkbox';ck.checked=prefs.enabled;ck.onchange=()=>{prefs.enabled=ck.checked;if(!ck.checked)alarmIds.clear();persist()};en.append(ck,e('span','','Hinweise während der Nutzung'));body.append(en);
  const only=e('label','sr58-setting'),oc=e('input');oc.type='checkbox';oc.checked=prefs.favoritesOnly;oc.onchange=()=>{prefs.favoritesOnly=oc.checked;alarmIds.clear();persist()};only.append(oc,e('span','','Nur favorisierte Linien, Züge und Haltestellen'));body.append(only);
  const cn=e('label','sr58-setting'),cc=e('input');cc.type='checkbox';cc.checked=prefs.cancel;cc.onchange=()=>{prefs.cancel=cc.checked;persist()};cn.append(cc,e('span','','Ausfallmeldungen'));body.append(cn);
  const pn=e('label','sr58-setting'),pc=e('input');pc.type='checkbox';pc.checked=prefs.platform;pc.onchange=()=>{prefs.platform=pc.checked;persist()};pn.append(pc,e('span','','Gleiswechsel'));body.append(pn);
  const dn=e('label','sr58-setting'),dc=e('input');dc.type='checkbox';dc.checked=prefs.delayAlerts;dc.onchange=()=>{prefs.delayAlerts=dc.checked;persist()};dn.append(dc,e('span','','Verspätungsmeldungen'));body.append(dn);
  const delay=e('label','sr58-setting');delay.append(e('span','','Verspätung ab (Minuten)'));
  const select=e('select');for(const m of [5,10,15,20,30]){const o=e('option','',m);o.value=m;if(m===prefs.delay)o.selected=true;select.append(o)}select.onchange=()=>{prefs.delay=Number(select.value);persist()};delay.append(select);body.append(delay);
  body.append(e('p','sr58-muted','Es gibt derzeit keine Push-Nachrichten bei geschlossener App. Keine Browserberechtigung wird angefordert. Meldungen werden nur während der Nutzung angezeigt.'));
 }
 if(current==='search'){
  body.append(e('h2','','Globale Suche'));
  const input=e('input','sr58-search');input.type='search';input.placeholder='Bahnhof, Zug, Buslinie, Fahrzeug';body.append(input);
  const results=e('div','sr58-results');body.append(results);
  if(!stationCache&&typeof bridge.getStationList==='function'){
   bridge.getStationList().then(list=>{stationCache=Array.isArray(list)?list:[];if(dialog?.open&&current==='search'&&input.isConnected)input.dispatchEvent(new Event('input'))}).catch(()=>{stationCache=[]});
  }
  const render=()=>{
   results.replaceChildren();const q=input.value.trim().toLocaleLowerCase('de');if(q.length<2){results.append(e('p','sr58-muted','Mindestens zwei Zeichen eingeben'));return}
   const found=new Set(),vehicles=[...(bridge.state.vehicles?.values()||[])].filter(v=>[v.name,v.tripId,v.vehicleId,v.headsign].some(x=>String(x||'').toLocaleLowerCase('de').includes(q))).slice(0,15);
   for(const v of vehicles){
    const key='vehicle:'+v.key;if(found.has(key))continue;found.add(key);
    results.append(btn((v.kind==='train'?'🚆 ':'🚌 ')+v.name+' · '+(v.headsign||v.vehicleId),()=>{dialog.close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr58-result'));
   }
   let stationsShown=0;
   for(const st of stationCache||[]){
    if(stationsShown>=12)break;
    const name=String(st.name||'');if(!name.toLocaleLowerCase('de').includes(q))continue;
    const key='stop:'+name.toLocaleLowerCase('de');if(found.has(key))continue;found.add(key);stationsShown++;
    results.append(btn('⌖ '+name+' · Bahnhof/Haltestelle',()=>{dialog.close();window.SuedtirolRadar50?.switchTab?.('departures');window.SuedtirolRadar57?.openStation?.(st)},'sr58-result'));
   }
   for(const x of issues.filter(x=>[x.line,x.title].some(t=>String(t).toLocaleLowerCase('de').includes(q))).slice(0,10))results.append(textRow(x.title,x.detail,x.severity));
   if(!results.childNodes.length)results.append(e('p','sr58-muted','Keine Treffer in aktuell geladenen Daten. Die Bahnhofsliste wird bei Bedarf geladen.'));
  };input.oninput=render;render();
 }
 if(current==='vehicles'){
  body.append(e('h2','','Fahrzeug-Explorer'));
  const vs=[...(bridge.state.vehicles?.values()||[])].filter(x=>x.kind==='train'&&!x.stale).sort((a,b)=>String(a.name).localeCompare(String(b.name))).slice(0,90);
  if(!vs.length)body.append(e('p','sr58-muted','Derzeit keine aktiven Züge mit verwertbaren Fahrzeugdaten.'));
  for(const v of vs){
   const label=e('div','sr58-issue');
   label.append(e('strong','',v.name||v.tripId),e('small','','Fahrzeug-ID: '+(v.vehicleId||'unbekannt')+' · '+v.source.toUpperCase()));
   const model=resolveRollingStock(v);
   label.append(e('small','','Fahrzeugtyp: '+model.name+' · '+model.evidence));
   label.append(btn('Auf Karte ansehen →',()=>{dialog.close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr58-inline-btn'));
   label.append(btn('Anschluss-Radar →',()=>showConnections(v),'sr58-inline-btn'));
   body.append(label);
  }
 }
 if(current==='connections'){
  const v=[...(bridge.state.vehicles?.values()||[])].find(x=>x.key===connectionKey);
  body.append(e('h2','','Anschluss-Intelligence'));
  if(!v){body.append(e('p','sr58-muted','Bitte zuerst im Fahrzeug-Explorer einen Zug oder Bus auswählen.'));return}
  const s=bridge.state,data=findConnections({source:v.source,tripId:v.tripId,db:s.indexes[v.source],details:s.details[v.source],updates:s.updates,statuses:s.statuses,serviceDay:romeDay(),nowSec:romeSeconds(),minTransfer:240});
  body.append(e('p','sr58-muted',v.name+' · '+(v.headsign||'Ziel unbekannt')+' · Mindestumstieg 4 Min. (Fußweg nicht geprüft)'));
  if(!data.station){body.append(e('p','sr58-muted',data.reason));return}
  body.append(textRow('Nächster Halt: '+data.station.name,'Geplant '+fmt(data.station.arr)+(data.station.arrivalDelay===null?' · keine Ankunftsprognose':' · mit Echtzeitmeldung')));
  if(!data.rows.length)body.append(e('p','sr58-muted',data.reason||'Keine passenden Anschlüsse'));
  for(const c of data.rows.slice(0,14))body.append(textRow(c.line+' → '+c.destination,fmt(c.departure+(c.assessment.live?(c.departureDelaySec||0):0))+' · '+c.assessment.label+' · '+Math.round(c.assessment.margin/60)+' Min. Umsteigezeit',c.assessment.kind));
  body.append(e('p','sr58-muted','Nur eindeutig identische Haltestellen innerhalb desselben GTFS-Feeds. Keine garantierte Anschlusssicherung.'));
 }
}

function initLiquidNav(){
 const nav=document.getElementById('sr50BottomNav');
 if(!nav||nav.querySelector('.sr58-liquid-pill'))return;
 const pill=e('span','sr58-liquid-pill');
 pill.setAttribute('aria-hidden','true');
 nav.prepend(pill);nav.classList.add('sr58-liquid-nav');
 const buttons=[...nav.querySelectorAll('.sr50-nav-btn')];
 let initialized=false;
 const move=()=>{
  const active=nav.querySelector('.sr50-nav-btn.active')||buttons[0];
  if(!active)return;
  const a=active.getBoundingClientRect(),n=nav.getBoundingClientRect();
  pill.style.width=a.width+'px';
  pill.style.height=a.height+'px';
  pill.style.transform='translate3d('+(a.left-n.left)+'px,'+(a.top-n.top)+'px,0)';
  if(!initialized){pill.classList.add('sr58-liquid-ready');initialized=true}
 };
 // Observe class updates from the existing tab controller without changing its behavior.
 const observer=new MutationObserver(move);
 for(const b of buttons)observer.observe(b,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',move,{passive:true});
 if(window.ResizeObserver)new ResizeObserver(move).observe(nav);
 requestAnimationFrame(()=>requestAnimationFrame(move));
}

function init(){
 bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!window.SuedtirolRadar57||banner)return;
 banner=btn('',()=>open('issues'),'sr58-banner');banner.id='sr58Banner';banner.hidden=true;
 const heading=e('div','sr58-banner-heading');heading.append(e('span','','⚠ VERKEHRSSTÖRUNGEN'));
 const controls=e('span','sr58-banner-controls');controls.append(e('span','','Details ›'));
 const close=btn('✕',event=>{},'sr58-banner-close');
 close.setAttribute('aria-label','Verkehrsstörungen schließen');
 close.addEventListener('click',event=>{event.stopPropagation();dismissedAlertIds=new Set(issues.filter(x=>x.severity==='danger'||x.severity==='delay'&&x.minutes>=10).map(x=>x.id));banner.hidden=true});
 controls.append(close);heading.append(controls);
 const title=e('strong');title.id='sr58BannerTitle';
 const detail=e('small');detail.id='sr58BannerDetail';banner.append(heading,title,detail);
 document.body.append(banner);
 initLiquidNav();
 // Dedicated switchboard button outside the map. Existing navigation untouched.
 const quick=btn('◉ Radar',()=>open('issues'),'sr58-quick');quick.setAttribute('aria-label','Radar 5.8 Störungen, Suche und Datenqualität');document.body.append(quick);
 document.addEventListener('sr37:feeds',refresh);
 bridge.getStationList?.().then(list=>{stations=Array.isArray(list)?list:[]}).catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 refresh();
 window.SuedtirolRadar58={version:'5.8',open,refresh,getIssues:()=>issues,getFeedHealth:()=>diagnostics};
 document.title='Südtirol Radar 5.8 · Traffic Intelligence';
 const version=document.querySelector('.brand-title em');if(version)version.textContent='5.8';
}
let attempts=0;
function boot(){if(window.SuedtirolRadar58)return;if(window.SuedtirolRadar37?.state?.map&&window.SuedtirolRadar57){init();return}if(attempts++<90)setTimeout(boot,200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
document.addEventListener('sr37:ready',()=>setTimeout(boot,250));
})();
