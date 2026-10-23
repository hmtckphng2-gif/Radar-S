/* Südtirol Radar 4.4 — optional UI enhancement over stable 4.3.1.
 * Uses the SAME OSM basemap (no CARTO request, no tile API key).
 * Keeps all vehicle markers, source parsing and Leaflet instance intact.
 */
import {normalizeMode,networkLabel} from './radar44-logic.mjs?v=9.9.0';
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let started=false,bridge=null,map=null,mode='radar';
 try{mode=normalizeMode(localStorage.getItem('sr44-map-mode'));}catch{}
 function make(tag,className,content){const el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;return el;}
 function applyMode(){
  document.documentElement.classList.toggle('sr44-radar',mode==='radar');
  document.documentElement.classList.toggle('sr44-classic',mode==='classic');
  const el=$('sr44Mode');if(el){
   for(const b of el.querySelectorAll('button')){
    const selected=b.dataset.mode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
   }
  }
 }
 function setMode(value){
  mode=normalizeMode(value);
  try{localStorage.setItem('sr44-map-mode',mode);}catch{}
  applyMode();
  document.dispatchEvent(new CustomEvent('sr44:mode',{detail:{mode}}));
 }
 function installMode(){
  let panel=$('radar40Settings');if(!panel)return;
  const title=panel.querySelector('.sr40-settings-head strong');if(title)title.textContent='Radar 4.4 · Einstellungen';
  if($('sr44Mode'))return;
  const section=make('div','sr44-mode');section.id='sr44Mode';
  section.append(make('strong','sr44-mode-title','Kartenansicht'));
  const tabs=make('div','sr44-mode-tabs');
  for(const [value,label] of [['radar','◉ Radar'],['classic','▦ Classic']]){
   const btn=make('button','',label);btn.type='button';btn.dataset.mode=value;
   btn.onclick=()=>setMode(value);tabs.append(btn);
  }
  section.append(tabs);
  section.append(make('small','',
   'Radar 4.5.1 verwendet eine synchronisierte dunkle OpenFreeMap-Karte ohne API-Key. Bei Ladeproblemen bleibt Classic nutzbar.'));
  const firstRow=panel.querySelector('.sr40-setting-row');
  if(firstRow)firstRow.before(section);else panel.append(section);
  // The old 4.3 "clean" switch affects only Classic; avoid two conflicting modes.
  const old=$('sr43CleanToggle')?.closest('label');if(old)old.hidden=true;
  panel.append(make('p','sr40-muted',
   'Busbewegung: zeitverzögerte Wiedergabe nur zwischen bestätigten Positionen auf passenden GTFS-Strecken. Ohne verifizierte Straße nur echte Feedpunkte.'));
  applyMode();
 }
 function applyZoom(){
  if(!map)return;
  const zoom=map.getZoom();
  const root=document.documentElement;
  root.classList.toggle('sr44-far',zoom<=11);
  root.classList.toggle('sr44-city',zoom>=12&&zoom<=13);
  root.classList.toggle('sr44-near',zoom>=14);
 }
 function installConnection(){
  if($('sr44Connection'))return;
  const box=make('div','sr44-connection');box.id='sr44Connection';
  box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.hidden=true;
  document.body.append(box);
  const update=()=>{
   const seen=bridge?.state?.lastSuccess||{};
   const latest=Math.max(0,...['sta','trentino','trains'].map(s=>Number(seen[s])||0));
   const age=latest ? (Date.now()-latest)/1000 : 0;
   const msg=networkLabel({online:navigator.onLine!==false,age});
   box.hidden=!msg;
   if(msg)box.textContent='◷ '+msg+' · Positionen nicht fortschreiben';
  };
  window.addEventListener('online',update,{passive:true});
  window.addEventListener('offline',update,{passive:true});
  document.addEventListener('sr37:feeds',update);
  setInterval(update,12000);
  update();
 }
 function enhanceSheet(){
  const mini=$('sr43Mini');if(!mini||mini.dataset.sr44)return;
  mini.dataset.sr44='true';mini.setAttribute('role','button');mini.tabIndex=0;
  mini.setAttribute('aria-label','Fahrtinformationen aufklappen');
  const reveal=()=>{
   const sheet=$('sheet');if(sheet?.dataset.sr42Snap==='peek')sheet.querySelector('.sr42-minimize')?.click();
  };
  mini.addEventListener('click',reveal);
  mini.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal();}});
 }
 function start(){
  if(started)return;
  bridge=window.SuedtirolRadar37;map=bridge?.state?.map;
  if(!map||!window.L)return;
  started=true;
  installMode();installConnection();enhanceSheet();
  map.on('zoomend',applyZoom);applyZoom();applyMode();
  window.SuedtirolRadar44={version:'4.5',setMode,getMode:()=>mode,updateConnection:()=>document.dispatchEvent(new Event('sr37:feeds'))};
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
