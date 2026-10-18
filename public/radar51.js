/* Südtirol Radar 5.1 — marker delays, train schedule-position comparison and clean map tools.
 * Additive only: original GTFS feeds, MapLibre/Leaflet synchronization and marker movement stay untouched.
 */
import {busDelayLabel,trainScheduledPosition} from './radar51-logic.mjs';
(function(){
'use strict';
let bridge=null,started=false,comparisonLayer=null,card=null,tools=null,moreBtn=null,noticeExpanded=false,refreshPending=false;
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const button=(label,action)=>{const b=node('button','sr51-menu-item',label);b.type='button';b.addEventListener('click',()=>{closeTools();action()});return b};
const current=()=>bridge?.state?.vehicles?.get(bridge.state.selectedKey)||null;
function closeTools(){if(tools)tools.hidden=true;if(moreBtn)moreBtn.setAttribute('aria-expanded','false')}
function toggleTools(){if(!tools)return;tools.hidden=!tools.hidden;moreBtn?.setAttribute('aria-expanded',String(!tools.hidden))}
function setupTools(){
 const actions=document.querySelector('#sr50MapTab .map-actions');if(!actions)return;
 moreBtn=node('button','round-action sr51-more','⋯');moreBtn.id='sr51MoreBtn';moreBtn.type='button';moreBtn.setAttribute('aria-label','Weitere Kartenfunktionen');moreBtn.setAttribute('aria-expanded','false');moreBtn.onclick=toggleTools;actions.append(moreBtn);
 tools=node('div','sr51-tools');tools.id='sr51Tools';tools.hidden=true;tools.setAttribute('role','group');tools.setAttribute('aria-label','Weitere Kartenfunktionen');
 tools.append(button('▤ Abfahrtsmonitor',()=>window.SuedtirolRadar50?.switchTab('departures')));
 tools.append(button('⌖ Ort auswählen',()=>{$('areaBtn')?.click()}));
 tools.append(button('◧ Kartenstil wechseln',()=>{$('tileBtn')?.click()}));
 tools.append(button('☷ Live-Daten-Diagnose',()=>{$('sr47DiagOpen')?.click()}));
 tools.append(button('◉ Feedstatus',()=>{$('statusBtn')?.click()}));
 tools.append(button('ⓘ Daten- und GPS-Hinweise',()=>{
  const banner=$('notice');if(!banner)return;
  noticeExpanded=Boolean(banner.hidden);banner.classList.toggle('sr51-notice-visible',noticeExpanded);
  banner.hidden=!noticeExpanded;
 }));
 $('sr50MapTab')?.append(tools);
 document.addEventListener('click',e=>{if(tools&&!tools.hidden&&!tools.contains(e.target)&&e.target!==moreBtn)closeTools()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTools()});
 // The provenance hint remains accessible from the menu, but does not cover the map on every visit.
 const banner=$('notice');if(banner){banner.classList.add('sr51-compact-notice');
  const important=/GTFS-Import ausstehend|Fehler beim Start|Keine Echtzeitdaten/i.test(banner.textContent||'');
  banner.hidden=!important;banner.classList.toggle('sr51-notice-visible',important);
 }
}
function updateBusBadges(){
 if(!bridge?.state?.markers)return;
 const s=bridge.state;
 for(const [key,entry] of s.markers){
  const v=s.vehicles.get(key);if(!v||v.kind!=='bus')continue;
  const label=entry?.marker?.getElement?.()?.querySelector?.('.marker-label');if(!label)continue;
  let badge=label.querySelector('.sr51-map-delay');
  const d=busDelayLabel(v,s.updates,s.statuses);
  if(!d){badge?.remove();continue}
  if(!badge){badge=node('span','sr51-map-delay');label.append(badge)}
  badge.className='sr51-map-delay '+(d.minutes>0?'late':d.minutes<0?'early':'ontime');
  badge.textContent=d.label;
  badge.title='GTFS-RT '+(d.basis==='halt'?'am zugeordneten Halt':'Fahrtwert')+' · Aktualisierung unter 2 Minuten';
 }
}
function addCompareVisual(){
 card=node('section','sr51-train-compare');card.id='sr51TrainCompare';card.hidden=true;
 const badges=$('sheetBadges');badges?.insertAdjacentElement('afterend',card);
 if(window.L && bridge?.state?.map){comparisonLayer=L.layerGroup().addTo(bridge.state.map)}
}
function clearComparison(){comparisonLayer?.clearLayers();if(card){card.hidden=true;card.replaceChildren()}}
function progressGraphic(value){
 const path=bridge.state.shapes?.[value.vehicle.source]?.shapes?.[value.vehicle.shapeId];
 const len=Array.isArray(path)?path.reduce((sum,p,i)=>{if(!i)return 0;const a=path[i-1],cos=Math.cos(a[0]*Math.PI/180);return sum+Math.hypot((p[0]-a[0])*111195,(p[1]-a[1])*111195*cos)},0):0;
 if(!len)return null;
 const actual=10+Math.min(1,Math.max(0,value.calculated.observedMeters/len))*80;
 const planned=10+Math.min(1,Math.max(0,value.calculated.plannedMeters/len))*80;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 340 85');svg.setAttribute('role','img');svg.setAttribute('aria-label','Schematischer Vergleich von Feedposition und berechneter Fahrplanposition');
 const mk=(tag,attr,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attr))e.setAttribute(k,v);if(text)e.textContent=text;return e};
 svg.append(mk('line',{x1:'34',y1:'37',x2:'306',y2:'37',stroke:'#355675','stroke-width':'8','stroke-linecap':'round'}));
 const marker=(f,y,col,label)=>{
  svg.append(mk('circle',{cx:String(34+f/100*272),cy:'37',r:'9',fill:col,stroke:'#e8f3ff','stroke-width':'2'}));
  svg.append(mk('text',{x:String(34+f/100*272),y:String(y),'text-anchor':'middle',fill:col,'font-size':'11','font-weight':'700'},label));
 };
 marker(planned,20,'#e8bd72','SOLL');marker(actual,67,'#50e6c6','FEED');
 return svg;
}
function renderComparison(){
 if(!bridge||!card)return;
 clearComparison();
 const v=current();if(!v || v.kind!=='train' || bridge.state.activeSheet!=='vehicle')return;
 const s=bridge.state,calc=trainScheduledPosition(v,s.indexes,s.details,s.shapes);
 card.hidden=false;
 const title=node('div','sr51-train-title','🚆 Position vs. Fahrplan');card.append(title);
 if(!calc){
  card.append(node('p','sr51-quiet','Soll-Position nicht verfügbar: Es fehlen passende heutige GTFS-Haltezeiten, eine bestätigte Zugstrecke oder eine zuordenbare Feedposition. Es wird nichts geraten.'));
  return;
 }
 const visual=progressGraphic({vehicle:v,calculated:calc});if(visual)card.append(visual);
 card.append(node('div','sr51-cmp-line','● Grün: gemeldete Feedposition · ● Gold: fahrplanmäßige Soll-Position (Modell)'));
 const gap=calc.differenceKm;
 card.append(node('strong','sr51-gap',gap===0?'Positionen nahezu gleich':`Rund ${gap.toLocaleString('de-DE')} km ${calc.relative}`));
 card.append(node('small','sr51-quiet',`Zwischen ${calc.from} und ${calc.to}. Sollpunkt linear aus Haltezeiten berechnet; Fahrgeschwindigkeit unterwegs ist nicht exakt bekannt.`));
 const estimated=/simuliert|geschätzt|interpoliert/i.test(v.positionType||'');
 card.append(node('small','sr51-caution',estimated?'Die gemeldete Position ist laut Datenquelle simuliert oder geschätzt – kein bestätigtes GPS.':'Eine Feedposition ist nicht automatisch nachweislich echtes GPS.'));
 card.append(node('p','sr51-quiet','Die Entfernung ist keine zuverlässige Zeitverspätung. Dafür ausschließlich passende GTFS-RT-Meldungen verwenden.'));
 if(!comparisonLayer || !window.L)return;
 const mk=(pos,color,text)=>L.circleMarker([pos.lat,pos.lon],{radius:7,color:'#f0f7ff',weight:2,fillColor:color,fillOpacity:1,interactive:false}).bindTooltip(text,{permanent:true,direction:'top',className:'sr51-map-tooltip'}).addTo(comparisonLayer);
 mk(calc.scheduled,'#e8b668','Soll laut Fahrplan');mk(calc.observed,'#50e6c6','Feedposition');
}
function refresh(){
 if(refreshPending)return;refreshPending=true;
 requestAnimationFrame(()=>{refreshPending=false;updateBusBadges();renderComparison()});
}
function start(){
 if(started)return;bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map || !$('sr50MapTab') || !$('sheet'))return;
 started=true;setupTools();addCompareVisual();refresh();
 document.addEventListener('sr37:feeds',refresh);
 document.addEventListener('sr37:selection',()=>{setTimeout(refresh,10);setTimeout(renderComparison,1800)});
 document.addEventListener('sr37:sheet-closed',clearComparison);
 bridge.state.map.on('zoomend moveend',updateBusBadges);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden){updateBusBadges();if(current()?.kind==='train'&&bridge.state.activeSheet==='vehicle')renderComparison()}},12000);
 window.SuedtirolRadar51={version:'5.1',refresh,clearComparison};
}
document.addEventListener('sr37:ready',start);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
