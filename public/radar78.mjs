/* Radar 7.8 — additive Live Intelligence, station favorites, vehicle data clarity. */
import {vehicleLiveQuality,sourceHealth,delayDiscrepancy} from './radar78-logic.mjs?v=9.8.0';
(()=>{'use strict';const FAVORITES='sr77-favorite-stations';
 const $=id=>document.getElementById(id);
 const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
 const favorites=()=>{try{return JSON.parse(localStorage.getItem(FAVORITES)||'[]')}catch{return []}};
 const bridge=()=>window.SuedtirolRadar37;
 let lastStation=null,updateQueued=false,lastVehicle='';
 function monitor(){const board=$('stationBoard');if(!board||!lastStation)return;let summary=$('sr78BoardSummary');if(!summary){summary=el('div','sr78-board-summary');summary.id='sr78BoardSummary';const list=$('stationDepartures');list?.insertAdjacentElement('beforebegin',summary)}
  const rows=$('stationDepartures')?.querySelectorAll('.station-result').length||0;summary.textContent=`${rows} Fahrplanabfahrten angezeigt · Echtzeit/Gleis nur bei belegter Datenquelle`;const sub=board.querySelector('.section-sub');if(sub)sub.textContent='Fahrplan (GTFS) · Live-Status und Gleis nur bei verfügbarer offizieller Meldung';
 }
 function favoriteStations(){const search=$('stationResults');if(!search||search.hidden)return;const ids=favorites();let host=$('sr78Favorites');if(!ids.length){host?.remove();return}if(!host){host=el('section','sr78-favorites');host.id='sr78Favorites';search.parentElement.insertBefore(host,search)}host.replaceChildren(el('strong','',`★ Favoriten · ${ids.length}`));const stations=bridge()?.state?.stationList||[];
  for(const stopId of ids.slice(0,12)){const station=stations.find(st=>st.stopId===stopId);if(!station)continue;const b=el('button','sr78-favorite-item',station.name+' ›');b.type='button';b.addEventListener('click',()=>bridge()?.openStationFromMap?.(station));host.append(b)}
 }
 function qualityView(){const state=bridge()?.state;if(!state)return;const selected=state.vehicles?.get(state.selectedKey);const sheet=$('sheet');let quality=$('sr78Quality');
  if(!selected||!sheet?.classList.contains('open')){if(quality)quality.hidden=true;return}if(!quality){quality=el('div','sr78-quality');quality.id='sr78Quality';const target=$('sr51TrainCompare')||sheet.querySelector('.sheet-scroll');target?.insertAdjacentElement('afterend',quality)}
  const q=vehicleLiveQuality(selected);quality.hidden=false;quality.dataset.quality=q.kind;const age=q.age===null||q.age<0?'Zeit unbekannt':q.age<60?`${q.age} Sek.`:`${Math.floor(q.age/60)} Min.`;
  quality.textContent=`${q.label} · Letzte Positionsmeldung: ${age} · ${selected.source?.toUpperCase()||'Quelle unbekannt'}`;
  if(selected.kind==='train'){const compare=$('sr51TrainCompare');if(compare&&!compare.hidden){const gap=compare.querySelector('.sr51-gap');const km=gap?Number((gap.textContent||'').match(/([0-9]+(?:[,.][0-9]+)?)\s*km/)?.[1]?.replace(',','.')):NaN;const d=delayDiscrepancy(km,null);if(d){let note=$('sr78DelayNote');if(!note){note=el('small','sr78-delay-note');note.id='sr78DelayNote';compare.append(note)}note.textContent=d}else $('sr78DelayNote')?.remove()}}
 }
 function feedSummary(){const state=bridge()?.state,head=$('lastUpdate');if(!state||!head)return;let target=$('sr78SourceQuality');if(!target){target=el('span','sr78-feed-health');target.id='sr78SourceQuality';head.insertAdjacentElement('afterend',target)}const counts=Object.values(sourceHealth(state.vehicles?.values?.()||[]));const n=counts.reduce((a,v)=>({current:a.current+v.current,delayed:a.delayed+v.delayed,estimated:a.estimated+v.estimated,last:a.last+v.last}),{current:0,delayed:0,estimated:0,last:0});const failed=Object.entries(state.statuses||{}).filter(([name,status])=>!name.endsWith('_updates')&&!name.endsWith('_alerts')&&status!=='ok').map(([name])=>name);target.textContent=`${n.current} aktuell · ${n.delayed} verzögert · ${n.estimated} geschätzt · ${n.last} nicht live${failed.length?' · Feed gestört: '+failed.join(', '):''}`;target.title='Feedmeldungen, keine GPS-Garantie; letzte bekannte Positionen bleiben auf der Karte.'}
 function render(){updateQueued=false;feedSummary();qualityView();monitor()}
 function queue(){if(updateQueued)return;updateQueued=true;requestAnimationFrame(render)}
 function init(){document.addEventListener('sr37:feeds',queue);document.addEventListener('sr37:selection',()=>{queue();setTimeout(queue,120)});document.addEventListener('sr37:sheet-closed',queue);
  document.addEventListener('sr75:station-selected',e=>{lastStation=e.detail||null;setTimeout(queue,0)});document.addEventListener('sr37:station-board',queue);
  $('stationSearch')?.addEventListener('input',()=>setTimeout(favoriteStations,0));$('stationBtn')?.addEventListener('click',()=>setTimeout(favoriteStations,500));$('backStations')?.addEventListener('click',()=>setTimeout(favoriteStations,0));
  const board=$('stationBoard');if(board){const ob=new MutationObserver(()=>{if(board.hidden)favoriteStations()});ob.observe(board,{attributes:true,attributeFilter:['hidden']})}
  const map=bridge()?.state?.map;if(map){map.on('dragstart',()=>document.body.classList.add('sr78-gesturing'));map.on('dragend',()=>document.body.classList.remove('sr78-gesturing'));map.on('zoomstart',()=>document.body.classList.add('sr78-gesturing'));map.on('zoomend',()=>document.body.classList.remove('sr78-gesturing'))}
  queue();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
