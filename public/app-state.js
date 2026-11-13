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
  favorites: new Set(),
  lineFavorites: new Set(),
  journeyFavorites: new Set(),
  alerts: {},
  dismissedAlerts: new Set(),
  vehicleTracks: new Map()
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

// Lädt gelöschte Alert-IDs aus LocalStorage, damit sie nicht wieder auftauchen.
export function loadDismissedAlerts(){
  try{
    const raw=localStorage.getItem('sr-dismissed-alerts');
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr))for(const id of arr)state.dismissedAlerts.add(id);
    }
  }catch{}
}

// Speichert gelöschte Alert-IDs in LocalStorage.
export function saveDismissedAlerts(){
  try{localStorage.setItem('sr-dismissed-alerts',JSON.stringify([...state.dismissedAlerts]))}catch{}
}

// Fügt eine Alert-ID zur Dismissed-Liste hinzu und speichert sie.
export function dismissAlert(id){
  if(!id)return;
  state.dismissedAlerts.add(id);
  saveDismissedAlerts();
}

// Schaltet ein Fahrzeug als Favorit um. Gibt den neuen Zustand zurück.
export function toggleFavorite(key){
  if(state.favorites.has(key)){state.favorites.delete(key);}else{state.favorites.add(key);}
  saveFavorites();
  return state.favorites.has(key);
}

// Prüft ob ein Fahrzeug favorisiert ist.
export function isFavorite(key){return state.favorites.has(key);}

// Schaltet eine Linie als Favorit um. Schlüssel: source:routeId.
// Gibt den neuen Zustand zurück.
export function toggleLineFavorite(lineKey){
  if(state.lineFavorites.has(lineKey)){state.lineFavorites.delete(lineKey);}
  else{state.lineFavorites.add(lineKey);}
  saveLineFavorites();
  return state.lineFavorites.has(lineKey);
}

// Prüft ob eine Linie favorisiert ist.
export function isLineFavorite(lineKey){return state.lineFavorites.has(lineKey);}

// Lädt gespeicherte Linien-Favoriten aus LocalStorage.
export function loadLineFavorites(){
  try{
    const raw=localStorage.getItem('sr-line-favorites');
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr))for(const k of arr)state.lineFavorites.add(k);
    }
  }catch{}
}

// Speichert Linien-Favoriten in LocalStorage.
export function saveLineFavorites(){
  try{localStorage.setItem('sr-line-favorites',JSON.stringify([...state.lineFavorites]))}catch{}
}

// Schaltet eine Verbindung als Favorit um. Schlüssel: source:routeId:fromStop:toStop:departureTime.
// Gibt den neuen Zustand zurück.
export function toggleJourneyFavorite(key){
  if(state.journeyFavorites.has(key)){state.journeyFavorites.delete(key);}
  else{state.journeyFavorites.add(key);}
  saveJourneyFavorites();
  return state.journeyFavorites.has(key);
}

// Prüft ob eine Verbindung favorisiert ist.
export function isJourneyFavorite(key){return state.journeyFavorites.has(key);}

// Lädt gespeicherte Verbindungs-Favoriten aus LocalStorage.
export function loadJourneyFavorites(){
  try{
    const raw=localStorage.getItem('sr-journey-favorites');
    if(raw){
      const arr=JSON.parse(raw);
      if(Array.isArray(arr))for(const k of arr)state.journeyFavorites.add(k);
    }
  }catch{}
}

// Speichert Verbindungs-Favoriten in LocalStorage.
export function saveJourneyFavorites(){
  try{localStorage.setItem('sr-journey-favorites',JSON.stringify([...state.journeyFavorites]))}catch{}
}

// Boot-Phase für den Startsequenz-Status (wird im data-Attribut gespiegelt).
export function bootPhase(phase){
  state.bootPhase=phase;
  document.documentElement.dataset.radarBoot=phase;
}

// Fahrzeug-Trajektur: speichert die letzten Positionen pro Fahrzeug für die
// Spur-Anzeige auf der Karte. Maximal 30 Punkte pro Fahrzeug.
export function addTrackPoint(key, lat, lng){
  const trk=state.vehicleTracks.get(key);
  if(trk){
    trk.points.push({lat,lng,t:Date.now()});
    if(trk.points.length>30)trk.points.shift();
  }else{
    state.vehicleTracks.set(key,{points:[{lat,lng,t:Date.now()}]});
  }
}

export function getTrackPoints(key){
  const trk=state.vehicleTracks.get(key);
  return trk?trk.points:null;
}

export function clearTrack(key){
  state.vehicleTracks.delete(key);
}
