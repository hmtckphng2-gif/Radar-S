import {findStations,romeDay,romeSeconds} from './radar51-logic.mjs?v=9.9.0';
import {findItineraries} from './radar692-journey.mjs?v=9.9.0';
(()=>{'use strict';const $=id=>document.getElementById(id),el=(t,c,s)=>{const x=document.createElement(t);if(c)x.className=c;if(s!==undefined)x.textContent=s;return x};
let bridge,stations=[],chosen={a:null,b:null},fields={},out;const fmt=v=>String(Math.floor(v/3600)%24).padStart(2,'0')+':'+String(Math.floor(v%3600/60)).padStart(2,'0');
function field(k,title){const box=el('label','sr692-field'),input=el('input'),items=el('div','sr692-options');input.type='search';input.autocomplete='off';input.placeholder=title+' wählen';items.hidden=true;fields[k]={input,items};box.append(el('span','',title),input,items);
input.oninput=()=>{chosen[k]=null;items.replaceChildren();const q=input.value.trim();if(q.length<2){items.hidden=true;return;}for(const s of findStations(stations,q,7)){const btn=el('button','',s.name+' · '+s.source.toUpperCase());btn.type='button';btn.onclick=()=>{chosen[k]=s;input.value=s.name;items.hidden=true;input.blur()};items.append(btn)}items.hidden=!items.children.length;};return box;}
function run(){out.replaceChildren();const a=chosen.a,b=chosen.b;if(!a||!b){out.append(el('p','sr692-note','Bitte Start und Ziel aus den Vorschlägen auswählen.'));return;}
if(a.source!==b.source){out.append(el('p','sr692-note','Quellenübergreifende Verbindungssuche ist noch nicht zuverlässig verfügbar. Wähle Haltestellen derselben GTFS-Quelle.'));return;}
const state=bridge.state,db=state.indexes[a.source],details=state.details[a.source];
if(!db?.meta?.days?.includes(romeDay())){out.append(el('p','sr692-note','Für heute liegt kein gültiger Fahrplan dieser Quelle vor.'));return;}
const data=findItineraries({index:db,details,origin:a.stopId,destination:b.stopId,nowSeconds:romeSeconds()});
if(!data.results.length){out.append(el('p','sr692-note',data.reason));return;}
out.append(el('p','sr692-note','Fahrplanbasierte Verbindungsvorschläge. Echtzeit-Anschlussgarantie nicht verfügbar.'));
for(const trip of data.results){const card=el('article','sr692-result');card.append(el('strong','',fmt(trip.dep)+' → '+fmt(trip.arr)),el('small','',trip.legs.length===1?'Direkt':'1 Umstieg'));
for(let i=0;i<trip.legs.length;i++){const l=trip.legs[i];card.append(el('div','sr692-leg',l.name+' · '+fmt(l.dep)+' – '+fmt(l.arr)+(i===0&&trip.transfer?' · '+(details.stops?.[trip.transfer]?.[0]||'Umstieg'):'')));}
if(trip.margin!=null)card.append(el('p','sr692-margin','Umsteigezeit laut Fahrplan: '+Math.floor(trip.margin/60)+' Min. · rechnerisch erreichbar, nicht live bestätigt'));out.append(card);}}
function init(){bridge=window.SuedtirolRadar37;const view=$('sr50StatsView');if(!bridge?.getStationList||!view){setTimeout(init,250);return;}if($('sr692Planner'))return;
const old=view.querySelector('.sr50-dashboard'),head=view.querySelector('.sr50-header');if(!old)return;if(head)head.hidden=true;view.setAttribute('aria-label','Verbindungen');
const panel=el('section','sr692-planner');panel.id='sr692Planner';panel.append(el('p','sr692-overline','SÜDTIROL RADAR · VERBINDUNGEN'),el('h1','','Verbindung suchen'),el('p','sr692-note','Abfahrtsstation, Zielstation und mögliche Umstiege im heutigen Fahrplan prüfen.'),field('a','Abfahrt'),field('b','Ankunft'));
const buttons=el('div','sr692-actions'),swap=el('button','','↕ Tauschen'),go=el('button','','Verbindungen finden');swap.type=go.type='button';swap.onclick=()=>{[chosen.a,chosen.b]=[chosen.b,chosen.a];[fields.a.input.value,fields.b.input.value]=[fields.b.input.value,fields.a.input.value]};go.onclick=run;buttons.append(swap,go);panel.append(buttons);out=el('div','sr692-results');out.setAttribute('aria-live','polite');panel.append(out);
const legacy=el('details','sr692-legacy');legacy.append(el('summary','','Weitere Werkzeuge · Statistik & Analysen'),old);view.prepend(panel);view.append(legacy);
for(const nav of document.querySelectorAll('[data-nova-tab="stats"],[data-tab="stats"]')){const label=nav.querySelector('span:last-child');if(label)label.textContent='Verbindungen';nav.setAttribute('aria-label','Verbindungen');}
const svg=document.querySelector('[data-nova-tab="stats"] svg');if(svg)svg.innerHTML='<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 3 3v7M15 16H8a3 3 0 0 1-3-3V9"/>';
document.body.classList.add('sr692-ready');bridge.getStationList().then(s=>{stations=Array.isArray(s)?s:[]}).catch(()=>out.append(el('p','sr692-note','Stationen konnten nicht geladen werden.')));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();