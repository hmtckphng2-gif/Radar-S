/* Radar 7.8: evidence-first vehicle quality; pure and testable. */
export function vehicleLiveQuality(vehicle,now=Date.now()){
 const age=Number.isFinite(Number(vehicle?.timestamp))&&Number(vehicle.timestamp)>1e9?Math.floor(now/1000-Number(vehicle.timestamp)):null;
 const estimated=/simuliert|geschätzt|interpoliert|estimated|simulated|calculated/i.test(String(vehicle?.positionType||''));
 if(vehicle?.stale||age===null||age< -30||age>300)return {kind:'last',label:'NICHT LIVE',age,estimated,live:false};
 if(estimated)return {kind:'estimated',label:'GESCHÄTZT',age,estimated:true,live:false};
 if(age>90)return {kind:'delayed',label:'VERZÖGERT',age,estimated:false,live:false};
 return {kind:'current',label:'MELDUNG AKTUELL',age,estimated:false,live:true};
}
export function sourceHealth(vehicles,now=Date.now()){
 const out={};for(const v of vehicles){const source=String(v.source||'unbekannt');const record=out[source]||(out[source]={total:0,current:0,delayed:0,estimated:0,last:0});record.total++;record[vehicleLiveQuality(v,now).kind]++}return out;
}
export function delayDiscrepancy(km,feedDelayMinutes){
 if(!Number.isFinite(km))return null;
 if(!Number.isFinite(feedDelayMinutes))return km>=2?'Räumliche Abweichung · keine bestätigte Minutenverspätung':null;
 return km>=2&&feedDelayMinutes<=1?'Auffällige Ist/Soll-Abweichung trotz geringer gemeldeter Minutenverspätung. Die Werte messen Unterschiedliches.':null;
}
