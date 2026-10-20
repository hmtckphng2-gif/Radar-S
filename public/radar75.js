/* Radar 7.5 – live UI stabilization, no changes to vehicle coordinates. */
(()=>{'use strict';
 function init(){
  document.title='Südtirol Radar 7.5';const badge=document.querySelector('.brand-title em');if(badge)badge.textContent='7.5';
  const sheet=document.getElementById('sheet');
  if(sheet){const content=sheet.querySelector('.sheet-scroll');if(content){for(const ev of ['touchstart','touchmove','wheel'])content.addEventListener(ev,e=>e.stopPropagation(),{passive:true});}}
  // Ground station trends in stored forecast history, never claim observed arrivals.
  let stationSeq=0;
  document.addEventListener('sr75:station-selected',async event=>{
   const stopId=event.detail?.stopId;if(!stopId)return;
   const host=document.getElementById('stationBoard');if(!host)return;
   let card=document.getElementById('sr75StationHistory');if(!card){card=document.createElement('section');card.id='sr75StationHistory';card.className='sr75-station-history';host.append(card)}
   const seq=++stationSeq;card.replaceChildren();
   const heading=document.createElement('strong');heading.textContent='Bahnhofshistorie · letzte 48 Stunden';
   const line=document.createElement('p');line.textContent='Historische Feed-Prognosen werden geladen …';card.append(heading,line);
   try{const response=await fetch('/api/history/analytics?stop='+encodeURIComponent(stopId)+'&hours=48');if(!response.ok)throw Error('not available');const data=await response.json();if(seq!==stationSeq)return;
    line.textContent=data.sampleCount?`${data.sampleCount} Meldungen · Ø ${data.averageMinutes} Min. · Median ${data.medianMinutes} Min. · ${data.latePercent}% über +1 Min.`:'Noch keine gespeicherten Verspätungsprognosen.';
    const note=document.createElement('small');note.textContent='Feed-Prognosen, keine bestätigten Ankunftszeiten.';card.append(note);
   }catch{if(seq===stationSeq)line.textContent='Bahnhofshistorie derzeit nicht verfügbar.'}
  });
  // Update the old menu description without removing its existing actions.
  const menu=document.getElementById('sr60Pop');if(menu){const old=[...menu.querySelectorAll('small')].find(n=>/Radar 6\.5/.test(n.textContent||''));if(old)old.textContent='Interaktive Einführung für Radar 7.5';}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
