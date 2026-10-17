/* Suedtirol Radar 3.5 add-on: dark basemap + honest stop progress.
   Loaded after Leaflet and before the existing app.js. */
(() => {
  'use strict';
  const darkURL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const darkAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const activeLayers = new Set();
  const originalTileLayer = L.tileLayer;
  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

  // Convert only the existing base map (never other map overlays).
  L.tileLayer = function(url, options = {}) {
    const isBasemap = /tile\.openstreetmap\.org|tile\.openstreetmap\.fr\/hot/.test(url);
    if (!isBasemap) return originalTileLayer.call(this, url, options);
    const originalAttribution = options.attribution;
    const layer = originalTileLayer.call(this, isDark() ? darkURL : url, {
      ...options, attribution: isDark() ? darkAttribution : originalAttribution,
      subdomains: isDark() ? 'abcd' : (options.subdomains || 'abc')
    });
    activeLayers.add({ layer, url, originalAttribution });
    layer.on('remove', () => {
      for (const item of activeLayers) if (item.layer === layer) activeLayers.delete(item);
    });
    return layer;
  };
  new MutationObserver(() => {
    for (const {layer,url,originalAttribution} of activeLayers) {
      const next = isDark() ? darkURL : url;
      if (layer._url !== next) {
        layer.options.attribution = isDark() ? darkAttribution : originalAttribution;
        layer.options.subdomains = isDark() ? 'abcd' : 'abc';
        layer.setUrl(next);
      }
    }
  }).observe(document.documentElement, {attributes:true,attributeFilter:['data-theme']});

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
    if (oldTitle) oldTitle.textContent = '3.5';
    document.title = document.title.replace('3.4','3.5');
    setInterval(() => { if (byId('sheet')?.classList.contains('open') && list.children.length) updateStopProgress(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
