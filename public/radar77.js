/* Radar 7.7 UI. Preserves all original live data, map markers and Ist/Soll comparison. */
(()=>{'use strict';const KEY='sr77-favorite-stations';
 function favorites(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,40):[]}catch{return []}}
 function save(ids){try{localStorage.setItem(KEY,JSON.stringify(ids.slice(0,40)))}catch{}}
 function init(){
  let last=null;document.addEventListener('sr75:station-selected',e=>{const stopId=String(e.detail?.stopId||'').trim();if(!stopId)return;last={stopId,name:String(e.detail?.name||stopId)};show()});
  function show(){const board=document.getElementById('stationBoard');if(!board||!last)return;let bar=document.getElementById('sr77StationBar');if(!bar){bar=document.createElement('div');bar.id='sr77StationBar';bar.className='sr77-station-bar';const caption=document.createElement('span');caption.id='sr77StationCaption';const button=document.createElement('button');button.type='button';button.className='sr77-favorite';button.id='sr77StationFavorite';button.addEventListener('click',()=>{if(!last)return;const set=favorites(),i=set.indexOf(last.stopId);if(i<0)set.unshift(last.stopId);else set.splice(i,1);save(set);show()});bar.append(caption,button);const target=board.querySelector('.section-sub');target?.insertAdjacentElement('afterend',bar)||board.prepend(bar)}
   const active=favorites().includes(last.stopId);document.getElementById('sr77StationCaption').textContent='Abfahrten · verfügbare Live-Daten';const button=document.getElementById('sr77StationFavorite');button.textContent=active?'★ Favorit':'☆ Favorit';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Bahnhof aus Favoriten entfernen: ':'Bahnhof zu Favoriten hinzufügen: ')+last.name)
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
