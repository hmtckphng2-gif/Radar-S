/* Radar 4.4 — pure presentation/network helpers; no location prediction. */
export const normalizeMode = value => value === 'classic' ? 'classic' : 'radar';
export function labelPolicy(zoom,kind,selected=false){
 if(selected)return {number:true,delay:true};
 return {number:zoom>=14||(kind==='train'&&zoom>=12),delay:zoom>=14};
}
export function groupNearby(points,radius=42,selectedKey=null){
 const items=(points||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 const eligible=items.filter(p=>p.key!==selectedKey);
 const chosen=items.some(p=>p.key===selectedKey)?[selectedKey]:[];
 const cell=Math.max(1,radius), buckets=new Map(),parent=eligible.map((_,i)=>i);
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{const pa=find(a),pb=find(b);if(pa!==pb)parent[pb]=pa;};
 for(let i=0;i<eligible.length;i++){
  const p=eligible[i],gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
   for(const j of buckets.get(x+':'+y)||[]){
    const q=eligible[j]; if((p.x-q.x)**2+(p.y-q.y)**2<=radius**2)join(i,j);
   }
  }
  const key=gx+':'+gy;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);
 }
 const groups=new Map();
 eligible.forEach((p,i)=>{const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(p);});
 const clusters=[],singles=[...chosen];
 for(const g of groups.values()){
  if(g.length===1){singles.push(g[0].key);continue;}
  clusters.push({keys:g.map(p=>p.key),count:g.length,
   buses:g.filter(p=>p.kind==='bus').length,trains:g.filter(p=>p.kind==='train').length,
   staleCount:g.filter(p=>p.stale).length,
   x:g.reduce((s,p)=>s+p.x,0)/g.length,y:g.reduce((s,p)=>s+p.y,0)/g.length});
 }
 return {clusters,singles};
}
export function safeDelay(info,feedStatus){
 if(feedStatus!=='ok'||!info||!Number.isFinite(Number(info.delay)))return null;
 const n=Math.round(Number(info.delay)/60);
 return {minutes:n,label:(n>0?'+':n<0?'−':'')+Math.abs(n)+' Min.',
  tone:n>=10?'high':n>=5?'medium':n>=1?'low':'on-time',basis:info.basis||'unbekannt'};
}
export function networkLabel({online=true,age=0}={}){
 if(online===false)return 'Offline · letzte bekannte Daten';
 if(Number.isFinite(age)&&age>180)return 'Daten seit '+Math.floor(age/60)+' Min. nicht aktualisiert';
 return '';
}
// Strictly a shape split at a measured position; no route guess or ETA.
export function routeProgress(path,along,referenceLat){
 if(!Array.isArray(path)||path.length<2||!Number.isFinite(along)||along<0)return null;
 const cos=Math.cos((referenceLat||path[0][0])*Math.PI/180), past=[path[0]], future=[];
 let distance=0,cut=false;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i];
  if(![...a,...b].every(Number.isFinite))return null;
  const seg=Math.hypot((b[1]-a[1])*cos,b[0]-a[0])*111195;
  if(!cut && along<=distance+seg){
   const f=seg>0?Math.max(0,Math.min(1,(along-distance)/seg)):0;
   const at=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
   past.push(at);future.push(at,b);cut=true;
  }else if(!cut)past.push(b);
  else future.push(b);
  distance+=seg;
 }
 if(!cut)future.push(path.at(-1));
 return {past,future};
}
