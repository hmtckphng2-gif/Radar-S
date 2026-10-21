/* Radar 6.9 Journey Foundation — pure, deterministic helpers, no invented times. */
export function normalizeStop(value){
 if(!value||typeof value!=='object')return null;
 const id=String(value.id||value.stop_id||'').trim();
 if(!id)return null;
 return {id,name:String(value.name||value.stop_name||id),lat:Number.isFinite(+value.lat)?+value.lat:null,lon:Number.isFinite(+value.lon)?+value.lon:null};
}
export function normalizeCall(value){
 if(!value||typeof value!=='object')return null;
 const stop=String(value.stopId||value.stop_id||'').trim();
 const planned=Number(value.planned??value.departure);
 if(!stop||!Number.isFinite(planned)||planned<0)return null;
 const actual=Number(value.predicted);
 return {stopId:stop,planned,predicted:value.predicted===null||value.predicted===undefined||!Number.isFinite(actual)?null:actual};
}
export function indexJourneys(trips=[]){
 const byStop=new Map();
 for(const trip of trips){if(!trip||!Array.isArray(trip.calls))continue;
  const id=String(trip.id||'');if(!id)continue;
  for(let i=0;i<trip.calls.length;i++){const call=normalizeCall(trip.calls[i]);if(!call)continue;
   if(!byStop.has(call.stopId))byStop.set(call.stopId,[]);
   byStop.get(call.stopId).push({tripId:id,index:i,planned:call.planned,predicted:call.predicted});
  }
 }
 for(const list of byStop.values())list.sort((a,b)=>a.planned-b.planned);
 return byStop;
}
export function possibleTransfer(arrival,departure,minSeconds=180){
 if(!arrival||!departure)return {possible:null,reason:'Daten fehlen'};
 const a=arrival.predicted??arrival.planned,d=departure.predicted??departure.planned;
 if(!Number.isFinite(a)||!Number.isFinite(d))return {possible:null,reason:'Zeiten fehlen'};
 if(arrival.predicted===null||departure.predicted===null)return {possible:d-a>=minSeconds,reason:'Nur Fahrplanbasis',confirmed:false};
 return {possible:d-a>=minSeconds,reason:'Feedbasierte Prognose',confirmed:false};
}
