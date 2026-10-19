/* Radar 7.0.3 – journey advisor UI; facts and model output are clearly separated. */
import {orderJourneys,explainRecommendation,answerLocally,summarizeJourneyOptions} from './radar703-advisor.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const btn=(name,cb)=>{const n=el('button','sr703-action',name);n.type='button';n.onclick=cb;return n};
function clk(s){return Number.isFinite(s)?String(Math.floor(s/3600)%24).padStart(2,'0')+':'+String(Math.floor((s%3600)/60)).padStart(2,'0'):'–'}
export function mountJourneyAdvisor(stage,journeys,sortMode,onSort){
 const ranked=orderJourneys(journeys,'recommended'),chosen=ranked[0];
 const box=el('section','sr703-coach');
 const kicker=el('div','sr703-kicker','RADAR REISEBERATUNG · FAHRPLANBASIERT');
 box.append(kicker);
 if(chosen){
  const top=el('div','sr703-choice');
  top.append(el('strong','','Empfehlung: '+clk(chosen.trip.departure)+' → '+clk(chosen.trip.arrival)),el('p','',explainRecommendation(chosen)));
  box.append(top);
 }else box.append(el('p','sr703-hint','Sobald Verbindungen verfügbar sind, kann Radar sie vergleichen.'));
 const sort=el('div','sr703-sort'),label=el('label','','Sortierung'),select=el('select');label.htmlFor='sr703Sort';select.id='sr703Sort';
 for(const [value,title] of [['recommended','Empfohlen'],['departure','Früheste Abfahrt'],['fastest','Schnellste'],['fewest','Wenigste Umstiege']]){
  const option=el('option','',title);option.value=value;select.append(option)}
 select.value=sortMode;select.onchange=()=>onSort(select.value);sort.append(label,select);box.append(sort);
 const chat=el('details','sr703-chat'),summary=el('summary','','Reiseberater fragen · KI · Cloudflare');
 chat.append(summary,el('p','sr703-hint','Radar vergleicht ausschließlich die angezeigten Fahrplandaten. KI-Antworten stammen von Cloudflare Workers AI, falls die Binding auf dem Worker aktiv ist. Bei Nichtverfügbarkeit hilft die fahrplanbasierte Logik.'));
 const input=el('textarea','sr703-question');input.rows=2;input.maxLength=240;input.placeholder='Welche Verbindung empfiehlst du und warum?';
 input.setAttribute('aria-label','Frage zu den angezeigten Verbindungen');
 const answer=el('p','sr703-answer');answer.setAttribute('aria-live','polite');answer.hidden=true;
 const send=btn('Antwort erhalten',async()=>{
  const q=input.value.trim();if(!q)return;send.disabled=true;answer.hidden=false;
  answer.textContent='Prüfe passende Verbindungen …';
  try{
   const response=await fetch('/api/ai/journey',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({question:q,options:summarizeJourneyOptions(journeys)}),signal:AbortSignal.timeout(14000)});
   const obj=await response.json();
   if(response.ok&&typeof obj.answer==='string'&&obj.answer.trim()){answer.textContent='KI-Antwort (kein offizieller Fahrplan): '+obj.answer.slice(0,1100);return;}
   answer.textContent='Cloudflare AI gerade nicht verfügbar. '+answerLocally(q,journeys);
  }catch{
   answer.textContent='Cloudflare AI gerade nicht verfügbar. '+answerLocally(q,journeys);
  }finally{send.disabled=false}
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();send.click()}});
 chat.append(input,send,answer);box.append(chat);stage.append(box);
 return ranked[0]?.index??null;
}