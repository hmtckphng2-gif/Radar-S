/* Suedtirol Radar 3.5 add-on: dark basemap + honest stop progress.
   Loaded after Leaflet and before the existing app.js. */
(() => {
  'use strict';
  // Keep the proven OSM raster source from Radar 3.4.
  // CARTO began requiring an API key in September 2026.
  // A dark look is applied to tile IMAGES only in radar35.css,
  // never to a Leaflet pane (which caused rendering gaps on iOS).
  // No override of Leaflet's tile creation is necessary.

  const byId = id => document.getElementById(id);
  const cached = new Map();
  async function getJson(url, maxAge = 12000) {
    const found = cached.get(url);
    if (found && Date.now() - found.time < maxAge) return found.promise;
    const promise = fetch(url, {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(e => { cached.delete(url); throw e; });
    cached.set(url,{time:Date.now(),promise});
    return promise;
  }
  function getDetail(label) {
    const items = [...document.querySelectorAll('#details .detail')];
    const el = items.find(item => item.querySelector('small')?.textContent.trim() === label);
    return el?.querySelector('strong')?.textContent.trim() || '';
  }
  function readStopId(item) { return String(item?.stopId ?? item?.stop_id ?? ''); }
  let progressRequest = 0;
  async function updateStopProgress() {
    const version = ++progressRequest;
    const list = byId('stops');
    const elements = [...(list?.querySelectorAll('li.stop') || [])];
    for (const el of elements) {
      el.classList.remove('stop-past','stop-current','stop-future');
      el.querySelector('.stop-position-note')?.remove();
    }
    if (!elements.length || !byId('sheet')?.classList.contains('open')) return;
    const tripId = getDetail('Fahrt-ID');
    const vehicleId = getDetail('Fahrzeug-ID');
    const source = byId('sheetKind')?.textContent.match(/\b(STA|TRENTINO|TRAINS)\b/i)?.[1]?.toLowerCase();
    if (!source || !tripId || tripId === 'Nicht verfügbar') return;

    try {
      const [feed, details] = await Promise.all([
        getJson('/api/' + source, 12000),
        getJson('/data/' + source + '-details.json', 60000)
      ]);
      if (version !== progressRequest || getDetail('Fahrt-ID') !== tripId) return;
      const entities = feed.entity || feed.entities || [];
      const item = entities.find(e => {
        const v = e.vehicle || e.vehiclePosition || e.vehicle_position || {};
        const id = String(v.vehicle?.id ?? v.vehicle?.vehicle_id ?? '');
        const trip = String(v.trip?.trip_id ?? v.trip?.tripId ?? '');
        return (vehicleId && id === vehicleId) || (tripId && trip === tripId);
      });
      if (!item) return; // No reported position: never manufacture progress.
      const vehicle = item.vehicle || item.vehiclePosition || item.vehicle_position || {};
      const rows = details?.times?.[tripId];
      if (!Array.isArray(rows) || rows.length !== elements.length) return;
      const stopId = readStopId(vehicle.stop_id ? {stop_id:vehicle.stop_id} : {stopId:vehicle.stopId});
      const seq = Number(vehicle.current_stop_sequence ?? vehicle.currentStopSequence);
      let idx = stopId ? rows.findIndex(r => String(r[0]) === stopId) : -1;
      if (idx === -1 && Number.isFinite(seq) && seq > 0)
        idx = rows.findIndex(r => Number(r[3]) === seq);
      if (idx < 0) return;
      const mode = String(vehicle.current_status ?? vehicle.currentStatus ?? '').toUpperCase();
      const atStop = mode === 'STOPPED_AT' || mode === '1';
      for (let i = 0; i < elements.length; i++) {
        const status = i < idx ? 'past' : i === idx ? 'current' : 'future';
        elements[i].classList.add('stop-' + status);
      }
      const note = document.createElement('small');
      note.className = 'stop-position-note';
      note.textContent = atStop ? '● Am Halt (laut Feed)' : '● Nächster Halt (laut Feed)';
      elements[idx].querySelector('div')?.appendChild(note);
    } catch (e) {
      console.warn('Radar 3.5: stop progress unavailable',e);
      // Existing schedule stays visible; no unverified progress is shown.
    }
  }

  function init() {
    const list = byId('stops');
    if (!list) return;
    let scheduled = 0;
    const schedule = () => { clearTimeout(scheduled); scheduled = setTimeout(updateStopProgress, 80); };
    new MutationObserver(mutations => {
      if (mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && node.matches?.('li.stop')) ||
        [...m.removedNodes].some(node => node.nodeType === 1 && node.matches?.('li.stop')))) schedule();
    }).observe(list, {childList:true});
    const oldTitle = document.querySelector('.brand-title em');
    if (oldTitle) oldTitle.textContent = '3.5.1';
    document.title = document.title.replace(/3\.[45](?:\.1)?/, '3.5.1');
    setInterval(() => { if (byId('sheet')?.classList.contains('open') && list.children.length) updateStopProgress(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
