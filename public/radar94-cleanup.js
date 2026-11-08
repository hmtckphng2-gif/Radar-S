/* Radar 10.0.4 — compact state follows only the vehicle sheet scroll. */
(()=>{'use strict';
 const update=()=>{
  const sheet=document.getElementById('sheet');
  if(sheet){const content=sheet.querySelector('.sheet-scroll');sheet.classList.toggle('sr94-sheet-scrolled',!!content&&content.scrollTop>18);}
  const pageScrolled=[...document.querySelectorAll('.sr70-home,.sr70-more,.lines-body,.station-results')].some(el=>el.scrollTop>28);
  document.body.classList.toggle('sr94-scrolled',pageScrolled);
 };
 document.addEventListener('scroll',update,true);
 document.addEventListener('DOMContentLoaded',update,{once:true});
 const observer=new MutationObserver(update);
 const start=()=>{const sheet=document.getElementById('sheet');if(sheet)observer.observe(sheet,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
