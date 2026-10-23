/* Südtirol Radar 5.3 – progressive UI enhancements, no feed or map-engine changes. */
import {displayDelay,delayPill} from './radar53-logic.mjs?v=9.9.0';
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
let booted=false,bridge=null,refreshTimer=0,menu=null,more=null;
const selected=()=>bridge?.state?.activeSheet==='vehicle'?bridge.state.vehicles.get(bridge.state.selectedKey):null;
function setupTitle(){
 const h=$('sheetTitle');if(!h||$('sr53DelayPill'))return;
 const title=mk('div','sr53-title-line');h.parentNode.insertBefore(title,h);title.append(h);
 const pill=mk('span','sr53-delay-pill','');pill.id='sr53DelayPill';pill.hidden=true;title.append(pill);
}
function setupActions(){
 const bar=$('sr46Actions');if(!bar||$('sr53More'))return;
 const focus=$('sr46Focus');if(focus)focus.textContent='◎ Verfolgen';
 const others=[...bar.querySelectorAll('button')].filter(b=>b!==focus);
 more=mk('button','sr46-action sr53-more','⋯ Mehr');more.type='button';more.id='sr53More';more.setAttribute('aria-expanded','false');more.setAttribute('aria-label','Weitere Fahrzeugaktionen');
 menu=mk('div','sr53-action-menu');menu.id='sr53ActionMenu';menu.hidden=true;
 for(const b of others){menu.append(b);b.addEventListener('click',closeMenu)}
 const tools=mk('div','sr53-action-wrap');tools.append(more,menu);bar.append(tools);
 more.addEventListener('click',e=>{e.stopPropagation();menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden))});
 document.addEventListener('click',e=>{if(menu&&!menu.hidden&&!tools.contains(e.target))closeMenu()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
 const extra=mk('button','sr46-action sr53-extra','Details ▾');extra.id='sr53Expand';extra.type='button';
 extra.setAttribute('aria-expanded','false');
 extra.addEventListener('click',()=>{const isOpen=$('sheet').classList.toggle('sr53-expanded');extra.textContent=isOpen?'Details ▴':'Details ▾';extra.setAttribute('aria-expanded',String(isOpen))});
 bar.append(extra);
}
function closeMenu(){if(menu)menu.hidden=true;if(more)more.setAttribute('aria-expanded','false')}
function refresh(){
 const v=selected();const pill=$('sr53DelayPill');if(!pill)return;
 pill.hidden=!v;if(!v)return;
 const min=displayDelay(v,bridge.state);
 pill.textContent=min===null?'◷ Kein Live-Delay':min>0?'◷ '+delayPill(min):min<0?'◷ '+delayPill(min):'✓ Pünktlich';
 pill.className='sr53-delay-pill '+(min===null?'unknown':min>0?'late':min<0?'early':'ontime');
 pill.title=min===null?'Keine frische, passend zugeordnete GTFS-RT-Verspätung':'Frische, zur Fahrt passende GTFS-RT-Verspätung';
 const cmp=$('sr51TrainCompare');if(cmp&&!cmp.hidden){
  const km=cmp.querySelector('.sr51-gap');let approx=$('sr53ApproxDelay');
  if(km&&!approx){approx=mk('span','sr53-approx');approx.id='sr53ApproxDelay';km.after(approx)}
  if(approx){approx.textContent=min===null?'Zeitverspätung: keine bestätigte Meldung':`${delayPill(min)} gemeldet`;
   approx.className='sr53-approx '+(min===null?'missing':'known');
   approx.title='Nicht aus den Kilometern berechnet. Diese Zahl stammt aus einer passenden Echtzeitmeldung.'}
  const labels=cmp.querySelector('.sr51-cmp-line');if(labels)labels.textContent='● Feedposition     ● Soll laut Fahrplan (Modell)';
 }
}
function queueRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,140)}
function setup(){
 if(booted)return;bridge=window.SuedtirolRadar37;
 if(!bridge?.state?.map||!$('sheetTitle'))return;
 booted=true;setupTitle();
 const tryActions=()=>{setupActions();if(!$('sr53More'))setTimeout(tryActions,200)};
 tryActions();
 document.addEventListener('sr37:selection',()=>{
  $('sheet')?.classList.remove('sr53-expanded');const b=$('sr53Expand');if(b){b.textContent='Details ▾';b.setAttribute('aria-expanded','false')}
  closeMenu();queueRefresh();setTimeout(refresh,500);
 });
 document.addEventListener('sr37:feeds',queueRefresh);
 document.addEventListener('sr37:sheet-closed',()=>{closeMenu();if($('sr53DelayPill'))$('sr53DelayPill').hidden=true});
 new MutationObserver(()=>{if(selected()&&!$('sr53ApproxDelay'))queueRefresh()}).observe($('sr51TrainCompare')||$('sheet'),{childList:true,subtree:false});
 setInterval(()=>{if(!document.hidden&&selected())refresh()},14000);
 refresh();
 window.SuedtirolRadar53={version:'5.3',refresh};
}
document.addEventListener('sr37:ready',setup);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
