/* Südtirol Radar 6.2 — Train Experience, additive, no feed or map changes. */
import {romeSeconds,dateGTFSValid,trainScheduledPosition} from './radar51-logic.mjs';
import {displayDelay} from './radar53-logic.mjs';
import {journeyProgress} from './radar56-logic.mjs';
(()=>{'use strict';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
let bridge,frame=0,started=false;
const selected=()=>bridge?.state?.activeSheet==='vehicle'?bridge.state.vehicles?.get(bridge.state.selectedKey):null;
const clock=sec=>{if(!Number.isFinite(Number(sec)))return '–';const n=Number(sec);return String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0')};
function render(){const card=$('sr62Train');if(!card)return;const v=selected();card.replaceChildren();card.hidden=!v||v.kind!=='train';if(card.hidden)return;
 const s=bridge.state,head=node('div','sr62-head');head.append(node('div','sr62-eyebrow','TRAIN EXPERIENCE 2.0'),node('strong','',v.name||'Zugdetails'));card.append(head);
 const facts=node('div','sr62-facts');const delay=displayDelay(v,s);
 const metric=(title,value,description)=>{const b=node('div','sr62-metric');b.append(node('small','',title),node('strong','',value),node('span','',description));facts.append(b)};
 metric('GTFS-RT-Verspätung',delay===null?'Nicht verfügbar':(delay>0?'+':'')+delay+' Min.',delay===null?'Keine aktuelle bestätigte Meldung':'Frische Trip-Update-Daten');
 const quality= v.stale?'Letzte bekannte Position':(v.source?'Feed: '+String(v.source).toUpperCase():'Quelle unbekannt');
 let compare=null;try{compare=trainScheduledPosition(v,s.indexes,s.details,s.shapes)}catch{}
 metric('Ist ↔ Soll',compare&&Number.isFinite(compare.differenceKm)?'≈ '+compare.differenceKm+' km':'Nicht verfügbar',compare?'Räumlicher Fahrplanvergleich':'Keine belastbare Vergleichsposition');card.append(facts);
 card.append(node('p','sr62-disclaimer','Ist/Soll-Abstand ist keine Minutenverspätung. Zugpositionen können geschätzt sein; bei fehlenden Daten keine Live-Behauptung. '+quality+'.'));
 const times=s.details?.[v.source]?.times?.[v.tripId];const valid=dateGTFSValid(s.indexes?.[v.source]);
 const section=node('div','sr62-journey');section.append(node('div','sr62-section-title','Fahrtverlauf · Fahrplan'));
 if(!v.tripId||!valid||!Array.isArray(times)||!times.length){section.append(node('p','sr62-empty','Für diese Fahrt liegt kein heute gültiger vollständiger GTFS-Fahrplan vor.'));card.append(section);return}
 const rows=[...times].sort((a,b)=>Number(a[3]||0)-Number(b[3]||0));const progress=journeyProgress(rows,romeSeconds());const passed=progress?.plannedPassed??0;
 const bar=node('div','sr62-progress');const fill=node('div','sr62-progress-fill');fill.style.width=(rows.length>1?Math.round(100*Math.min(rows.length-1,passed)/ (rows.length-1)):0)+'%';bar.append(fill);section.append(bar);
 section.append(node('p','sr62-plan-note',passed+' von '+rows.length+' Halten laut Fahrplanzeit erreicht · kein bestätigter Echtzeitfortschritt'));
 const list=node('ol','sr62-stops');const indexes=new Set([0,rows.length-1]);for(let i=Math.max(0,passed-1);i<=Math.min(rows.length-1,passed+2);i++)indexes.add(i);
 for(const i of [...indexes].sort((a,b)=>a-b)){const row=rows[i],stop=s.details?.[v.source]?.stops?.[String(row[0])],name=stop?.[0]||'Haltestelle unbekannt';const item=node('li','sr62-stop'+(i<passed?' sr62-past':'')+(i===passed?' sr62-next':''));item.append(node('span','sr62-stop-time',clock(row[1]??row[2])),node('span','sr62-stop-name',name),node('small','',i===passed?'Planmäßig nächster Halt':i<passed?'Planmäßig passiert':'Fahrplan'));list.append(item)}section.append(list);
 if(rows.length>indexes.size)section.append(node('p','sr62-plan-note','Weitere '+(rows.length-indexes.size)+' Halte im bestehenden Fahrtverlauf verfügbar.'));
 card.append(section);
}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
function init(){if(started)return;bridge=window.SuedtirolRadar37;const sheet=$('sheet'),scroll=sheet?.querySelector('.sheet-scroll');if(!bridge?.state?.map||!scroll)return;started=true;
 const card=node('section','sr62-train');card.id='sr62Train';card.hidden=true;card.setAttribute('aria-label','Zugfahrt und Positionsvergleich');const quality=$('sr56Quality');if(quality)quality.insertAdjacentElement('afterend',card);else scroll.prepend(card);
 document.addEventListener('sr37:selection',queue);document.addEventListener('sr37:sheet-closed',queue);document.addEventListener('sr37:feeds',queue);document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});
 const brand=document.querySelector('.brand-title em');if(brand)brand.textContent='6.2';document.title='Südtirol Radar 6.2 · Train Experience';queue();window.SuedtirolRadar62={version:'6.2',refresh:queue};
}
document.addEventListener('sr37:ready',init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();let n=0;const t=setInterval(()=>{if(started||++n>50){clearInterval(t);return}init()},200);
})();
