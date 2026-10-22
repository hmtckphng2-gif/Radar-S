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
  busTracks: new Map(), fusion:{sources:new Map(),duplicates:0}, performance:{lastMarkerRefresh:0}
};

// Boot-Phase für den Startsequenz-Status (wird im data-Attribut gespiegelt).
export function bootPhase(phase){
  state.bootPhase=phase;
  document.documentElement.dataset.radarBoot=phase;
}
