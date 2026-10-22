// Zentraler Anwendungszustand. Einzelne Quelle der Wahrheit für den Live-Betrieb.
// Wird von app.js und den zugehörigen Modulen importiert. Änderungen am
// exportierten Objekt sind durch ES-Module live für alle Importe sichtbar.
export const state = {
  map: null, layer: null, selectedLayer: null, activeSheet: null, selectedKey: null,
  filter: 'all', query: '', busy: false, statuses: {},
  vehicles: new Map(), markers: new Map(), jobs: new Map(), updates: new Map(),
  indexes: {}, details: {}, shapes: {}, models: {}, counts: {}, lastSuccess: {},
  stationChoice: null, stationList: [], fetchedAt: 0, failCount: 0, scheduledSearch: null,
  busShapeManifests: {}, busShapePending: new Set(), busShapeLoaded: new Set(),
  busShapeFailures: new Set(),
  busTracks: new Map(), fusion:{sources:new Map(),duplicates:0}, performance:{lastMarkerRefresh:0},
  favorites: new Set()
};

// Lädt gespeicherte Favoriten aus LocalStorage.
export function loadFavorites(){
  try{
    const raw=localStorage.getItem('sr-favorites');
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr))for(const k of arr)state.favorites.add(k);
    }
  }catch{}
}

// Speichert Favoriten in LocalStorage.
export function saveFavorites(){
  try{localStorage.setItem('sr-favorites',JSON.stringify([...state.favorites]))}catch{}
}

// Schaltet ein Fahrzeug als Favorit um. Gibt den neuen Zustand zurück.
export function toggleFavorite(key){
  if(state.favorites.has(key)){state.favorites.delete(key);}else{state.favorites.add(key);}
  saveFavorites();
  return state.favorites.has(key);
}

// Prüft ob ein Fahrzeug favorisiert ist.
export function isFavorite(key){return state.favorites.has(key);}

// Boot-Phase für den Startsequenz-Status (wird im data-Attribut gespiegelt).
export function bootPhase(phase){
  state.bootPhase=phase;
  document.documentElement.dataset.radarBoot=phase;
}
