/* Radar 5.8 Traffic Intelligence. Additive module: never touches existing map sync. */
import {collectTrafficIssues,feedDiagnostics,summarizeNetwork,matchesFavorite,resolveRollingStock} from './radar58-logic.mjs';
import {findConnections} from './radar56-logic.mjs';
import {romeDay,romeSeconds} from './radar51-logic.mjs';

(()=>{
'use strict';
const $=id=>document.getElementById(id);
const element=(tag,cls='',value)=>{const a=document.createElement(tag);a.className=cls;if(value!==undefined)a.textContent=String(value);return a};
const button=(value,click,cls='sr58-btn')=>{const b=element('button',cls,value);b.type='button';b.addEventListener('click',click);return b};
const STORE='sr58_alert_preferences_v1',FAV='sr50_final_favorites_v1';
let bridge,banner,dialog,body,issues=[],health=[],stations=null,active='issues',selectedVehicleKey=null;
let seen=new Set(),scanned=false,prefs={enabled:false,onlyFavorites:true,threshold:10,cancellations:true,delays:true};
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved&&typeof saved==='object')prefs={...prefs,...saved}}catch{}
const keep=()=>{try{localStorage.setItem(STORE,JSON.stringify(prefs))}catch{}};
const favorites=()=>{try{const x=JSON.parse(localStorage.getItem(FAV)||'[]');return Array.isArray(x)?x:[]}catch{return []}};
const time=n=>!Number.isFinite(Number(n))?'–':String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0');
const row=(name,detail,level='')=>{const r=element('article','sr58-issue '+level);r.append(element('strong','',name),element('small','',detail));return r};
function refresh(){
 if(!bridge||!banner)return;
 issues=collectTrafficIssues(bridge.state);
 health=feedDiagnostics(bridge.state.statuses);
 const notices=issues.filter(i=>i.severity==='danger'||i.minutes>=10);
 const networks=summarizeNetwork(notices);
 if(notices.length){
  banner.hidden=false;
  $('sr58BannerTitle').textContent=networks.length+' betroffene Linien · '+notices.length+' Fahrten';
  $('sr58BannerDetail').textContent=networks.slice(0,2).map(x=>(x.kind==='train'?'Zug ':'Bus ')+x.line+(x.cancelled?' · Ausfall':' · +'+x.maxDelay+' Min.')).join(' · ');
 }else banner.hidden=true;
 // No startup notification avalanche. Show only newly observed events after initialization.
 const current=new Set(notices.map(i=>i.id));
 if(scanned&&prefs.enabled&&!document.hidden){
  let count=0;
  const fav=favorites();
  for(const i of notices){
   if(count>=2)break;
   if(seen.has(i.id)||i.severity==='danger'&&!prefs.cancellations||
      i.severity==='delay'&&(!prefs.delays||i.minutes<prefs.threshold))continue;
   if(prefs.onlyFavorites&&!matchesFavorite(i,fav))continue;
   count++;
   const toast=button(i.title,()=>{toast.remove();open('issues')},'sr58-toast');
   document.body.append(toast);setTimeout(()=>toast.remove(),6500);
  }
 }
 seen=current;scanned=true;
 if(dialog?.open&&['issues','network','health'].includes(active))render();
}
function open(tab='issues'){
 active=tab;
 if(!dialog){
  dialog=element('dialog','sr58-dialog');
  dialog.setAttribute('aria-label','Radar 5.8 Verkehrsintelligenz');
  const top=element('header','sr58-dialog-head');
  top.append(element('strong','','RADAR 5.8'),button('✕',()=>dialog.close(),'sr58-close'));
  body=element('div','sr58-body');
  dialog.append(top,body);document.body.append(dialog);
 }
 render();
 if(!dialog.open)dialog.showModal();
}
function render(){
 body.replaceChildren();
 const tabs=element('nav','sr58-tabs');
 for(const [id,label] of [['issues','Störungen'],['network','Netzwerk'],['connections','Anschlüsse'],['vehicles','Fahrzeuge'],['search','Suche'],['health','Daten'],['alerts','Alarme']]){
  const b=button(label,()=>open(id),'sr58-tab');b.setAttribute('aria-pressed',String(id===active));tabs.append(b);
 }
 body.append(tabs);
 if(active==='issues'){
  body.append(element('h2','','Aktuelle Störungen'));
  if(!issues.length)body.append(element('p','sr58-muted','Keine bestätigten größeren Fahrtprobleme im aktuell empfangenen GTFS-RT. Fehlende Meldungen bedeuten keine garantierte Störungsfreiheit.'));
  for(const issue of issues.slice(0,60))
   body.append(row(issue.title,issue.detail+' · '+issue.source.toUpperCase(),issue.severity));
  body.append(element('p','sr58-muted','Ausfälle und Verspätungen basieren auf frischen GTFS-RT-Fahrtmeldungen. Keine vollständige offizielle Störungsliste.'));
 }
 if(active==='network'){
  body.append(element('h2','','Netzwerk-Radar'));
  const groups=summarizeNetwork(issues);
  if(!groups.length)body.append(element('p','sr58-muted','Keine gemeldeten größeren Fahrtprobleme. Aussage nur über verfügbare Feeds.'));
  for(const g of groups.slice(0,60))
   body.append(row((g.kind==='train'?'🚆 ':'🚌 ')+g.line,
    (g.cancelled?g.cancelled+' bestätigte Ausfälle · ':'')+(g.delayed?g.delayed+' gemeldete Verspätungen · maximal +'+g.maxDelay+' Min.':'')+' · '+g.source.toUpperCase(),
    g.cancelled?'danger':g.delayed?'delay':''));
 }
 if(active==='connections'){
  body.append(element('h2','','Anschluss-Intelligence'));
  const v=[...(bridge.state.vehicles?.values()||[])].find(v=>v.key===selectedVehicleKey);
  if(!v){body.append(element('p','sr58-muted','Wähle zuerst einen Zug im Fahrzeug-Explorer aus.'));body.append(button('Fahrzeuge öffnen',()=>open('vehicles'),'sr58-primary'));return}
  const state=bridge.state;
  const data=findConnections({source:v.source,tripId:v.tripId,stops:state.details?.[v.source]?.stops,
   db:state.indexes?.[v.source],details:state.details?.[v.source],
   updates:state.updates,statuses:state.statuses,serviceDay:romeDay(new Date()),nowSec:romeSeconds(new Date()),minTransfer:240});
  body.append(element('p','sr58-muted',(v.name||v.tripId)+' · '+(v.headsign||'')+' · Mindestumstieg 4 Min.; tatsächlicher Gehweg nicht geprüft.'));
  if(!data?.station){body.append(element('p','sr58-muted',data?.reason||'Für diese Fahrt keine belastbare Anschlussbewertung verfügbar.'));return}
  body.append(row('Nächster Halt · '+data.station.name,'Geplant '+time(data.station.arr)));
  if(!data.rows?.length)body.append(element('p','sr58-muted',data.reason||'Keine passenden Anschlüsse ermittelt.'));
  for(const c of (data.rows||[]).slice(0,14))
   body.append(row(c.line+' → '+c.destination,time(c.departure+(c.assessment.live?(c.departureDelaySec||0):0))+' · '+c.assessment.label+' · '+Math.round(c.assessment.margin/60)+' Min. Restzeit',c.assessment.kind));
  body.append(element('p','sr58-muted','Nur passende GTFS-Stop-IDs derselben Quelle. Kein garantiert erreichbarer Anschluss.'));
 }
 if(active==='vehicles'){
  body.append(element('h2','','Fahrzeug-Explorer'));
  const all=[...(bridge.state.vehicles?.values()||[])].filter(v=>v.kind==='train'&&!v.stale)
   .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).slice(0,80);
  if(!all.length)body.append(element('p','sr58-muted','Derzeit keine aktiv gemeldeten Züge.'));
  for(const v of all){
   const stock=resolveRollingStock(v);
   const card=row(v.name||v.tripId,'Fahrzeugkennung: '+(v.vehicleId||'unbekannt')+' · '+v.source.toUpperCase());
   card.append(element('small','','Fahrzeugtyp: '+stock.name+' · '+stock.evidence));
   card.append(button('Auf Karte',()=>{dialog.close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr58-inline'));
   card.append(button('Anschlüsse',()=>{selectedVehicleKey=v.key;open('connections')},'sr58-inline'));
   body.append(card);
  }
 }
 if(active==='search'){
  body.append(element('h2','','Globale Suche'));
  const input=element('input','sr58-search');input.type='search';input.placeholder='Bahnhof, Zug, Buslinie, Fahrzeugnummer';
  input.setAttribute('aria-label','Globale Suche');body.append(input);
  const results=element('div','sr58-results');body.append(results);
  const show=()=>{
   results.replaceChildren();const q=input.value.toLocaleLowerCase('de').trim();
   if(q.length<2){results.append(element('p','sr58-muted','Mindestens 2 Zeichen eingeben.'));return}
   const vehicles=[...(bridge.state.vehicles?.values()||[])].filter(v=>
    [v.name,v.tripId,v.vehicleId,v.headsign].some(x=>String(x||'').toLocaleLowerCase('de').includes(q))).slice(0,14);
   for(const v of vehicles)results.append(button((v.kind==='train'?'🚆 ':'🚌 ')+(v.name||'Fahrzeug')+' · '+(v.headsign||v.vehicleId),
    ()=>{dialog.close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr58-result'));
   const seenNames=new Set();let shown=0;
   for(const st of stations||[]){
    if(shown>=12)break;
    const name=String(st.name||'');if(!name.toLocaleLowerCase('de').includes(q))continue;
    const k=name.trim().toLocaleLowerCase('de');if(seenNames.has(k))continue;seenNames.add(k);shown++;
    results.append(button('⌖ '+name,()=>{dialog.close();window.SuedtirolRadar50?.switchTab?.('departures');window.SuedtirolRadar57?.openStation?.(st)},'sr58-result'));
   }
   for(const i of issues.filter(i=>i.line.toLocaleLowerCase('de').includes(q)).slice(0,7))
    results.append(row(i.title,i.detail,i.severity));
   if(!results.children.length)results.append(element('p','sr58-muted','Keine Treffer in aktuell verfügbaren Daten.'));
  };
  input.addEventListener('input',show);show();
  if(stations===null&&bridge.getStationList){
   bridge.getStationList().then(xs=>{stations=Array.isArray(xs)?xs:[];if(input.isConnected)show()}).catch(()=>{stations=[]});
  }
 }
 if(active==='health'){
  body.append(element('h2','','Feed Health Center'));
  if(!health.length)body.append(element('p','sr58-muted','Keine Feed-Statusinformationen verfügbar.'));
  for(const source of health)body.append(row(source.source.toUpperCase(),source.ok?'Quelle meldet OK':'Status: '+source.status,source.ok?'good':'unknown'));
  const stamp=Number(bridge.state.fetchedAt);
  if(Number.isFinite(stamp)&&stamp>0)body.append(element('p','sr58-muted','Letzter bekannter Feed-Abruf: '+new Date(stamp).toLocaleTimeString('de-DE')));
  body.append(element('p','sr58-muted','Fehlende Echtzeitdaten sind keine Betriebsstörung. Auch ein Feed mit Status OK deckt nicht zwangsläufig alle Fahrzeuge ab.'));
 }
 if(active==='alerts'){
  body.append(element('h2','','Live-Benachrichtigungen'));
  const check=(name,field)=>{
   const label=element('label','sr58-setting'),input=element('input');input.type='checkbox';
   input.checked=Boolean(prefs[field]);input.addEventListener('change',()=>{prefs[field]=input.checked;keep()});
   label.append(input,element('span','',name));body.append(label);
  };
  check('In-App-Warnungen während der Nutzung', 'enabled');
  check('Nur Favoriten', 'onlyFavorites');
  check('Ausfallmeldungen', 'cancellations');
  check('Größere Verspätungen', 'delays');
  const label=element('label','sr58-setting');label.append(element('span','','Verspätungen ab'));
  const select=element('select');for(const n of [5,10,15,20,30]){const option=element('option','',n+' Min.');option.value=String(n);option.selected=prefs.threshold===n;select.append(option)}
  select.addEventListener('change',()=>{prefs.threshold=Number(select.value);keep()});
  label.append(select);body.append(label);
  body.append(element('p','sr58-muted','Nur innerhalb der geöffneten App. Kein Hintergrund-Push und keine Benachrichtigung bei geschlossener App.'));
 }
}
function init(){
 bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!window.SuedtirolRadar57||banner)return;
 banner=button('',()=>open('issues'),'sr58-banner');banner.id='sr58Banner';banner.hidden=true;
 const line=element('div','sr58-banner-heading');line.append(element('span','','⚠ VERKEHRSSTÖRUNGEN'),element('span','','Details ›'));
 const title=element('strong');title.id='sr58BannerTitle';
 const detail=element('small');detail.id='sr58BannerDetail';banner.append(line,title,detail);
 document.body.append(banner);
 const quick=button('◉ Radar',()=>open('issues'),'sr58-quick');
 quick.setAttribute('aria-label','Störungen, Fahrzeuginformationen, Suche und Feeds');
 document.body.append(quick);
 document.addEventListener('sr37:feeds',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 if(bridge.getStationList)bridge.getStationList().then(s=>{stations=Array.isArray(s)?s:[]}).catch(()=>{stations=[]});
 refresh();
 window.SuedtirolRadar58={version:'5.8',open,refresh,getIssues:()=>issues};
}
let attempts=0;
function boot(){if(window.SuedtirolRadar58)return;
 if(window.SuedtirolRadar37?.state?.map&&window.SuedtirolRadar57){init();return}
 if(attempts++<80)setTimeout(boot,200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
document.addEventListener('sr37:ready',()=>setTimeout(boot,150));
})();