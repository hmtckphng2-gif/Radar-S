/* Radar 7.7 UI. Preserves all original live data, map markers and Ist/Soll comparison. */
(()=>{'use strict';const VERSION='7.7.0',KEY='sr77-favorite-stations';
 function favorites(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,40):[]}catch{return []}}
 function save(ids){try{localStorage.setItem(KEY,JSON.stringify(ids.slice(0,40)))}catch{}}
 function init(){document.title='Südtirol Radar 7.7';const mark=document.querySelector('.brand-title em');if(mark)mark.textContent='7.7';
  const version=document.getElementById('sr76LiveVersion');if(version)version.textContent='7.7 · prüfe Live-Version';
  fetch('/api/version?v='+VERSION,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json()}).then(v=>{if(version)version.textContent=v.version===VERSION?'7.7 · Live bestätigt':`7.7 · Server ${v.version||'unbekannt'}`}).catch(()=>{if(version)version.textContent='7.7 · Live nicht verifiziert'});
  // The map starts with fresh reports only. Users can opt into last-known positions.
  let showNonLive=false;try{showNonLive=localStorage.getItem('sr77-show-nonlive')==='true'}catch{}
  window.sr77ShowNonLive=showNonLive;
  const filterRow=document.querySelector('.segments');
  if(filterRow&&!document.getElementById('sr77ShowNonLive')){
   const toggle=document.createElement('button');toggle.id='sr77ShowNonLive';toggle.type='button';toggle.className='chip sr77-nonlive-toggle';
   const repaint=()=>{toggle.textContent=window.sr77ShowNonLive?'◷ Nicht live: an':'◷ Nicht live: aus';toggle.setAttribute('aria-pressed',String(window.sr77ShowNonLive));toggle.title=window.sr77ShowNonLive?'Auch letzte bekannte Positionen anzeigen':'Nur aktuell gemeldete Fahrzeuge auf der Karte';};
   toggle.addEventListener('click',()=>{window.sr77ShowNonLive=!window.sr77ShowNonLive;try{localStorage.setItem('sr77-show-nonlive',String(window.sr77ShowNonLive))}catch{}repaint();window.SuedtirolRadar37?.refreshMarkers?.();window.SuedtirolRadar37?.state?.map?.fire('moveend')});repaint();filterRow.append(toggle);
  }
  window.SuedtirolRadar37?.refreshMarkers?.();window.SuedtirolRadar37?.state?.map?.fire('moveend');
  let last=null;document.addEventListener('sr75:station-selected',e=>{const stopId=String(e.detail?.stopId||'').trim();if(!stopId)return;last={stopId,name:String(e.detail?.name||stopId)};show()});
  function show(){const board=document.getElementById('stationBoard');if(!board||!last)return;let bar=document.getElementById('sr77StationBar');if(!bar){bar=document.createElement('div');bar.id='sr77StationBar';bar.className='sr77-station-bar';const caption=document.createElement('span');caption.id='sr77StationCaption';const button=document.createElement('button');button.type='button';button.className='sr77-favorite';button.id='sr77StationFavorite';button.addEventListener('click',()=>{if(!last)return;const set=favorites(),i=set.indexOf(last.stopId);if(i<0)set.unshift(last.stopId);else set.splice(i,1);save(set);show()});bar.append(caption,button);const target=board.querySelector('.section-sub');target?.insertAdjacentElement('afterend',bar)||board.prepend(bar)}
   const active=favorites().includes(last.stopId);document.getElementById('sr77StationCaption').textContent='Abfahrten · verfügbare Live-Daten';const button=document.getElementById('sr77StationFavorite');button.textContent=active?'★ Favorit':'☆ Favorit';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Bahnhof aus Favoriten entfernen: ':'Bahnhof zu Favoriten hinzufügen: ')+last.name)
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
