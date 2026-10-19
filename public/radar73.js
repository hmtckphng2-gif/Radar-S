/* Radar 7.3 presentation organizer; does not alter GTFS, positions, or predictions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 let observer=null,scheduled=false;
 function tidy(){
  scheduled=false;
  const sheet=$('sheet');if(!sheet||!sheet.classList.contains('open'))return;
  const scroll=sheet.querySelector('.sheet-scroll');if(!scroll)return;
  // Keep one visible progress card in the map panel. Full analytics remain in More.
  const cards=[...scroll.querySelectorAll('.sr47-card, .sr47-progress-card, #sr47ProgressCard, #sr47JourneyProgress')];
  for(const card of cards){
   if(/Fahrt.Fortschritt/i.test(card.textContent||'')&&!card.classList.contains('sr73-duplicate-progress'))card.classList.add('sr73-duplicate-progress');
  }
  let note=$('sr73PositionNote');
  if(!note){note=document.createElement('p');note.id='sr73PositionNote';note.className='sr73-data-note';const compare=$('sr51TrainCompare');if(compare)compare.insertAdjacentElement('afterend',note);else scroll.prepend(note)}
  const vehicle=window.SuedtirolRadar37?.state?.vehicles?.get(window.SuedtirolRadar37?.state?.selectedKey);
  if(vehicle?.kind!=='train'){note.hidden=true;return}
  if(note.hidden)note.hidden=false;
  const explanation='Ist/Soll ist eine räumliche Fahrplanabweichung, keine gemessene Minutenverspätung. GTFS-RT-Meldungen und geschätzte Fahrzeugpositionen werden getrennt ausgewertet.';
  if(note.textContent!==explanation)note.textContent=explanation;
 }
 function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(tidy)}
 function init(){const sheet=$('sheet');if(!sheet)return;
  observer=new MutationObserver(queue);observer.observe(sheet,{childList:true,subtree:true});
  document.addEventListener('sr37:selection',queue);document.addEventListener('sr37:feeds',queue);
  const badge=document.querySelector('.brand-title em');if(badge)badge.textContent='7.3';document.title='Südtirol Radar 7.3';queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
