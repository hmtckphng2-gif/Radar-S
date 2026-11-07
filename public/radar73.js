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
  // Compact the entire vehicle header and its quick actions while the details scroll.
  const compact=scroll.scrollTop>14;
  sheet.classList.toggle('sr73-compact',compact);
  const vehicle=window.SuedtirolRadar37?.state?.vehicles?.get(window.SuedtirolRadar37?.state?.selectedKey);
  sheet.classList.toggle('sr73-train-sheet',vehicle?.kind==='train');
 }
 function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(tidy)}
 function init(){const sheet=$('sheet');if(!sheet)return;
  observer=new MutationObserver(queue);observer.observe(sheet,{childList:true,subtree:true});
  const scroll=sheet.querySelector('.sheet-scroll');scroll?.addEventListener('scroll',()=>{const compact=scroll.scrollTop>14;sheet.classList.toggle('sr73-compact',compact);const v=window.SuedtirolRadar37?.state?.vehicles?.get(window.SuedtirolRadar37?.state?.selectedKey);sheet.classList.toggle('sr73-train-sheet',v?.kind==='train')},{passive:true});
  document.addEventListener('sr37:selection',queue);document.addEventListener('sr37:feeds',queue);
  queue();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
