/* Radar 6.8 — progressive vehicle details. Additive UI; GTFS and map layers untouched. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const advanced=['sr52DelayCard','sr52LineCard','sr52RouteCard','sr64Quality','sr55DataExplainer'];
let overlay,content,openButton,returnFocus=null,holders=[],active=false;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function restore(){for(const [node,parent,next] of holders){if(parent.isConnected)parent.insertBefore(node,next?.parentNode===parent?next:null)}holders=[];}
function close(){if(!active)return;active=false;restore();overlay.hidden=true;document.body.classList.remove('sr68-detail-open');openButton?.focus({preventScroll:true});}
function open(){
 const sheet=$('sheet');if(!sheet?.classList.contains('open'))return;
 returnFocus=document.activeElement;active=true;holders=[];content.replaceChildren();
 const heading=el('section','sr68-detail-summary');
 heading.append(el('span','sr68-kicker','FAHRTANALYSE'),el('h3','', $('sheetTitle')?.textContent||'Fahrzeug'),el('p','', $('sheetSub')?.textContent||''));
 content.append(heading);
 const description=el('section','sr68-info');
 description.append(el('h3','','Radar Intelligence'),el('p','', 'Hier erscheinen vorhandene Auswertungen aus Feedmeldungen. Es werden keine zusätzlichen KI-Prognosen oder Verspätungswerte erfunden.'));
 content.append(description);
 const history=el('section','sr75-history-summary');history.id='sr75HistorySummary';
 history.append(el('h3','','Verspätungshistorie / Storico ritardi'));
 const summary=el('p','','Historische Prognosen werden geladen …');history.append(summary);content.append(history);
 const selected=window.SuedtirolRadar37?.state;
 const vehicle=selected?.vehicles?.get?.(selected.selectedKey);
 const trip=vehicle?.tripId||vehicle?.trip_id||null;
 const stop=vehicle?.nextStopId||vehicle?.stopId||null;
 const query=trip?('trip='+encodeURIComponent(trip)):stop?('stop='+encodeURIComponent(stop)):null;
 if(query)fetch('/api/history/analytics?'+query+'&hours=48',{headers:{accept:'application/json'}})
  .then(async r=>{if(!r.ok)throw Error('unavailable');return r.json()})
  .then(data=>{if(!history.isConnected)return;summary.textContent=data.sampleCount>0?`${data.sampleCount} Feed-Prognosen · Ø ${data.averageMinutes} Min. · Median ${data.medianMinutes} Min. · ${data.latePercent}% mit über +1 Min. (keine bestätigten Ankünfte)`:'Noch keine historischen Feed-Prognosen für diese Fahrt vorhanden.'})
  .catch(()=>{if(history.isConnected)summary.textContent='Historische Auswertung derzeit nicht verfügbar.'});
 else summary.textContent='Keine eindeutige Fahrt- oder Haltestellenkennung für die Historie vorhanden.';

 const shared=$('sheet')?.querySelector('.sheet-scroll');
 for(const id of advanced){
  const node=$(id);
  if(!node||!shared?.contains(node))continue;
  holders.push([node,node.parentNode,node.nextSibling]);content.append(node);
 }
 if(holders.length===0)content.append(el('p','sr68-empty','Für diese Fahrt sind derzeit keine zusätzlichen Analysen vorhanden.'));
 overlay.hidden=false;document.body.classList.add('sr68-detail-open');
 $('sr68Back')?.focus({preventScroll:true});
}
function init(){
 const sheet=$('sheet');const scroll=sheet?.querySelector('.sheet-scroll');
 if(!sheet||!scroll||$('sr68DetailView'))return;
 openButton=el('button','sr68-open','Analysen & weitere Details');
 openButton.type='button';openButton.id='sr68Open';openButton.setAttribute('aria-controls','sr68DetailView');openButton.addEventListener('click',open);
 const schedule=$('scheduleSection');
 if(schedule)scroll.insertBefore(openButton,schedule);else scroll.append(openButton);
 overlay=el('section','sr68-detail');overlay.id='sr68DetailView';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Erweiterte Fahrzeugdetails');
 const head=el('header','sr68-detail-head');
 const back=el('button','sr68-back','‹  Karte');back.type='button';back.id='sr68Back';back.addEventListener('click',close);
 head.append(back,el('strong','','Fahrzeugdetails'));
 content=el('div','sr68-detail-scroll');content.tabIndex=0;
 overlay.append(head,content);document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();close()}});
 document.addEventListener('sr37:selection',()=>{if(active)close()});
 document.addEventListener('sr37:sheet-closed',close);
 const observer=new MutationObserver(()=>{if(active&&!sheet.classList.contains('open'))close()});
 observer.observe(sheet,{attributes:true,attributeFilter:['class']});
 window.SuedtirolRadar68={openDetails:open,closeDetails:close};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
