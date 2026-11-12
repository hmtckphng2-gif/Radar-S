/* Radar 10.0.4 — compact state follows only the vehicle sheet scroll. */
(()=>{'use strict';
 const update=()=>{
  const sheet=document.getElementById('sheet');
  if(sheet){const content=sheet.querySelector('.sheet-scroll');const scrolled=!!content&&content.scrollTop>24;sheet.classList.toggle('sr94-sheet-scrolled',scrolled);content?.classList.toggle('sr94-sheet-scrolled',scrolled);}
  const pageScrolled=[...document.querySelectorAll('.sr70-home,.sr70-more,.lines-body,.station-results')].some(el=>el.scrollTop>28);
  document.body.classList.toggle('sr94-scrolled',pageScrolled);
 };
 document.addEventListener('scroll',update,true);
  document.addEventListener('DOMContentLoaded',()=>{const content=document.querySelector('#sheet .sheet-scroll');content?.addEventListener('scroll',update,{passive:true});},{once:true});
 document.addEventListener('DOMContentLoaded',update,{once:true});
 const observer=new MutationObserver(update);
 const start=()=>{const sheet=document.getElementById('sheet');if(sheet)observer.observe(sheet,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
