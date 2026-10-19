/* Visual grouping only. Every unique itinerary remains accessible. */
const line=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('de').trim();
function meters(a,b){
 const lat=Number(a?.lat),lon=Number(a?.lon),blat=Number(b?.lat),blon=Number(b?.lon);
 if(![lat,lon,blat,blon].every(Number.isFinite))return Infinity;
 return Math.hypot((lat-blat)*111195,(lon-blon)*111195*Math.cos(lat*Math.PI/180));
}
export function groupJourneyChoices(ordered=[]){
 const groups=[],families=new Map();
 for(const entry of ordered){
  const trip=entry?.trip,first=trip?.legs?.[0];if(!first)continue;
  const key=[first.type,line(first.name),Math.round(first.departure/60)].join('|');
  const indexes=families.get(key)||[];
  const group=indexes.map(i=>groups[i]).find(g=>meters(g.primary.trip.legs[0].fromStop,first.fromStop)<450);
  if(group){group.alternatives.push(entry);continue}
  indexes.push(groups.push({primary:entry,alternatives:[]})-1);families.set(key,indexes);
 }
 return groups;
}
