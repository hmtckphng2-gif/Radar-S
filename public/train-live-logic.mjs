/* Verified last-observed Trenitalia stop positions from operator-reported SIRI calls. */
const STOPS = new Map([{"id":"02224","name":"SETTEQUERCE","lat":46.508427,"lon":11.264795},{"id":"02033","name":"MAGRE'-CORTACCIA","lat":46.287961,"lon":11.232652},{"id":"02217","name":"MERANO-MAIA BASSA","lat":46.65619,"lon":11.147943},{"id":"02221","name":"GARGAZZONE","lat":46.576384,"lon":11.195482},{"id":"02223","name":"TERLANO-ANDRIANO","lat":46.528502,"lon":11.248399},{"id":"02222","name":"VILPIANO-NALLES","lat":46.554237,"lon":11.220146},{"id":"02017","name":"CHIUSA","lat":46.642573,"lon":11.572687},{"id":"02107","name":"BRUNICO","lat":46.794859,"lon":11.930001},{"id":"02111","name":"MONGUELFO-CASIES","lat":46.752697,"lon":12.107272},{"id":"02014","name":"BRESSANONE","lat":46.710053,"lon":11.649687},{"id":"02216","name":"MERANO","lat":46.67305,"lon":11.148991},{"id":"02034","name":"SALORNO","lat":46.24583,"lon":11.202687},{"id":"02030","name":"BRONZOLO","lat":46.405026,"lon":11.315842},{"id":"02011","name":"FORTEZZA","lat":46.788807,"lon":11.609929},{"id":"02059","name":"Bolzano Casanova","lat":46.480103,"lon":11.315188},{"id":"02103","name":"VANDOIES","lat":46.814778,"lon":11.723086},{"id":"02020","name":"PONTE GARDENA","lat":46.601167,"lon":11.53252},{"id":"02005","name":"COLLE ISARCO","lat":46.937924,"lon":11.441339},{"id":"02225","name":"PONTE D'ADIGE","lat":46.485422,"lon":11.297725},{"id":"02102","name":"RIO DI PUSTERIA","lat":46.797081,"lon":11.670032},{"id":"02219","name":"LANA-POSTAL","lat":46.608061,"lon":11.182255},{"id":"02016","name":"S.Lorenzo","lat":46.781378,"lon":11.90368},{"id":"02115","name":"Versciaco Elmo/Vierschach Helm","lat":46.731919,"lon":12.326038},{"id":"02031","name":"ORA","lat":46.3609,"lon":11.296786},{"id":"02110","name":"VALDAORA-ANTERSELVA","lat":46.769157,"lon":12.02899},{"id":"02226","name":"BOLZANO SUD","lat":46.472598,"lon":11.333341},{"id":"02001","name":"BRENNERO","lat":47.002213,"lon":11.505256},{"id":"02060","name":"Brunico Nord","lat":46.801602,"lon":11.941903},{"id":"02007","name":"CAMPO DI TRENS","lat":46.869042,"lon":11.488239},{"id":"02114","name":"S.CANDIDO","lat":46.732628,"lon":12.27192},{"id":"02006","name":"VIPITENO","lat":46.895707,"lon":11.440208},{"id":"02113","name":"DOBBIACO","lat":46.724958,"lon":12.225128},{"id":"02112","name":"VILLABASSA-BRAIES","lat":46.736409,"lon":12.167045},{"id":"02029","name":"LAIVES","lat":46.434069,"lon":11.32354},{"id":"02032","name":"EGNA-TERMENO","lat":46.319397,"lon":11.257177},{"id":"02105","name":"CASTELDARNE","lat":46.797654,"lon":11.844232},{"id":"02026","name":"BOLZANO","lat":46.496324,"lon":11.358568},{"id":"02018","name":"Perca","lat":46.790204,"lon":11.97894}].map(s => [s.id, s]));

const decode = s => String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();
const tag = (xml,name) => { const m=xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m?decode(m[1].replace(/<[^>]*>/g,'')):''; };
const trainNumber = id => { const m=String(id||'').match(/-(\d{2,6})-[A-Z0-9]+-0083(?:_|$)/); return m?m[1]:''; };
export function parseSiriTrainPositions(xml, now=Date.now()){
 const source=String(xml||'');
 const responseTime=Date.parse(tag(source,'ResponseTimestamp'));
 if(!Number.isFinite(responseTime)) return {timestamp:null,vehicles:[]};
 const vehicles=[];
 for(const match of source.matchAll(/<EstimatedVehicleJourney(?:\s[^>]*)?>([\s\S]*?)<\/EstimatedVehicleJourney>/g)){
  const journey=match[1], tripId=tag(journey,'DatedVehicleJourneyRef'), number=trainNumber(tripId), routeId=tag(journey,'LineRef');
  if(!number) continue;
  let latest=null;
  for(const callMatch of journey.matchAll(/<RecordedCall(?:\s[^>]*)?>([\s\S]*?)<\/RecordedCall>/g)){
   const call=callMatch[1], stopId=tag(call,'StopPointRef').split(':')[0];
   const stop=STOPS.get(stopId); if(!stop) continue;
   for(const field of ['ActualDepartureTime','ActualArrivalTime']){
    const raw=tag(call,field), time=Date.parse(raw);
    if(Number.isFinite(time)&&time<=now+60000&&(!latest||time>latest.time)) latest={time,stop,stopId};
   }
  }
  if(!latest) continue;
  const age=(now-latest.time)/1000;
  if(age< -60||age>1200) continue;
  vehicles.push({key:'trains:observed:'+tripId,kind:'train',lat:latest.stop.lat,lon:latest.stop.lon,source:'trains',timestamp:Math.floor(latest.time/1000),observedAt:Math.floor(latest.time/1000),name:'Zug '+number,headsign:'',vehicleId:number,routeId,tripId,positionType:'Letzter bestätigter Halt · Trenitalia',quality:age<=300?'aktuell':'verzögert',lastObservedStop:latest.stop.name});
 }
 return {timestamp:Math.floor(responseTime/1000),vehicles};
}
