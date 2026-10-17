/* Südtirol Radar 3.6 — additive enhancement for the working Radar 3.5.1.
   Loaded after Leaflet + radar35.js, before the existing app.js.
   Never draws an inferred route when no matching verified GTFS shape exists. */
(() => {
  'use strict';
  if (!window.L) return;
  const $ = id => document.getElementById(id);
  const originalMap = L.map;
  let map = null;
  let trackGroup = null;
  let activeTrip = '';
  let lastAutoFocus = '';
  let requestVersion = 0;
  let userMovedScroll = false;
  let programmaticScroll = false;
  const cache = new Map();

  // Capture Leaflet map without touching app.js or its protected internal state.
  L.map = function (...args) {
    const result = originalMap.apply(this, args);
    if ((args[0] === 'map' || args[0]?.id === 'map') && !map) {
      map = result;
      trackGroup = L.layerGroup().addTo(map);
      trackGroup.on('layeradd', e => {
        if (e.layer.bringToBack) e.layer.bringToBack();
      });
    }
    return result;
  };

  async function json(path, maxAge = 30000) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < maxAge) return hit.value;
    const response = await fetch(path, {cache: 'no-store'});
    if (!response.ok) throw Error(path + ': HTTP ' + response.status);
    const value = await response.json();
    cache.set(path, {at: Date.now(), value});
    return value;
  }
  function detail(label) {
    const row = [...document.querySelectorAll('#details .detail')]
      .find(el => el.querySelector('small')?.textContent.trim() === label);
    return row?.querySelector('strong')?.textContent.trim() || '';
  }
  function currentSelection() {
    if (!$('sheet')?.classList.contains('open')) return null;
    const source = $('sheetKind')?.textContent.match(/\b(STA|TRENTINO|TRAINS)\b/i)?.[1]?.toLowerCase();
    const tripId = detail('Fahrt-ID');
    const vehicleId = detail('Fahrzeug-ID');
    if (!source || !tripId || tripId === 'Nicht verfügbar') return null;
    return {source, tripId, vehicleId, key: source + '|' + tripId + '|' + vehicleId};
  }
  function matchingVehicle(feed, selection) {
    const list = feed?.entity || feed?.entities || [];
    return list.map(item => item?.vehicle || item?.vehiclePosition || item?.vehicle_position)
      .find(v => {
        if (!v) return false;
        const id = String(v.vehicle?.id ?? v.vehicle?.vehicle_id ?? '');
        const trip = String(v.trip?.trip_id ?? v.trip?.tripId ?? '');
        // Match both identifiers when both are present to avoid a wrong vehicle on shared trips.
        return selection.vehicleId && selection.vehicleId !== 'Nicht verfügbar'
          ? id === selection.vehicleId && (!trip || trip === selection.tripId)
          : trip === selection.tripId;
      }) || null;
  }
  function coordinates(vehicle) {
    const p = vehicle?.position;
    const lat = Number(p?.latitude ?? p?.lat);
    const lon = Number(p?.longitude ?? p?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? {lat,lon} : null;
  }
  function projected(path, lat, lon) {
    if (!Array.isArray(path) || path.length < 2) return null;
    const cos = Math.cos(lat * Math.PI / 180);
    let nearest = null;
    for (let i = 1; i < path.length; i++) {
      const a=path[i-1], b=path[i];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const ax=Number(a[1])*cos, ay=Number(a[0]);
      const bx=Number(b[1])*cos, by=Number(b[0]);
      const dx=bx-ax, dy=by-ay, len=dx*dx+dy*dy;
      if (!(len>1e-14)) continue;
      const fraction=Math.max(0,Math.min(1,((lon*cos-ax)*dx+(lat-ay)*dy)/len));
      const distance=Math.hypot(lon*cos-(ax+fraction*dx),lat-(ay+fraction*dy))*111195;
      if (!nearest || distance<nearest.distance) nearest={i,fraction,distance,
        point:[Number(a[0])+(Number(b[0])-Number(a[0]))*fraction,
          Number(a[1])+(Number(b[1])-Number(a[1]))*fraction]};
    }
    return nearest;
  }
  function clearTrack() { if (trackGroup) trackGroup.clearLayers(); }
  function drawTrack(path, location) {
    if (!trackGroup) return false;
    clearTrack();
    if (!Array.isArray(path) || path.length < 2 || path.length > 30000) return false;
    const points = path.filter(p => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
      .map(p => [Number(p[0]), Number(p[1])]);
    if (points.length < 2) return false;
    const project = location && projected(points, location.lat, location.lon);
    // Draw only matched GTFS shapes. Colored progress requires a nearby reported position.
    const confidence = project && project.distance <= 350;
    const past = confidence ? [...points.slice(0, project.i),project.point] : null;
    const future = confidence ? [project.point,...points.slice(project.i)] : points;
    L.polyline(future, {color:'#74d5ff', weight:5, opacity:.85, interactive:false, lineJoin:'round'})
      .addTo(trackGroup);
    if (past && past.length > 1) L.polyline(past, {color:'#3479f6', weight:6, opacity:.95, interactive:false, lineJoin:'round'})
      .addTo(trackGroup);
    if (confidence) L.circleMarker(project.point, {radius:6, color:'#fff', weight:2,
      fillColor:'#ff5c63',fillOpacity:1,interactive:false}).addTo(trackGroup);
    return true;
  }
  function ensureCard() {
    const parent=$('sheetSub')?.parentElement;
    if (!parent) return null;
    let card=$('radar36Card');
    if (!card) {
      card=document.createElement('div');
      card.id='radar36Card';
      card.setAttribute('aria-live','polite');
      parent.appendChild(card);
    }
    return card;
  }
  function setCard(nextStop, planned, delay, age, routeAvailable) {
    const card=ensureCard(); if (!card) return;
    card.replaceChildren();
    const head=document.createElement('strong');
    head.textContent=nextStop ? 'Nächster Halt: ' + nextStop : 'Nächster Halt nicht verifiziert';
    card.appendChild(head);
    const sub=document.createElement('span');
    const bits=[];
    if (planned && planned !== '–') bits.push('Plan ' + planned);
    if (delay && delay !== 'Keine Verspätungsdaten') bits.push(delay);
    if (age && age !== 'Unbekannt') bits.push('Position ' + age + ' alt');
    bits.push(routeAvailable ? 'GTFS-Strecke auf Karte' : 'Keine geprüfte Streckengeometrie');
    sub.textContent=bits.join(' · ');
    card.appendChild(sub);
  }
  function progressElements() {
    const stops=[...document.querySelectorAll('#stops > li.stop')];
    const current=stops.findIndex(el=>el.classList.contains('stop-current'));
    return {stops,current};
  }
  function showProgress() {
    const selection=currentSelection(); if (!selection) return;
    const {stops,current}=progressElements();
    let stopName='', planned='';
    if (current>=0) {
      stopName=stops[current].querySelector('b')?.textContent.trim() || '';
      const atStop=stops[current].querySelector('.stop-position-note')?.textContent.includes('Am Halt');
      if (atStop) stopName += ' (am Halt)';
      planned=stops[current].querySelector('.stop-time')?.textContent.trim() || '';
      const focusKey=selection.key + '|' + stopName;
      if (lastAutoFocus !== focusKey && !userMovedScroll) {
        const scroller=$('sheet')?.querySelector('.sheet-scroll');
        if (scroller) {
          programmaticScroll=true;
          // Keep the current stop below the fixed sheet heading, never force page scrolling.
          const offset=stops[current].getBoundingClientRect().top - scroller.getBoundingClientRect().top;
          scroller.scrollTo({top:Math.max(0,scroller.scrollTop+offset-34),behavior:'smooth'});
          setTimeout(()=>{programmaticScroll=false},850);
        }
        lastAutoFocus=focusKey;
      }
    }
    setCard(stopName,planned,detail('Verspätung (GTFS-RT)'),detail('Positionsalter'),Boolean(trackGroup?.getLayers().some(layer=>layer instanceof L.Polyline)));
  }
  async function updateTrack() {
    const selection=currentSelection();
    const version=++requestVersion;
    if (!selection) {activeTrip='';clearTrack();return;}
    if (selection.key!==activeTrip) {
      activeTrip=selection.key;clearTrack();lastAutoFocus='';userMovedScroll=false;
    }
    try {
      const [feed,index,shapes]=await Promise.all([
        json('/api/'+selection.source, 15000),
        json('/data/'+selection.source+'-index.json', 120000),
        json('/data/'+selection.source+'-shapes.json', 120000)
      ]);
      if (version!==requestVersion || currentSelection()?.key!==selection.key) return;
      const v=matchingVehicle(feed,selection);
      const trip=index?.trips?.[selection.tripId];
      const shapeId=trip?.[2];
      const path=shapeId ? shapes?.shapes?.[shapeId] : null;
      if (v && path) drawTrack(path,coordinates(v));
      else clearTrack();
    } catch (e) {
      if (version===requestVersion) clearTrack();
      console.info('Radar 3.6: Route nicht verfügbar; keine Strecke erfunden.',e);
    }
    if (version===requestVersion) showProgress();
  }
  function init() {
    document.querySelector('.brand-title em')?.replaceChildren(document.createTextNode('3.6'));
    document.title='Südtirol Radar 3.6 · Züge & Busse';
    const sheet=$('sheet'), stops=$('stops');
    if (!sheet || !stops) return;
    const scroller=sheet.querySelector('.sheet-scroll');
    scroller?.addEventListener('touchstart',()=>{if (!programmaticScroll) userMovedScroll=true},{passive:true});
    scroller?.addEventListener('wheel',()=>{if (!programmaticScroll) userMovedScroll=true},{passive:true});
    let pending=0;
    const schedule=()=>{clearTimeout(pending);pending=setTimeout(()=>{updateTrack();showProgress()},120)};
    new MutationObserver(schedule).observe(sheet,{attributes:true,attributeFilter:['class']});
    new MutationObserver(schedule).observe($('sheetTitle'),{childList:true,characterData:true,subtree:true});
    // radar35 sets stop-current asynchronously; observe class changes but not our own card.
    new MutationObserver(()=>showProgress()).observe(stops,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
    setInterval(()=>{if (currentSelection()) {updateTrack();showProgress()} else if(activeTrip) {activeTrip='';clearTrack()}},20000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
