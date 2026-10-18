/* Südtirol Radar 4.6 — Live Quality & Focus.
 * Optional enhancement to stable 4.5.2, no module imports or new map renderer.
 * Does not predict, modify or invent vehicle positions, routes or delays.
 */
(function(root){
 'use strict';
 const Utils={
  quality(v,nowMs=Date.now()){
   const stamp=Number(v?.timestamp);
   if(!Number.isFinite(stamp)||stamp<1000000000)return {kind:v?.stale?'stale':'unknown',age:null};
   const age=Math.floor(nowMs/1000-stamp);
   if(age < -30)return {kind:'unknown',age:null};
   return {kind:v?.stale||age>300?'stale':'current',age:Math.max(0,age)};
  },
  medianCadence(samples){
   if(!Array.isArray(samples)||samples.length<2)return null;
   const intervals=[];
   for(let i=1;i<samples.length;i++){
    const dt=samples[i]-samples[i-1];
    if(Number.isFinite(dt)&&dt>=2&&dt<=180)intervals.push(dt);
   }
   if(!intervals.length)return null;
   intervals.sort((a,b)=>a-b);
   return Math.round(intervals[Math.floor(intervals.length/2)]);
  },
  movementLabel(v,match,track){
   if(v?.kind!=='bus')return 'Zugposition aus Feed';
   if(!match?.path)return 'Nur gemeldete Position';
   return track?.samples?.length>=2?'Straßenanimation · leicht verzögert':'Straßenroute geprüft · zweite Meldung fehlt';
  },
  parseKey(search){
   const key=new URLSearchParams(search||'').get('vehicle')||'';
   return /^(sta|trentino|trains):[A-Za-z0-9._:-]{1,128}$/.test(key)?key:null;
  },
  shareUrl(href,key){
   if(!Utils.parseKey('?vehicle='+encodeURIComponent(key)))return null;
   const url=new URL(href);url.search='';url.hash='';
   url.searchParams.set('vehicle',key);
   return url.toString();
  },
  ageText(age){
   if(age===null||age===undefined)return 'Positionsalter unbekannt';
   if(age<60)return 'Position vor '+age+' Sek.';
   return 'Position vor '+Math.floor(age/60)+' Min.';
  }
 };
 if(typeof module==='object'&&module.exports)module.exports={radar46:Utils};
 if(!root?.document)return;
 const document=root.document;
 const $=id=>document.getElementById(id);
 const observed=new Map();
 let bridge=null,started=false,focus=false,pendingDeep=Utils.parseKey(root.location.search);
 let focusButton=null,hud=null,flowStatus=null,selectTimer=0,focusTimer=0, lastSelectedKey='';
 const make=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 function captureFeed(){
  if(!bridge)return;
  for(const [key,v] of bridge.state.vehicles){
   const t=Number(v.timestamp);
   if(!Number.isFinite(t)||t<1000000000||v.stale)continue;
   const old=observed.get(key)||[];
   if(!old.length || t>old[old.length-1])observed.set(key,[...old,t].slice(-5));
  }
  if(observed.size>650){
   const active=new Set(bridge.state.vehicles.keys());
   for(const key of observed.keys())if(!active.has(key))observed.delete(key);
  }
 }
 function selected(){
  return bridge?.state?.vehicles.get(bridge.state.selectedKey)||null;
 }
 function focusNow(){
  if(!bridge?.state?.map)return;
  const key=focus?bridge.state.selectedKey:null;
  const pane=bridge.state.map.getPane('markerPane');
  if(!pane)return;
  for(const [id,entry] of bridge.state.markers){
   const el=entry.marker.getElement();
   if(!el)continue;
   el.classList.toggle('sr46-dim',!!key&&id!==key);
   el.classList.toggle('sr46-highlight',!!key&&id===key);
  }
  for(const el of pane.querySelectorAll('.sr43-cluster-icon')){
   el.classList.toggle('sr46-dim',!!key);
  }
  if(focusButton){
   focusButton.setAttribute('aria-pressed',String(!!key));
   focusButton.textContent=key?'◉ Fokus an':'◎ Fokus';
  }
 }
 function queueFocus(){
  clearTimeout(focusTimer);focusTimer=setTimeout(focusNow,210);
 }
 function updateHud(){
  if(!hud||!bridge)return;
  const v=selected();
  const show=!!v&&!!$('sheet')?.classList.contains('open');
  hud.hidden=!show;
  const actions=$('sr46Actions');if(actions)actions.hidden=!show;
  if(!show){focus=false;queueFocus();return;}
  const quality=Utils.quality(v);
  const track=v.kind==='bus'?bridge.state.busTracks?.get(v.key):null;
  const match=v.kind==='bus'?bridge.routeMatchFor?.(v):null;
  const cadence=Utils.medianCadence(observed.get(v.key));
  const fresh=quality.kind==='current';
  hud.className='sr46-quality '+(fresh?'live':'not-live');
  const line1=fresh?'● Meldung aktuell':quality.kind==='stale'?'◷ NICHT LIVE':'◷ Zeit unbekannt';
  const line2=Utils.ageText(quality.age);
  let line3=Utils.movementLabel(v,match,track);
  if(v.kind==='bus'&&cadence!==null)line3+=' · Feed ca. '+cadence+' Sek.';
  if(v.kind==='bus'&&track?.samples?.length>=2 && match?.path)line3+=' (Anzeige verzögert)';
  const simulated=/simuliert|geschätzt/i.test(v.positionType||'');
  if(simulated)line3+=' · Position geschätzt';
  hud.replaceChildren(make('strong','',line1),make('span','',line2),make('small','',line3));
  if(flowStatus)flowStatus.textContent=cadence!==null?'Positionsmeldungen meist alle '+cadence+' Sek.':'Positionsintervall noch nicht bekannt';
  if(v.key!==lastSelectedKey){lastSelectedKey=v.key;queueFocus();}
 }
 function centerSelected(){
  const v=selected();if(!v)return;
  const marker=bridge.state.markers.get(v.key)?.marker;
  if(marker)bridge.state.map.panTo(marker.getLatLng(),{animate:true});
 }
 async function shareSelected(){
  const v=selected();if(!v)return;
  const url=Utils.shareUrl(root.location.href,v.key);
  if(!url)return;
  try{
   if(typeof root.navigator.share==='function'){
    await root.navigator.share({title:'Südtirol Radar · '+v.name,url});
   }else if(root.navigator.clipboard?.writeText){
    await root.navigator.clipboard.writeText(url);
    const button=$('sr46Share');if(button){button.textContent='✓ Kopiert';setTimeout(()=>button.textContent='↗ Teilen',1800);}
   }else root.prompt?.('Fahrtlink kopieren:',url);
  }catch(e){if(e?.name!=='AbortError')console.warn('Teilen:',e);}
 }
 function addUI(){
  const heading=$('sheet')?.querySelector('.sheet-heading-main');
  const scroller=$('sheet')?.querySelector('.sheet-scroll');
  if(!heading||!scroller||$('sr46Actions'))return;
  const row=make('div','sr46-actions');row.id='sr46Actions';row.hidden=true;
  const focusBtn=make('button','sr46-action','◎ Fokus');focusBtn.type='button';focusBtn.id='sr46Focus';
  focusBtn.setAttribute('aria-pressed','false');
  focusBtn.onclick=()=>{focus=!focus;focusNow();};focusButton=focusBtn;
  const centerBtn=make('button','sr46-action','⌖ Zentrieren');centerBtn.type='button';centerBtn.onclick=centerSelected;
  const shareBtn=make('button','sr46-action','↗ Teilen');shareBtn.type='button';shareBtn.id='sr46Share';shareBtn.onclick=shareSelected;
  row.append(focusBtn,centerBtn,shareBtn);heading.append(row);
  hud=make('div','sr46-quality');hud.id='sr46Quality';hud.hidden=true;hud.setAttribute('aria-live','polite');
  const delay=$('radar40Delay');if(delay)delay.after(hud);else scroller.prepend(hud);
  const settings=$('radar40Settings');
  if(settings){
   const box=make('div','sr46-settings');
   box.append(make('strong','', 'Radar 4.6 · Live-Qualität'));
   flowStatus=make('small','', 'Warte auf Feedmeldungen …');box.append(flowStatus);
   box.append(make('small','', 'Fokus blendet andere Fahrzeuge ab. Die Position wird nicht vorhergesagt. Fahrtlinks funktionieren, solange das Fahrzeug im Feed vorhanden ist.'));
   settings.append(box);
  }
 }
 function tryDeepLink(){
  if(!pendingDeep||!bridge?.state)return;
  const entry=bridge.state.markers.get(pendingDeep);
  if(!entry)return;
  pendingDeep=null;
  entry.marker.fire('click');
  const sheet=$('sheet');if(sheet)sheet.classList.add('open');
 }
 function refresh(){captureFeed();updateHud();queueFocus();tryDeepLink();}
 function start(){
  if(started)return;
  bridge=root.SuedtirolRadar37;
  if(!bridge?.state?.map)return;
  started=true;
  addUI();
  const version=document.querySelector('.brand-title em');if(version)version.textContent='4.6';
  document.title='Südtirol Radar 4.6 · Züge & Busse';
  const settingsHeading=$('radar40Settings')?.querySelector('.sr40-settings-head strong');
  if(settingsHeading)settingsHeading.textContent='Radar 4.6 · Einstellungen';
  for(const e of ['sr37:feeds','sr37:selection','sr37:shapes','sr37:sheet-closed'])document.addEventListener(e,refresh);
  bridge.state.map.on('zoomend',queueFocus);
  bridge.state.map.on('moveend',queueFocus);
  const pane=bridge.state.map.getPane('markerPane');
  if(pane)new MutationObserver(queueFocus).observe(pane,{childList:true,subtree:true});
  // Only update textual age while the sheet is visible; no extra network calls.
  setInterval(()=>{if(!document.hidden && $('sheet')?.classList.contains('open'))updateHud();},10000);
  refresh();
  root.SuedtirolRadar46={version:'4.6',quality:Utils.quality,refresh,focus:()=>focusNow()};
 }
 document.addEventListener('sr37:ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})(typeof window==='undefined'?null:window);
