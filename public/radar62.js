/* Südtirol Radar 6.2 — Train Experience, additive, no feed or map changes. */
import {romeSeconds,dateGTFSValid,trainScheduledPosition} from './radar51-logic.mjs?v=9.9.0';
import {displayDelay} from './radar53-logic.mjs?v=9.9.0';
import {journeyProgress} from './radar56-logic.mjs?v=9.9.0';
(()=>{'use strict';
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
let bridge,frame=0,started=false;
const selected=()=>bridge?.state?.activeSheet==='vehicle'?bridge.state.vehicles?.get(bridge.state.selectedKey):null;
const clock=sec=>{if(!Number.isFinite(Number(sec)))return '–';const n=Number(sec);return String(Math.floor(n/3600)%24).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0')};
function render(){const card=$('sr62Train');if(!card)return;const v=selected();card.replaceChildren();card.hidden=!v||v.kind!=='train';if(card.hidden)return;
 const s=bridge.state,head=node('div','sr62-head');head.append(node('div','sr62-eyebrow','TRAIN TRACKING · 6.6.1'),node('strong','',v.name||'Zugdetails'));card.append(head);
 const facts=node('div','sr62-facts');const delay=displayDelay(v,s);
 const metric=(title,value,description)=>{const b=node('div','sr62-metric');b.append(node('small','',title),node('strong','',value),node('span','',description));facts.append(b)};
 metric('GTFS-RT-Verspätung',delay===null?'Nicht verfügbar':(delay>0?'+':'')+delay+' Min.',delay===null?'Keine aktuelle bestätigte Meldung':'Frische Trip-Update-Daten');
 const quality= v.stale?'Letzte bekannte Position':(v.source?'Feed: '+String(v.source).toUpperCase():'Quelle unbekannt');
 let compare=null;try{compare=trainScheduledPosition(v,s.indexes,s.details,s.shapes)}catch{}
 metric('Ist ↔ Soll',compare&&Number.isFinite(compare.differenceKm)?'≈ '+compare.differenceKm.toFixed(1)+' km':'Nicht verfügbar',compare?'Abstand zur planmäßigen Position':'Keine belastbare Vergleichsposition');
 const age=Number.isFinite(v.timestamp)?Math.max(0,Math.floor(Date.now()/1000-v.timestamp)):null;
 metric('Positionsalter',age===null?'Unbekannt':age+' Sek.',v.stale?'Nicht live':'Letzte empfangene Meldung');
 const route=bridge.routeMatchFor?.(v);metric('Streckenabgleich',route?.path?'GTFS zugeordnet':'Nicht bestätigt',route?.path?'Zulässige Streckengeometrie':'Letzte gemeldete Koordinate');card.append(facts);
 card.append(node('p','sr62-disclaimer','Ist/Soll-Abstand ist keine Minutenverspätung. Zugpositionen können geschätzt sein; bei fehlenden Daten keine Live-Behauptung. '+quality+'.'));
 // The original vehicle sheet already owns the stop-by-stop GTFS-RT timeline.
 // Keep this panel for non-duplicated train facts only.

}
function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
function init(){if(started)return;bridge=window.SuedtirolRadar37;const sheet=$('sheet'),scroll=sheet?.querySelector('.sheet-scroll');if(!bridge?.state?.map||!scroll)return;started=true;
 const card=node('section','sr62-train');card.id='sr62Train';card.hidden=true;card.setAttribute('aria-label','Zugfahrt und Positionsvergleich');const quality=$('sr56Quality');if(quality)quality.insertAdjacentElement('afterend',card);else scroll.prepend(card);
 document.addEventListener('sr37:selection',queue);document.addEventListener('sr37:sheet-closed',queue);document.addEventListener('sr37:feeds',queue);document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue()});
 queue();window.SuedtirolRadar62={version:'6.5',refresh:queue};
}
document.addEventListener('sr37:ready',init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();let n=0;const t=setInterval(()=>{if(started||++n>50){clearInterval(t);return}init()},200);
})();
