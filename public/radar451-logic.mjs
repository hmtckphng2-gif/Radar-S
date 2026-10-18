/* Radar 4.5.1 — Conservative GTFS route-candidate matching.
 * Coordinates are never extrapolated and competing shapes are rejected.
 */
export function deriveCandidates(db, serviceDay, today, routeId, directionId, limit=32){
  if(!db || !routeId || !['0','1'].includes(String(directionId)))return [];
  const dir=String(directionId);
  const planned=db.busShapeCandidatesByDay?.[serviceDay]?.[routeId]?.[dir];
  if(Array.isArray(planned))return planned.length<=limit?planned.filter(id=>typeof id==='string'&&id.length<256):[];
  // Compatibility with existing 4.5 GTFS indexes: only trips confirmed to run TODAY.
  // Yesterday's / tomorrow's service calendar cannot safely be reconstructed
  // from the index's single `activeToday` flag.
  if(serviceDay!==today)return [];
  const set=new Set();
  for(const trip of Object.values(db.trips||{})){
    if(trip?.[0]===routeId && String(trip?.[6])===dir && trip[5]===true && typeof trip[2]==='string' && trip[2]){
      set.add(trip[2]);if(set.size>limit)return [];
    }
  }
  return [...set];
}
export function withinShapeBounds(bounds,lat,lon,margin=.005){
  if(!Array.isArray(bounds)||bounds.length!==4 || !bounds.every(Number.isFinite))return true;
  // [south, west, north, east]
  return lat>=bounds[0]-margin&&lat<=bounds[2]+margin&&lon>=bounds[1]-margin&&lon<=bounds[3]+margin;
}
export function chooseVerifiedCandidate(hits,{maxDistance=35,minSeparation=18}={}){
  const sorted=(hits||[]).filter(c=>c && c.snap && Number.isFinite(c.snap.distance) &&
     c.snap.distance>=0 && c.snap.distance<=maxDistance && Array.isArray(c.path) && c.path.length>=2)
    .sort((a,b)=>a.snap.distance-b.snap.distance);
  if(!sorted.length)return null;
  // Another credible official variant nearby? We cannot know which turn the bus takes.
  if(sorted.length>1 && sorted[1].snap.distance-sorted[0].snap.distance<minSeparation)return null;
  return sorted[0];
}
export function buildMatchingDiagnostic({busCount=0,matched=0,manifestLoaded=false,candidates=0,geometry=0,legacy=0}={}){
  if(!busCount)return 'Noch keine Buspositionen';
  if(!manifestLoaded)return `0/${busCount} · Busstrecken-Manifest fehlt. GTFS-Import neu starten.`;
  if(!candidates)return `0/${busCount} · Keine passenden Linien-/Richtungs-Kandidaten. Statische GTFS-Daten und Fahrplantag prüfen.`;
  if(!geometry)return `0/${busCount} · ${candidates} Busse mit Strecken-Kandidaten, aber Geometrie noch nicht geladen.`;
  return `${matched}/${busCount} auf geprüfter Route · ${candidates} mit Kandidaten · ${geometry} mit geladener Geometrie · ${legacy} mit eindeutiger Route`;
}
