/* Südtirol Radar 5.8 – Traffic Intelligence.
 * Additive UI only. Does not alter Leaflet, map sync or existing feeds.
 * All incidents derive from fresh, GTFS-valid TripUpdates. No fake push.
 */
import {collectTrafficIssues,summarizeNetwork,feedDiagnostics,matchingFavorite,rollingStockEvidence} from './radar58-logic.mjs';
import {findConnections} from './radar56-logic.mjs';
import {romeDay,romeSeconds} from './radar51-logic.mjs';
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls='',content)=>{const n=document.createElement(tag);n.className=cls;if(content!==undefined)n.textContent=String(content);return n};
const button=(label,fn,cls='sr58-btn')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n};
const STORE='sr58_alert_preferences_v1',FAVS='sr50_final_favorites_v1';
let bridge,banner,dialog,body,issues=[],diagnostics=[],stations=[],stationLoaded=false,tab='issues',selectedKey='',toastIds=new Set(),refreshTimer=null,vehicleFilter='train',searchQuery='',seenInitialized=false;
let prefs={enabled:false,delay:10,cancel:true,delayAlerts:true,favoritesOnly:true};
try{const value=JSON.parse(localStorage.getItem(STORE)||'{}');if(value&&typeof value==='object')prefs={...prefs,...value}}catch{}
const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify(prefs))}catch{}};
function favorites(){try{const x=JSON.parse(localStorage.getItem(FAVS)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function validAlerts(){return issues.filter(x=>x.severity==='danger'||x.severity==='delay'&&x.minutes>=10)}
function clock(s){return Number.isFinite(s)?String(Math.floor(s/3600)%24).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0'):'–'}
function issueRow(title,detail,level=''){
 const row=el('div','sr58-issue '+level);
 row.append(el('strong','',title),el('small','',detail));return row;
}
function close(){if(dialog?.open)dialog.close()}
function refresh(){
 if(!bridge)return;
 issues=collectTrafficIssues(bridge.state);
 diagnostics=feedDiagnostics(bridge.state.statuses);
 const actionable=validAlerts(),groups=summarizeNetwork(actionable);
 banner.hidden=actionable.length===0;
 document.body.classList.toggle('sr58-has-warning',actionable.length>0);
 $('sr58BannerTitle').textContent=groups.length+' betroffene Linien · '+actionable.length+' Fahrten';
 $('sr58BannerDetail').textContent=groups.slice(0,2).map(x=>(x.kind==='train'?'Zug ':'Bus ')+x.line+(x.cancelled?' · Ausfall':' · +'+x.maxDelay+' Min.')).join(' · ');
 if(dialog?.open && ['issues','network','health','vehicles','connections'].includes(tab))render();
 const unseen=[];
 for(const issue of actionable){
  if(!toastIds.has(issue.id))unseen.push(issue);
  toastIds.add(issue.id);
 }
 if(!seenInitialized){seenInitialized=true;return}
 if(!prefs.enabled||document.hidden)return;
 const fav=favorites();
 for(const issue of unseen.filter(x=>(x.severity==='danger'?prefs.cancel:prefs.delayAlerts&&x.minutes>=prefs.delay)&&(!prefs.favoritesOnly||matchingFavorite(x,fav,bridge.state))).slice(0,2)){
  const toast=button('⚠ '+issue.title,()=>{toast.remove();open('issues')},'sr58-toast');
  toast.setAttribute('role','status');document.body.append(toast);setTimeout(()=>toast.remove(),8500);
 }
}
function queueRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,550)}
function open(which='issues'){
 tab=which;
 if(!dialog){
  dialog=el('dialog','sr58-dialog');dialog.setAttribute('aria-label','Radar 5.8 Traffic Intelligence');
  const top=el('header','sr58-dialog-head');
  top.append(el('strong','','RADAR 5.8 · TRAFFIC INTELLIGENCE'),button('✕',close,'sr58-close'));
  body=el('div','sr58-body');dialog.append(top,body);
  document.body.append(dialog);
 }
 render();if(!dialog.open)dialog.showModal();
}
function render(){
 if(!dialog)return;
 body.replaceChildren();
 const navigation=el('nav','sr58-tabs');navigation.setAttribute('aria-label','Radar Bereiche');
 for(const [key,title] of [['issues','Störungen'],['network','Netzwerk'],['connections','Anschlüsse'],['vehicles','Fahrzeuge'],['search','Suche'],['health','Feeds'],['alerts','Alarme']]){
  const n=button(title,()=>{tab=key;render()},'sr58-tab');n.setAttribute('aria-pressed',String(tab===key));navigation.append(n);
 }
 body.append(navigation);
 if(tab==='issues')renderIssues();
 if(tab==='network')renderNetwork();
 if(tab==='connections')renderConnections();
 if(tab==='vehicles')renderVehicles();
 if(tab==='search')renderSearch();
 if(tab==='health')renderHealth();
 if(tab==='alerts')renderAlerts();
}
function renderIssues(){
 body.append(el('h2','','Live-Störungscenter'));
 if(!issues.length)body.append(el('p','sr58-muted','Keine größeren gemeldeten Störungen in den verfügbaren frischen Updates. Keine Garantie für störungsfreien Betrieb.'));
 for(const incident of issues.slice(0,65)){
  body.append(issueRow(incident.title,incident.detail+' · '+incident.source.toUpperCase(),incident.severity));
 }
 body.append(el('p','sr58-muted','Quelle: gültige GTFS-RT-TripUpdates. Keine allgemeine offizielle Sperrungsdatenbank. Ein Stoppsignal bedeutet nicht, dass die ganze Linie betroffen ist.'));
}
function renderNetwork(){
 body.append(el('h2','','Netzwerk-Radar'));
 const lines=summarizeNetwork(issues);
 if(!lines.length)body.append(el('p','sr58-muted','Noch keine belastbaren Störungsmeldungen für diese Übersicht.'));
 for(const l of lines.slice(0,70)){
  const note=(l.cancelled?l.cancelled+' Ausfälle':'')+(l.cancelled&&l.delayed?' · ':'')+(l.delayed?l.delayed+' Verspätungen · Max. +'+l.maxDelay+' Min.':'');
  body.append(issueRow((l.kind==='train'?'🚆 ':'🚌 ')+l.line,note,l.cancelled?'danger':'delay'));
 }
}
function renderHealth(){
 body.append(el('h2','','Feed Health Center'));
 for(const status of diagnostics)body.append(issueRow(status.source.toUpperCase(),status.ok?'Quelle meldet OK':'Nicht bestätigt: '+status.status,status.ok?'good':'unknown'));
 const at=Number(bridge.state.fetchedAt);
 if(Number.isFinite(at)&&at>0)body.append(el('p','sr58-muted','Letzter gesamter Feedabruf: '+new Date(at).toLocaleTimeString('de-DE')));
 body.append(el('p','sr58-muted','Ein grüner Feed beweist kein GPS. Ein fehlender Feed ist keine bestätigte Verkehrsstörung.'));
}
function setting(text,field){
 const wrap=el('label','sr58-setting'),control=el('input');control.type='checkbox';control.checked=Boolean(prefs[field]);
 control.addEventListener('change',()=>{prefs[field]=control.checked;persist();if(field==='enabled'&&prefs.enabled){for(const issue of validAlerts())toastIds.add(issue.id)}});
 wrap.append(control,el('span','',text));body.append(wrap);
}
function renderAlerts(){
 body.append(el('h2','','Live-Benachrichtigungen'));
 setting('In-App-Hinweise während Radar geöffnet ist','enabled');
 setting('Nur favorisierte Linien, Züge und Haltestellen','favoritesOnly');
 setting('Bestätigte Ausfälle','cancel');
 setting('Größere Verspätungen','delayAlerts');
 const set=el('label','sr58-setting');set.append(el('span','','Warnung ab'));
 const select=el('select');for(const minutes of [5,10,15,20,30]){
  const opt=el('option','',minutes+' Minuten');opt.value=minutes;if(Number(prefs.delay)===minutes)opt.selected=true;select.append(opt)
 }
 select.addEventListener('change',()=>{prefs.delay=Number(select.value);persist()});set.append(select);body.append(set);
 body.append(el('p','sr58-muted','Warnungen erscheinen nur bei neuen Meldungen, während diese Webseite geöffnet ist. Kein Push bei geschlossener App und keine Benachrichtigungsberechtigung erforderlich.'));
 if(prefs.favoritesOnly&&!favorites().length)body.append(el('p','sr58-muted','Du hast noch keine Favoriten gespeichert. In diesem Modus kommen erst nach dem Hinzufügen von Favoriten Meldungen.'));
}
function vehicleList(){return [...(bridge.state.vehicles?.values()||[])].filter(v=>!v.stale&&v.kind===vehicleFilter&&Boolean(v.tripId)).sort((a,b)=>String(a.name).localeCompare(String(b.name))).slice(0,75)}
function renderVehicles(){
 body.append(el('h2','','Fahrzeug-Explorer'));
 const tabs=el('div','sr58-vehicle-tabs');
 for(const [key,title] of [['train','🚆 Züge'],['bus','🚌 Busse']]){
  const b=button(title,()=>{vehicleFilter=key;render()},'sr58-tab');b.setAttribute('aria-pressed',String(vehicleFilter===key));tabs.append(b)
 }body.append(tabs);
 const list=vehicleList();
 if(!list.length)body.append(el('p','sr58-muted','Keine verwertbaren aktuellen Fahrzeuge in diesem Feed.'));
 for(const vehicle of list){
  const model=rollingStockEvidence(vehicle);
  const row=issueRow(vehicle.name||vehicle.tripId,(vehicle.headsign||'Ziel unbekannt')+' · '+vehicle.source.toUpperCase()+' · Fahrzeug-ID: '+(vehicle.vehicleId||'unbekannt'));
  row.append(el('small','',vehicle.kind==='train'?'Modell: '+model.name+' · '+model.source:'Bustyp: nicht verifiziert'));
  row.append(button('Auf Karte ↗',()=>{close();window.SuedtirolRadar50?.openVehicle?.(vehicle.key)},'sr58-inline-btn'));
  row.append(button('Anschlüsse ↗',()=>{selectedKey=vehicle.key;tab='connections';render()},'sr58-inline-btn'));
  body.append(row);
 }
}
function renderConnections(){
 body.append(el('h2','','Anschluss-Intelligence'));
 const candidate=bridge.state.vehicles?.get?.(selectedKey);
 if(!candidate){body.append(el('p','sr58-muted','Wähle einen Zug oder Bus im Fahrzeug-Explorer und öffne „Anschlüsse“.'));return}
 const state=bridge.state,source=candidate.source;
 const result=findConnections({source,tripId:candidate.tripId,db:state.indexes?.[source],details:state.details?.[source],updates:state.updates,statuses:state.statuses,serviceDay:romeDay(),nowSec:romeSeconds(),minTransfer:240});
 body.append(el('p','sr58-muted',candidate.name+' → '+(candidate.headsign||'Ziel unbekannt')+' · Mindestumstieg 4 Minuten, Fußweg nicht geprüft'));
 if(!result.station){body.append(el('p','sr58-muted',result.reason));return}
 body.append(issueRow('Nächster Umstieg: '+result.station.name,'Planmäßige Ankunft '+clock(result.station.arr)+(result.station.arrivalDelay===null?' · ohne bestätigte Echtzeit':' · Ankunft mit Echtzeitmeldung')));
 for(const item of result.rows.slice(0,14)){
  body.append(issueRow(item.line+' → '+item.destination,clock(item.departure+(item.assessment.live?(item.departureDelaySec||0):0))+' · '+item.assessment.label+' · '+Math.round(item.assessment.margin/60)+' Min. Abstand',item.assessment.kind));
 }
 if(!result.rows.length)body.append(el('p','sr58-muted',result.reason));
 body.append(el('p','sr58-muted','Nur eindeutige Stop-IDs derselben Datenquelle. Angezeigte Risiken garantieren weder Anschluss noch verpassten Anschluss.'));
}
function loadStations(){
 if(stationLoaded||typeof bridge.getStationList!=='function')return;
 stationLoaded=true;
 bridge.getStationList().then(list=>{stations=Array.isArray(list)?list:[];if(dialog?.open&&tab==='search'){const input=$('sr58Search');input?.dispatchEvent(new Event('input'))}}).catch(()=>{stations=[]});
}
function renderSearch(){
 body.append(el('h2','','Globale Suche'));
 loadStations();
 const input=el('input','sr58-search');input.id='sr58Search';input.type='search';input.placeholder='Bahnhof, Zug, Buslinie oder Fahrzeug-ID';input.setAttribute('aria-label','Radar durchsuchen');body.append(input);
 const results=el('div','sr58-results');body.append(results);
 const fill=()=>{
  results.replaceChildren();const q=input.value.trim().toLocaleLowerCase('de');if(q.length<2){results.append(el('p','sr58-muted','Mindestens zwei Zeichen eingeben.'));return}
  let found=0;const seen=new Set();
  for(const v of bridge.state.vehicles?.values()||[]){
   if(found>=15)break;
   if(![v.name,v.tripId,v.vehicleId,v.headsign].some(x=>String(x||'').toLocaleLowerCase('de').includes(q)))continue;
   if(seen.has(v.key))continue;seen.add(v.key);found++;
   results.append(button((v.kind==='train'?'🚆 ':'🚌 ')+(v.name||v.tripId)+' · '+(v.headsign||v.vehicleId||''),()=>{close();window.SuedtirolRadar50?.openVehicle?.(v.key)},'sr58-result'))
  }
  let count=0;
  for(const st of stations){
   if(count>=15)break;
   const name=String(st.name||'');if(!name.toLocaleLowerCase('de').includes(q))continue;
   const key='station:'+name.toLocaleLowerCase('de');if(seen.has(key))continue;seen.add(key);count++;
   results.append(button('⌖ '+name,()=>{close();window.SuedtirolRadar50?.switchTab?.('departures');window.SuedtirolRadar57?.openStation?.(st)},'sr58-result'))
  }
  for(const issue of issues.filter(x=>[x.line,x.title].some(x=>String(x).toLocaleLowerCase('de').includes(q))).slice(0,10))results.append(issueRow(issue.title,issue.detail,issue.severity));
  if(!results.childNodes.length)results.append(el('p','sr58-muted','Keine Treffer in den geladenen Daten.'));
 };
 input.addEventListener('input',fill);fill();input.focus();
}
function init(){
 bridge=window.SuedtirolRadar37;if(!bridge?.state?.map||!window.SuedtirolRadar57||banner)return;
 banner=button('',()=>open('issues'),'sr58-banner');banner.id='sr58Banner';banner.hidden=true;
 const headline=el('div','sr58-banner-heading');headline.append(el('span','','⚠ VERKEHRSSTÖRUNGEN'),el('span','','Details ›'));
 const title=el('strong');title.id='sr58BannerTitle';const detail=el('small');detail.id='sr58BannerDetail';
 banner.append(headline,title,detail);document.body.append(banner);
 const quick=button('◉ Radar',()=>open('issues'),'sr58-quick');quick.setAttribute('aria-label','Radar Störungen, Netz, Suche und Feedqualität');document.body.append(quick);
 document.addEventListener('sr37:feeds',queueRefresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRefresh()});
 refresh();
 const brand=document.querySelector('.brand-title em');if(brand)brand.textContent='5.8';
 document.title='Südtirol Radar 5.8 · Traffic Intelligence';
 window.SuedtirolRadar58={version:'5.8',open,refresh,getIssues:()=>issues};
}
let retries=0;
function boot(){if(window.SuedtirolRadar58)return;if(window.SuedtirolRadar37?.state?.map&&window.SuedtirolRadar57){init();return}if(retries++<100)setTimeout(boot,200)}
document.addEventListener('sr37:ready',()=>setTimeout(boot,150));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
