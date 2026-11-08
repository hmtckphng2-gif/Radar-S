/* Radar 10.0.2 — compact the visible app header after real vertical scrolling. */
(()=>{'use strict';
 const update=()=>{
  const scrollers=[...document.querySelectorAll('.sheet-scroll,.sr70-home,.sr70-more,.lines-body,.station-results')];
  const active=scrollers.some(el=>el.scrollTop>28);
  document.body.classList.toggle('sr94-scrolled',active);
  const sheet=document.getElementById('sheet');
  if(sheet){const content=sheet.querySelector('.sheet-scroll');sheet.classList.toggle('sr94-sheet-scrolled',!!content&&content.scrollTop>24);}
 };
 document.addEventListener('scroll',update,true);
 document.addEventListener('DOMContentLoaded',update,{once:true});
 const observer=new MutationObserver(update);
 const start=()=>{const sheet=document.getElementById('sheet');if(sheet)observer.observe(sheet,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
