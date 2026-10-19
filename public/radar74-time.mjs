/* Radar 7.4 – spatially grounded timetable-equivalent time, not a GTFS-RT delay.
 * Only interpolate within the verified current stop-to-stop segment.
 * Does not infer velocity, predict arrivals, or declare simulated positions live.
 */
export function timetablePositionTiming(calc,vehicle={},options={}){
 if(!calc || !Number.isFinite(calc.observedMeters)||!Number.isFinite(calc.plannedMeters))return null;
 const start=Number(calc.segmentStartMeters),end=Number(calc.segmentEndMeters);
 const dep=Number(calc.segmentStartSeconds),arr=Number(calc.segmentEndSeconds);
 if(![start,end,dep,arr].every(Number.isFinite)||end-start<100||arr-dep<60||arr-dep>7200)return null;
 // Return 'outside segment', not a deceptively precise extrapolation.
 const margin=25;
 if(calc.observedMeters<start-margin||calc.observedMeters>end+margin)return {
  status:'outside',minutes:null,reason:'Feedposition liegt außerhalb des gerade verglichenen Fahrplanabschnitts.'
 };
 const fraction=Math.max(0,Math.min(1,(calc.observedMeters-start)/(end-start)));
 const fractionPlanned=Math.max(0,Math.min(1,(calc.plannedMeters-start)/(end-start)));
 const gapSeconds=(fractionPlanned-fraction)*(arr-dep);
 const minutes=Math.round(gapSeconds/60*10)/10;
 const type=String(vehicle.positionType||'').toLowerCase();
 const simulated=/simulier|geschätz|geschaetz|interpol|modell|estimated|inferred/.test(type);
 const fractionGap=Math.abs(calc.observedMeters-calc.plannedMeters)/(end-start);
 const unusual=fractionGap>.7;
 return {status:'model',minutes,absoluteMinutes:Math.abs(minutes),
  direction:minutes>0?'hinter':minutes<0?'vor':'gleichauf',
  confidence:simulated||unusual?'niedrig':'eingeschränkt',
  simulated,segmentMeters:end-start,segmentSeconds:arr-dep,
  reason:simulated?'Position laut Quelle geschätzt/simuliert – kein GPS-Nachweis.':
   'Aus dem linearen Haltestellen-Fahrplan modelliert; keine gemessene Verspätung.'};
}
export function timeDifferenceLabel(v){
 if(!v)return 'Zeitlicher Sollvergleich nicht berechenbar';
 if(v.status==='outside')return 'Zeitlicher Sollvergleich außerhalb des aktuellen Abschnitts';
 if(v.status!=='model'||!Number.isFinite(v.minutes))return 'Zeitlicher Sollvergleich nicht berechenbar';
 if(Math.abs(v.minutes)<.05)return 'Modelliert: ungefähr auf Sollhöhe';
 const text=Math.abs(v.minutes).toLocaleString('de-DE',{maximumFractionDigits:1,minimumFractionDigits:1});
 return 'Modelliert: ca. '+text+' Min. '+(v.minutes>0?'hinter':'vor')+' dem Soll';
}
