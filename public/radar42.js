/* Südtirol Radar 4.2 — three-position iPhone sheet.
 * Only presentation changes: the existing map, feed parser and selections stay intact.
 */
(() => {
  'use strict';
  let started=false;
  const $=id=>document.getElementById(id);
  const snaps=['peek','half','full'];
  function heightFor(state){
    const h=window.visualViewport?.height||window.innerHeight;
    const top=window.visualViewport?.offsetTop||0;
    // Keep the Radar header visible even at the tallest sheet snap.
    const max=Math.max(260,Math.min(780,h-top-168));
    const min=Math.min(170,max*.42);
    return state==='peek'?min:state==='half'?Math.min(max-30,Math.max(min+120,h*.51)):max;
  }
  function setSnap(sheet,next){
    if(!snaps.includes(next))return;
    sheet.dataset.sr42Snap=next;
    sheet.style.setProperty('--sr42-height',Math.round(heightFor(next))+'px');
    sheet.style.removeProperty('height');
    const grip=sheet.querySelector('.sr42-grip');
    if(grip){
      grip.setAttribute('aria-label',next==='peek'?'Details nach oben ziehen':'Detailfenster nach oben oder unten ziehen');
      grip.setAttribute('aria-valuetext',next==='peek'?'Minimiert':next==='half'?'Halb geöffnet':'Voll geöffnet');
    }
    const mini=sheet.querySelector('.sr42-minimize');
    if(mini){mini.textContent=next==='peek'?'⌃':'⌄';mini.setAttribute('aria-label',next==='peek'?'Details aufklappen':'Details minimieren');}
    if(next==='peek' && document.activeElement?.closest('.sheet-scroll'))grip?.focus({preventScroll:true});
  }
  function setupSheet(sheet){
    if(!sheet||sheet.classList.contains('sr42-sheet'))return;
    sheet.classList.add('sr42-sheet');
    const handle=sheet.querySelector('.handle');
    const grip=document.createElement('button');
    grip.type='button';grip.className='sr42-grip';grip.setAttribute('aria-label','Detailfenster verschieben');
    if(handle)grip.append(handle);
    sheet.prepend(grip);
    const heading=sheet.querySelector('.sheet-heading');
    const mini=document.createElement('button');mini.type='button';mini.className='sr42-minimize';
    mini.textContent='⌄'; mini.setAttribute('aria-label','Details minimieren');
    mini.addEventListener('click',event=>{
      event.stopPropagation();setSnap(sheet,sheet.dataset.sr42Snap==='peek'?'half':'peek');
    });
    heading?.querySelector('.close')?.before(mini);
    setSnap(sheet,'full');
    let drag=null;
    function down(e){
      if(!sheet.classList.contains('open')||e.button>0||e.isPrimary===false)return;
      if(e.target.closest('button') && !e.target.closest('.sr42-grip'))return;
      drag={y:e.clientY,height:sheet.getBoundingClientRect().height,time:performance.now(),moved:false};
      sheet.classList.add('sr42-dragging');
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    function move(e){
      if(!drag)return;
      const dy=e.clientY-drag.y;
      if(Math.abs(dy)>5)drag.moved=true;
      if(!drag.moved)return;
      if(e.cancelable)e.preventDefault();
      const low=heightFor('peek'),high=heightFor('full');
      const value=Math.max(low,Math.min(high,drag.height-dy));
      sheet.style.setProperty('--sr42-height',Math.round(value)+'px');
    }
    function up(e){
      if(!drag)return;
      const last=drag; drag=null;
      sheet.classList.remove('sr42-dragging');
      const dy=e.clientY-last.y;
      if(!last.moved){
        const current=sheet.dataset.sr42Snap;
        setSnap(sheet,current==='full'?'half':current==='half'?'peek':'half');
        return;
      }
      const effective=Math.max(heightFor('peek'),Math.min(heightFor('full'),last.height-dy));
      const nearest=snaps.reduce((best,s)=>Math.abs(heightFor(s)-effective)<Math.abs(heightFor(best)-effective)?s:best,'half');
      const elapsed=Math.max(1,performance.now()-last.time);
      const velocity=dy/elapsed;
      let next=nearest;
      if(Math.abs(velocity)>.85){
        if(velocity>0)next=effective<heightFor('half')?'peek':'half';
        else next=effective>heightFor('half')?'full':'half';
      }
      setSnap(sheet,next);
    }
    for(const target of [grip,heading].filter(Boolean)){
      target.addEventListener('pointerdown',down);
      target.addEventListener('pointermove',move);
      target.addEventListener('pointerup',up);
      target.addEventListener('pointercancel',()=>{
        if(drag){drag=null;sheet.classList.remove('sr42-dragging');setSnap(sheet,sheet.dataset.sr42Snap||'half');}
      });
    }
    grip.addEventListener('keydown',e=>{
      const current=snaps.indexOf(sheet.dataset.sr42Snap);
      if(e.key==='ArrowUp'){e.preventDefault();setSnap(sheet,snaps[Math.min(2,current+1)]);}
      if(e.key==='ArrowDown'){e.preventDefault();setSnap(sheet,snaps[Math.max(0,current-1)]);}
    });
    new MutationObserver(()=>{
      if(sheet.classList.contains('open') && !sheet.dataset.sr42WasOpen){
        sheet.dataset.sr42WasOpen='yes';
        setSnap(sheet,'half');
      }else if(!sheet.classList.contains('open')){
        delete sheet.dataset.sr42WasOpen;
      }
    }).observe(sheet,{attributes:true,attributeFilter:['class']});
  }
  function start(){
    if(started || !window.SuedtirolRadar37?.state?.map)return;
    started=true;
    setupSheet($('sheet'));setupSheet($('stationSheet'));
    // Map remains touchable outside the sheet (no dark intercepting scrim).
    document.documentElement.classList.add('sr42-ready');
    const mapEl=$('map'),map=window.SuedtirolRadar37.state.map;
    const updateZoom=()=>{
      if(!mapEl || typeof map.getZoom!=='function')return;
      const z=map.getZoom();
      mapEl.classList.toggle('sr42-far',z<=9);
      mapEl.classList.toggle('sr42-medium',z>9 && z<=12);
    };
    map.on?.('zoomend',updateZoom);updateZoom();
    document.addEventListener('sr37:selection',()=>setSnap($('sheet'),'half'));
    window.addEventListener('resize',()=>{
      for(const id of ['sheet','stationSheet']){const sheet=$(id);if(sheet?.classList.contains('open'))setSnap(sheet,sheet.dataset.sr42Snap||'half');}
    },{passive:true});
    document.querySelector('.brand-title em')?.replaceChildren(document.createTextNode('4.2'));
    document.title='Südtirol Radar 4.2 · Züge & Busse';
  }
  document.addEventListener('sr37:ready',start);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
