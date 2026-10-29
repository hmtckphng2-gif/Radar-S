/* Südtirol Radar 3.7 – one coherent enhancement for the proven 3.4 app.
 * Real GTFS geometry only; no invented roads, stations, delays or vehicle positions.
 * This replaces the 3.5/3.6 JS enhancers but keeps the working dark tile styling.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FAV_KEY = 'suedtirol-radar-favorites-v1';
  const MAX_POSITION_AGE = 300; // seconds; never portray old positions as current.
  let bridge, map, routeLayer, followKey = null, followPaused = false, currentFocus = '', userScrolled = false;
  let scheduled = 0, firstSetup = false, suppressScroll = false, stationIndexCache = new Map();
  let favorites = readFavorites();

  function readFavorites() {
    try {
      const found = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return Array.isArray(found) ? found.filter(v => v && (v.type === 'line' || v.type === 'station')).slice(0,60) : [];
    } catch { return []; }
  }
  function storeFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites.slice(0,60))); } catch {}
  }
  const text = value => value == null ? '' : String(value);
  const secItaly = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
    }).formatToParts(new Date());
    const obj = Object.fromEntries(parts.map(p => [p.type,p.value]));
    return Number(obj.hour)*3600 + Number(obj.minute)*60 + Number(obj.second);
  };
  function formatClock(sec) {
    if (!Number.isFinite(sec)) return '–';
    const mins=Math.floor(sec/60);
    return String(Math.floor(mins/60)%24).padStart(2,'0')+':'+String(mins%60).padStart(2,'0')+
      (mins>=1440?' +1':'');
  }
  function readableDelay(seconds) {
    if (seconds == null || !Number.isFinite(Number(seconds))) return null;
    const m = Math.round(Number(seconds)/60);
    return (m>0?'+':'')+m+' Min.';
  }
  function validRecent(v) {
    const age = v?.timestamp ? Date.now()/1000-v.timestamp : Infinity;
    return !v?.stale && Number.isFinite(age) && age>=-30 && age<=MAX_POSITION_AGE;
  }
  const selected = () => bridge?.state.activeSheet === 'vehicle'
    ? bridge.state.vehicles.get(bridge.state.selectedKey) || null : null;
  const activeMapVehicle = () => selected() || (followKey && bridge?.state.vehicles.get(followKey)) || null;
  function idFor(entry) {
    return entry.type === 'station' ? 'station:'+entry.source+':'+entry.stopId :
      'line:'+entry.source+':'+entry.kind+':'+entry.name;
  }
  function toggleFavorite(entry) {
    const key=idFor(entry), old=favorites.findIndex(e=>idFor(e)===key);
    if(old>=0)favorites.splice(old,1);else favorites.push(entry);
    storeFavorites();renderFavorites();renderVehicle();renderStationBoard();
  }
  function isFavorite(entry) {return favorites.some(e=>idFor(e)===idFor(entry));}

  function make(tag,cls,content) {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(content != null)el.textContent=content;
    return el;
  }
  function card() {
    let el=$('radar37Card');
    if(!el) {
      el=make('section','radar37-card');el.id='radar37Card';
      el.setAttribute('aria-label','Aktuelle Fahrtinformationen');
      const scroll=$('sheet')?.querySelector('.sheet-scroll');
      if(scroll)scroll.prepend(el);
    }
    return el;
  }
  function resetProgress() {
    for(const li of $('stops')?.querySelectorAll('li.stop') || []) {
      li.classList.remove('stop-past','stop-current','stop-future');
      li.querySelector('.stop-position-note')?.remove();
    }
  }
  let lastStopRejection='';
  function stopPosition(v) {
    lastStopRejection='';
    if(!v || !validRecent(v) || !v.tripId || !v.source) return null;
    const detail=bridge.state.details[v.source];
    const rows=detail?.times?.[v.tripId];
    const displayed=$('stops')?.querySelectorAll('li.stop') || [];
    // Require the same static trip and a full matching timetable: no wrong fallback matching.
    if(!Array.isArray(rows) || !rows.length || rows.length !== displayed.length) return null;
    const stopId=text(v.currentStopId), seq=Number(v.currentStopSequence);
    const byId=stopId ? rows.findIndex(r=>text(r[0]).toLowerCase()===stopId.toLowerCase()) : -1;
    const bySeq=Number.isFinite(seq) && seq>0 ? rows.findIndex(r=>Number(r[3])===seq) : -1;
    if(byId>=0 && bySeq>=0 && byId!==bySeq) return null; // inconsistent RT feed
    const index=byId>=0 ? byId : bySeq;
    if(index<0) return null;
    const stop=rows[index];
    const atStop=/^(?:STOPPED_AT|1)$/i.test(text(v.currentStatus));
    const planned=atStop ? (stop[2]??stop[1]) : (stop[1]??stop[2]);
    const candidate={index, rows, stopId:text(stop[0]),
      name:text(detail.stops?.[stop[0]]?.[0] || 'Haltestelle'),
      time:planned == null ? NaN : Number(planned),
      atStop};
    // A recent GPS/estimated fix does not prove that an old scheduled stop
    // is still upcoming. Only a stop-specific RT delay may correct its time.
    // Conservative fallback: without the 4.3.1 guard, claim no confirmed stop.
    const check=window.SuedtirolRadar431Guard?.isStopCredible;
    if(typeof check!=='function')return null;
    const rt=rtDelay(v,candidate.stopId);
    const delay=rt.kind==='Halt' ? rt.delay : null;
    if(rt.cancelled){lastStopRejection='Fahrt entfällt laut Echtzeitmeldung';return null;}
    if(!check({scheduledSeconds:candidate.time,
      serviceDate:v.tripStartDate,delaySeconds:delay,nowMs:Date.now()})){
      lastStopRejection='Gemeldeter Halt zeitlich nicht bestätigt – Planzeit überholt oder Fahrplantag unklar';
      return null;
    }
    return candidate;
  }
  function rtDelay(v,stopId) {
    const upd=bridge.state.updates.get(v.source+':'+v.tripId);
    if(!upd || bridge.state.statuses[v.source+'_updates']!=='ok' || Date.now()-upd.fetchedAt>120000) return {delay:null,cancelled:false,kind:''};
    const cancelled=/^(?:CANCELED|CANCELLED|3)$/i.test(text(upd.scheduleRelationship));
    if(text(v.currentStopId).toLowerCase()===text(stopId).toLowerCase()){
      const matched=bridge.vehicleDelay?.(v);
      return {delay:matched?.delay??null,cancelled,kind:matched?.basis==='halt'?'Halt':matched?.basis==='fahrt'?'Fahrt':''};
    }
    const row=upd.stops?.find(s=>text(s.stopId??s.stop_id).toLowerCase()===text(stopId).toLowerCase());
    const raw=row?.arrival?.delay??row?.departure?.delay;
    if(raw!=null && Number.isFinite(Number(raw)))return {delay:Number(raw),cancelled,kind:'Halt'};
    // No RT for this stop: a trip-wide delay must not masquerade as its ETA.
    return {delay:null,cancelled,kind:''};
  }
  function focusCurrent(li,v,p) {
    const focusKey=v.key+'|'+p.index;
    if(userScrolled || focusKey===currentFocus)return;
    const scroller=$('sheet')?.querySelector('.sheet-scroll');
    if(!scroller)return;
    currentFocus=focusKey;
    // Scroll within the sheet only. No page scroll and no repeated scroll on polls.
    const amount=li.getBoundingClientRect().top-scroller.getBoundingClientRect().top;
    suppressScroll=true;
    scroller.scrollTo({top:Math.max(0,scroller.scrollTop+amount-150),behavior:'smooth'});
    setTimeout(()=>{suppressScroll=false},800);
  }
  function renderVehicle() {
    if(!bridge)return;
    const el=card();if(!el)return;
    const v=selected();
    if(!v){el.hidden=true;resetProgress();return;}
    el.hidden=false; el.replaceChildren();
    const p=stopPosition(v);
    resetProgress();
    if(p) {
      const all=[...$('stops').querySelectorAll('li.stop')];
      all.forEach((li,i)=>li.classList.add(i<p.index?'stop-past':i===p.index?'stop-current':'stop-future'));
      const li=all[p.index];
      const note=make('small','stop-position-note',p.atStop?'● Am Halt (laut Feed)':'● Nächster Halt (laut Feed)');
      li.querySelector('div')?.append(note);
      focusCurrent(li,v,p);
    }
    const head=make('strong','radar37-card-head',p
      ? (p.atStop?'Am Halt: ':'Nächster Halt: ')+p.name
      : 'Nächster Halt nicht verifiziert');
    el.append(head);
    const sub=make('div','radar37-card-sub');
    if(p) {
      const delay=rtDelay(v,p.stopId);
      const bits=[Number.isFinite(p.time)?'Plan '+formatClock(p.time)+' (Fahrplantag)':'' ];
      if(delay.cancelled)bits.push('Fahrt entfällt laut GTFS-RT');
      else if(delay.delay!==null)bits.push('RT '+readableDelay(delay.delay)+' ('+delay.kind+')');
      else bits.push('Keine bestätigte Verspätung');
      const now=secItaly();
      if(Number.isFinite(p.time) && now-p.time>900 && p.time<86400)
        bits.push('Planzeit bereits vergangen – Prognose prüfen');
      sub.textContent=bits.filter(Boolean).join(' · ');
    } else {
      sub.textContent=!v.tripId?'Keine Fahrt-ID im Feed – Haltestelle nicht zuordenbar':
        !validRecent(v)?'Positionsmeldung zu alt oder Zeit nicht bekannt':
        lastStopRejection || 'Keine eindeutig passende Haltestellenfolge / Stop-ID vorhanden';
    }
    el.append(sub);
    const stateInfo=make('div','radar37-card-foot');
    const age=v.timestamp ? Math.max(0,Math.round(Date.now()/1000-v.timestamp))+' Sek.' : 'unbekannt';
    stateInfo.textContent='Position '+age+' alt · '+
      (v.kind==='train'?'Bahnposition kann geschätzt sein':'Position laut Feed, GPS nicht garantiert')+
      ' · '+(trackIsDrawn?(v.routeShapeId&&!v.shapeId?'Möglicher GTFS-Linienverlauf':'GTFS-Route sichtbar'):'Strecke nicht verifiziert');
    el.append(stateInfo);
    const buttons=make('div','radar37-actions');
    const follow=make('button','radar37-smallbtn',followKey===v.key?'■ Verfolgung beenden':'◎ Fahrzeug verfolgen');
    follow.type='button';follow.onclick=()=>{
      followKey=followKey===v.key?null:v.key;followPaused=false;
      updateFollowBadge();renderVehicle();renderRoute();
      if(followKey) { $('closeSheet')?.click();followTick(); }
    };
    buttons.append(follow);
    if(v.name && v.name!=='Linie unbekannt' && v.name!=='Zugnummer unbekannt') {
      const entry={type:'line',source:v.source,kind:v.kind,name:v.name};
      const fav=make('button','radar37-smallbtn',isFavorite(entry)?'★ Linie gespeichert':'☆ Linie merken');
      fav.type='button';fav.onclick=()=>toggleFavorite(entry);buttons.append(fav);
    }
    el.append(buttons);
  }
  let trackIsDrawn = false;
  function projected(path,lat,lon) {
    if(!Array.isArray(path)||path.length<2)return null;
    const cos=Math.cos(lat*Math.PI/180);
    let nearest=null;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];
      const ax=a[1]*cos,ay=a[0],dx=(b[1]-a[1])*cos,dy=b[0]-a[0];
      const denom=dx*dx+dy*dy;
      if(!(denom>1e-14))continue;
      const f=Math.max(0,Math.min(1,((lon*cos-ax)*dx+(lat-ay)*dy)/denom));
      const px=ax+dx*f,py=ay+dy*f;
      const dist=Math.hypot(lon*cos-px,lat-py)*111195;
      if(!nearest||dist<nearest.distance) nearest={i,f,distance:dist,point:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]};
    }
    return nearest;
  }
  function renderRoute() {
    if(!map||!routeLayer)return;
    routeLayer.clearLayers();trackIsDrawn=false;
    const v=activeMapVehicle();
    if(!v||!validRecent(v)||!(v.shapeId||v.routeShapeId)) return;
    const routeOnly=Boolean(!v.shapeId && v.routeShapeId);
    if(!routeOnly){
      const trip=bridge.state.indexes[v.source]?.trips?.[v.tripId];
      if(!trip||trip[2]!==v.shapeId)return;
    }
    const path=bridge.state.shapes[v.source]?.shapes?.[v.shapeId||v.routeShapeId];
    if(!Array.isArray(path)||path.length<2||path.length>25000)return;
    const points=path.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(points.length!==path.length)return;
    const hit=projected(points,v.lat,v.lon);
    if(!hit||hit.distance>(routeOnly?35:(v.kind==='bus'?65:350)))return;
    if(routeOnly){
      // Reuse the stricter core heading check; no fictitious 'already travelled'
      // segment when the actual trip_id is not available.
      if(!bridge.routeMatchFor?.(v)?.path)return;
      L.polyline(points,{pane:'radar37RoutePane',color:v.kind==='train'?'#7bcfff':'#e7a847',weight:3,
        dashArray:'4 8',opacity:.65,interactive:false}).addTo(routeLayer);
      trackIsDrawn=true;
      return;
    }
    const past=[...points.slice(0,hit.i),hit.point];
    const upcoming=[hit.point,...points.slice(hit.i)];
    if(upcoming.length>1)L.polyline(upcoming,{pane:'radar37RoutePane',color:v.kind==='train'?'#8bcfff':'#f5b851',weight:4.5,opacity:.92,interactive:false}).addTo(routeLayer);
    if(past.length>1)L.polyline(past,{pane:'radar37RoutePane',color:v.kind==='train'?'#347cff':'#357fbc',weight:5.5,opacity:.90,interactive:false}).addTo(routeLayer);
    trackIsDrawn=true;
  }
  function updateFollowBadge() {
    let badge=$('radar37Follow');
    if(!badge) {
      badge=make('button','radar37-follow');badge.id='radar37Follow';badge.type='button';
      document.body.append(badge);
    }
    const v=followKey && bridge?.state.vehicles.get(followKey);
    if(!v){followKey=null;badge.hidden=true;return;}
    badge.hidden=false;
    badge.textContent=followPaused?'◎ '+v.name+' · pausiert · ▶ Fortsetzen':'◎ '+v.name+' folgen · ✕ Beenden';
    badge.onclick=()=>{if(followPaused){followPaused=false;updateFollowBadge();followTick();}else{followKey=null;updateFollowBadge();renderRoute();}};
  }
  function followTick() {
    if(!followKey||!map||document.hidden||followPaused)return;
    const entry=bridge.state.markers.get(followKey);
    const position=entry?.marker?.getLatLng();
    if(!position||!bridge.state.vehicles.has(followKey)){
      followKey=null;updateFollowBadge();return;
    }
    if(!validRecent(bridge.state.vehicles.get(followKey))){
      followKey=null;updateFollowBadge();return;
    }
    const point=map.latLngToContainerPoint?.(position);
    const size=map.getSize?.();
    const distance=point&&size?Math.hypot(point.x-size.x/2,point.y-size.y/2):Infinity;
    if(distance>55)map.panTo(position,{animate:distance<500,duration:.35});
  }

  function favoritesPanel() {
    let panel=$('radar37Favorites');
    if(!panel){panel=make('section','radar37-favorites');panel.id='radar37Favorites';panel.hidden=true;
      panel.setAttribute('aria-label','Gespeicherte Linien und Haltestellen');document.body.append(panel);}
    return panel;
  }
  function renderFavorites() {
    const panel=favoritesPanel();panel.replaceChildren();
    const top=make('div','radar37-favtop');
    top.append(make('strong','', '★ Favoriten'));
    const close=make('button','radar37-favclose','✕');close.type='button';close.onclick=()=>panel.hidden=true;
    top.append(close);panel.append(top);
    if(!favorites.length){panel.append(make('p','radar37-muted','Noch keine Favoriten. Speichere eine Linie in den Fahrzeugdetails oder eine Haltestelle in der Abfahrtstafel.'));return;}
    for(const entry of favorites){
      const row=make('div','radar37-favrow');
      const use=make('button','radar37-favuse',entry.type==='station'?'▦ '+entry.name:'☆ '+entry.name+' · '+entry.source.toUpperCase());
      use.type='button';use.onclick=()=>openFavorite(entry);
      const remove=make('button','radar37-favdelete','✕');remove.type='button';remove.title='Favorit entfernen';remove.onclick=()=>toggleFavorite(entry);
      row.append(use,remove);panel.append(row);
    }
  }
  async function openFavorite(entry){
    favoritesPanel().hidden=true;
    if(entry.type==='station'){
      await bridge.showStations();
      if(bridge.state.activeSheet!=='station')return;
      const st=bridge.state.stationList.find(v=>v.source===entry.source&&v.stopId===entry.stopId);
      if(st)bridge.showStationBoard(st);
      else { $('stationSearch').value=entry.name; $('stationSearch').dispatchEvent(new Event('input')); }
      return;
    }
    bridge.setFilter(entry.kind==='train'?'trains':'buses');
    const input=$('search');input.value=entry.name;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    const matches=[...bridge.state.vehicles.values()].filter(v=>v.name===entry.name && v.source===entry.source && v.kind===entry.kind);
    if(matches.length&&map){
      const bounds=L.latLngBounds(matches.map(v=>[v.lat,v.lon]));
      if(matches.length===1)map.setView([matches[0].lat,matches[0].lon],12);
      else map.fitBounds(bounds,{maxZoom:12,padding:[60,60]});
    }
  }
  function addFavoritesButton() {
    if($('radar37FavBtn'))return;
    const b=make('button','round-action','★');b.type='button';b.id='radar37FavBtn';
    b.setAttribute('aria-label','Favoriten öffnen');b.title='Favoriten';
    b.onclick=()=>{const panel=favoritesPanel();renderFavorites();panel.hidden=!panel.hidden;};
    document.querySelector('.map-actions')?.append(b);
  }

  function stationCache(st) {
    const key=st.source+':'+st.stopId;
    if(stationIndexCache.has(key))return stationIndexCache.get(key);
    const db=bridge.state.indexes[st.source],details=bridge.state.details[st.source],items=[];
    for(const [tripId,rows] of Object.entries(details?.times||{})){
      const trip=db?.trips?.[tripId];if(!trip||trip[5]===false)continue;
      for(const row of rows){
        if(text(row[0])!==st.stopId)continue;
        const rawSec=row[2]??row[1];if(rawSec==null)continue;
        const sec=Number(rawSec);if(!Number.isFinite(sec))continue;
        const route=db.routes?.[trip[0]];
        const number=st.source==='trains' ? (text(trip[3])||'Zug') : (text(route?.[0])||'Linie unbekannt');
        items.push({tripId,sec,number,headsign:text(trip[1])||'Fahrtziel unbekannt'});
      }
    }
    stationIndexCache.set(key,items);
    return items;
  }
  function renderStationBoard() {
    if(!bridge || bridge.state.activeSheet!=='station' || $('stationBoard')?.hidden)return;
    const st=bridge.state.stationChoice;if(!st)return;
    const list=$('stationDepartures');if(!list)return;
    const now=secItaly();
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date());
    const d=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    const serviceDay=d.year+'-'+d.month+'-'+d.day,displayDate=d.day+'.'+d.month+'.'+d.year;
    const timetable=bridge.state.indexes?.[st.source];
    if(!timetable?.meta?.ready||!timetable.meta.days?.includes(serviceDay)){
      list.replaceChildren(make('p','radar37-muted','Für '+displayDate+' fehlen gültige GTFS-Fahrplandaten. Keine fiktiven Abfahrten.'));
      return;
    }
    const departures=[],seen=new Set();
    for(const row of stationCache(st)) {
      const upd=bridge.state.updates.get(st.source+':'+row.tripId);
      const correctDay=!upd?.tripStartDate||String(upd.tripStartDate).replaceAll('-','')===serviceDay.replaceAll('-','');
      const recent=upd&&correctDay&&Number.isFinite(+upd.fetchedAt)&&Date.now()>=Number(upd.fetchedAt)-30000&&Date.now()-Number(upd.fetchedAt)<120000;
      const cancelled=!!recent && /^(?:CANCELED|CANCELLED|3)$/i.test(text(upd.scheduleRelationship));
      const relevant=recent && upd.stops?.find(s=>text(s.stopId??s.stop_id)===st.stopId);
      const raw=relevant?.departure?.delay??relevant?.arrival?.delay;
      const delay=recent && raw!=null && Number.isFinite(Number(raw))?Number(raw):
        recent && upd.delay!=null && Number.isFinite(Number(upd.delay))?Number(upd.delay):null;
      const reportedTime=Number(relevant?.departure?.time ?? relevant?.arrival?.time);
      const validReportedTime=recent && reportedTime>1000000000 &&
        reportedTime>Date.now()/1000-3600 && reportedTime<Date.now()/1000+86400;
      // A GTFS-RT stop-event epoch timestamp is a stronger departure estimate than
      // a trip-wide delay. Convert to seconds relative to today's local clock.
      const predicted=validReportedTime ? now+(reportedTime-Date.now()/1000) : row.sec+(delay??0);
      if(predicted<now-180 || predicted>now+4*3600)continue;
      const unique=st.source+':'+row.tripId+':'+row.sec;
      if(seen.has(unique))continue;
      seen.add(unique);
      departures.push({...row,delay,predicted,cancelled,realtime:!!recent&&(delay!==null||validReportedTime),
        reportedTime:validReportedTime,exactStopRt:raw!=null});
    }
    departures.sort((a,b)=>a.predicted-b.predicted);
    list.replaceChildren();
    const entry={type:'station',source:st.source,stopId:st.stopId,name:st.name};
    let heading=$('radar37StationHead');
    if(!heading){heading=make('div','radar37-stationhead');heading.id='radar37StationHead';
      $('stationName')?.after(heading);}
    heading.replaceChildren();
    const fav=make('button','radar37-smallbtn',isFavorite(entry)?'★ Haltestelle gespeichert':'☆ Haltestelle merken');
    fav.type='button';fav.onclick=()=>toggleFavorite(entry);
    heading.append(fav,make('small','radar37-muted','Heute · '+displayDate+' · GTFS-Plan · Echtzeit nur bei passender GTFS-RT-Meldung.'));
    for(const d of departures.slice(0,28)) {
      const row=make('div','radar37-departure');
      const left=make('div','radar37-departure-info');
      left.append(make('strong','',d.number+' · '+d.headsign));
       if(st.source==='trains'&&!/^\\d{2,6}$/.test(String(d.number)))left.append(make('small','radar37-muted','Zugnummer nicht angegeben · Fahrt ab '+formatClock(d.sec)));
      const label=d.cancelled?'ENTFÄLLT (GTFS-RT)':d.realtime?
        (d.reportedTime?'GTFS-RT Zeitprognose': 'GTFS-RT '+readableDelay(d.delay)+(d.exactStopRt?' am Halt':' zur Fahrt')):'Nur Fahrplan';
      const meta=make('small',d.cancelled?'radar37-cancelled':d.realtime?'radar37-real':'radar37-muted',label+' · Plan '+formatClock(d.sec));
      left.append(meta);
       left.append(make('small','radar37-muted','Quelle: '+({trains:'Trenitalia',sta:'STA',trentino:'Trentino'}[st.source]||st.source)+' · '+displayDate));
      const right=make('span','radar37-departure-clock',d.cancelled?'—':formatClock(d.predicted));
      row.append(left,right);list.append(row);
    }
    if(!departures.length)list.append(make('p','radar37-muted','Keine passenden Abfahrten in den nächsten 4 Stunden gefunden. Nachtfahrten des Vortags können im GTFS-Tagesindex fehlen.'));
  }

  function updateAll() {
    if(!bridge)return;
    renderRoute();renderVehicle();renderStationBoard();updateFollowBadge();
  }
  function scheduleUpdate() {clearTimeout(scheduled);scheduled=setTimeout(updateAll,100);}
  function fixRasterTileEdges(){
    // Leaflet 1.9.4 may expose 1px gaps between CSS-filtered raster images in Safari.
    // Extend the bitmap by one CSS pixel, without changing its tile coordinates.
    if(!window.L?.TileLayer?.prototype?._initTile)return;
    const original=L.TileLayer.prototype._initTile;
    L.TileLayer.prototype._initTile=function(tile){
      original.call(this,tile);
      if(/openstreetmap/.test(this._url||'')){
        const size=this.getTileSize();
        tile.style.width=(size.x+1)+'px';tile.style.height=(size.y+1)+'px';
      }
    };
  }
  function start() {
    if(firstSetup)return;
    bridge=window.SuedtirolRadar37;
    if(!bridge?.state?.map || !window.L)return;
    firstSetup=true;map=bridge.state.map;
    const pane=map.createPane('radar37RoutePane');pane.style.zIndex='440';pane.style.pointerEvents='none';
    routeLayer=L.layerGroup().addTo(map);
    addFavoritesButton();renderFavorites();card();
    const scroller=$('sheet')?.querySelector('.sheet-scroll');
    scroller?.addEventListener('touchstart',()=>{if(!suppressScroll)userScrolled=true},{passive:true});
    scroller?.addEventListener('wheel',()=>{if(!suppressScroll)userScrolled=true},{passive:true});
    const stopList=$('stops');
    if(stopList)new MutationObserver(scheduleUpdate).observe(stopList,{childList:true});
    document.addEventListener('sr37:selection',()=>{currentFocus='';userScrolled=false;scheduleUpdate();});
    document.addEventListener('sr37:feeds',scheduleUpdate);
    document.addEventListener('sr37:shapes',scheduleUpdate);
    document.addEventListener('sr37:station-board',()=>{stationIndexCache.clear();scheduleUpdate();});
    document.addEventListener('sr37:sheet-closed',scheduleUpdate);
    map.on('dragstart',()=>{if(followKey){followPaused=true;updateFollowBadge();}});
    bridge.followAPI={getKey:()=>followKey,isPaused:()=>followPaused,
      resume:()=>{if(followKey){followPaused=false;updateFollowBadge();followTick();}},
      stop:()=>{followKey=null;followPaused=false;updateFollowBadge();renderRoute();}};
    bridge.confirmedStopFor=stopPosition;
    bridge.confirmedDelayFor=rtDelay;
    setInterval(followTick,1200);
    setInterval(scheduleUpdate,15000);
    
    scheduleUpdate();
  }
  // Patch the tile constructor BEFORE the app creates its tile layer.
  if(window.L)fixRasterTileEdges();
  document.addEventListener('sr37:ready',start);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
