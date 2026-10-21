/* Radar 8.3/8.5 - the 3D vehicle model.
 *
 * The schematic geometry below is a FLIRT-inspired regional EMU silhouette.
 * It is illustrative, NOT proof of the actual vehicle model. Coordinates are
 * physical metres: +y up, -z is front, +x is right.
 *
 * Two sources, in this order:
 * 1. A real downloaded model (public/models/<kind>.glb), if one is configured.
 *    Those models are CC BY and need the author credited - see models/CREDITS.md.
 * 2. The hand built schematic geometry at the bottom of this file, which is
 *    always available and never needs a download.
 *
 * The schematic model is the fallback. If the file is missing, the download
 * fails or it takes too long, the 3D view keeps working. The app never
 * depends on a download.
 *
 * The downloaded model is measured, not guessed: its bounding box is scaled
 * to the real dimensions from models.json and put on the ground.
 */
export const VEHICLE_SPECS=Object.freeze({
  train:{label:'Regionalzug · FLIRT-inspiriertes 3D-Modell',length:44.5,width:2.8,height:4.1},
  bus:{label:'Linienbus · schematisches 3D-Modell',length:12,width:2.55,height:3.25}
});
export function vehicleKind(vehicle){return vehicle?.kind==='bus'?'bus':'train'}
export function validHeading(vehicle,ageLimit=120,now=Date.now()){
  const n=Number(vehicle?.bearing),ts=Number(vehicle?.timestamp);
  return vehicle?.bearing!==null&&vehicle?.bearing!==undefined&&vehicle?.bearing!==''&&!vehicle?.stale&&Number.isFinite(n)&&n>=0&&n<360&&Number.isFinite(ts)&&ts>1e9&&now/1000-ts<=ageLimit&&now/1000-ts>=-30?n:null;
}
export function modelYawRadians(degrees){return Number.isFinite(degrees)?-degrees*Math.PI/180:0}

// Three.js is loaded from the CDN as a single self contained module.
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
let threePromise;
export function loadThree(){return threePromise??=(import(THREE_URL).catch(e=>{threePromise=null;throw e}))}

// The GLTFLoader is loaded as a separate module from the same package. It
// imports "three" as a bare specifier, which the import map in index.html
// resolves to exactly the same file as THREE_URL. Both must stay identical,
// otherwise the loader would work with a second copy of three and every
// instanceof check would fail. tests/radar83-model.test.js guards that.
const GLTF_URL='https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
let loaderPromise;
export function loadGLTFLoader(){
  return loaderPromise??=(import(GLTF_URL)
    .then(m=>m.GLTFLoader||m.default?.GLTFLoader)
    .then(c=>{if(!c)throw Error('GLTFLoader nicht verfuegbar');return c})
    .catch(e=>{loaderPromise=null;throw e}));
}

export const MODEL_CONFIG_URL='/models/models.json';
let configPromise;
export function loadModelConfig(){
  return configPromise??=(fetch(MODEL_CONFIG_URL,{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('Keine Modellkonfiguration');return r.json()})
    .catch(e=>{configPromise=null;throw e}));
}

/* Pure geometry helpers. They take the loaded object and the real
 * dimensions and return a wrapper that stands on the ground, centred on its
 * own middle and turned so that its long axis runs along Z. */
export function measureModel(object3D,THREE){
  const box=new THREE.Box3().setFromObject(object3D);
  const size=new THREE.Vector3();
  box.getCenter(new THREE.Vector3());
  box.getSize(size);
  return {box,size};
}

// Scale a downloaded model to the real dimensions, put it on the ground and
// centre it. Returns null when the model cannot be measured.
export function normalizeModel(object3D,spec,THREE){
  if(!object3D||!spec)return null;
  const length=Number(spec.lengthMeters),height=Number(spec.heightMeters);
  if(!Number.isFinite(length)||length<=0)return null;
  const {box,size}=measureModel(object3D,THREE);
  const longIsX=size.x>size.z;
  const longest=longIsX?size.x:size.z;
  if(!Number.isFinite(longest)||longest<=0)return null;
  const scale=length/longest;
  // Centre the model in X and Z and lift its lowest point onto the ground.
  const centre=box.getCenter(new THREE.Vector3());
  object3D.position.x-=centre.x;
  object3D.position.z-=centre.z;
  object3D.position.y-=box.min.y;
  const holder=new THREE.Group();
  if(longIsX){
    const pivot=new THREE.Group();
    pivot.rotation.y=-Math.PI/2;
    pivot.add(object3D);
    holder.add(pivot);
  }else holder.add(object3D);
  holder.scale.setScalar(scale);
  const yaw=Number(spec.yawOffset);
  if(Number.isFinite(yaw)&&yaw)holder.rotation.y=yaw*Math.PI/180;
  return {object:holder,scale,rotated:longIsX,sourceSize:{x:size.x,y:size.y,z:size.z},realHeight:Number.isFinite(height)?height*scale:null};
}

// The visible credit line under the map. CC BY requires the author to be
// named, so a real model always names it. The schematic model is our own
// work and is labelled as schematic.
export function modelCreditText(credit,isReal){
  const c=isReal?credit:null;
  if(!c||!c.author||!c.license)return '3D-Modell schematisch · Position aus dem Datenfeed · Ziehen zum Schwenken';
  const title=c.title?c.title+' ':'';
  return '3D: '+title+'· '+c.author+' · '+c.license+' · Position aus dem Datenfeed · Ziehen zum Schwenken';
}

// Load a real model. Resolves to null when there is none or when anything
// goes wrong - the caller keeps the schematic model in that case.
export async function loadVehicleModel(kind,THREE,{timeoutMs=8000}={}){
  let config=null;
  try{config=await loadModelConfig()}catch{return null}
  const entry=config?.models?.[kind];
  if(!entry||!entry.file)return null;
  if(!THREE)return null;
  let loader=null;
  try{loader=await loadGLTFLoader()}catch{return null}
  if(!loader)return null;
  const url='/models/'+String(entry.file).replace(/^\/+/,'');
  const gltf=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Modell-Download zu langsam')),Math.max(1000,Number(timeoutMs)||8000));
    try{
      new loader().load(url,(data)=>{clearTimeout(timer);resolve(data)},undefined,(err)=>{clearTimeout(timer);reject(err||Error('Modell nicht ladbar'))});
    }catch(error){clearTimeout(timer);reject(error)}
  });
  const scene=gltf?.scene;
  if(!scene)return null;
  const normalized=normalizeModel(scene,entry,THREE);
  if(!normalized)return null;
  return {object:normalized.object,scale:normalized.scale,credit:entry.credit||null,url};
}

/* The schematic fallback geometry. It is deliberately simple and is used
 * whenever no real model is configured or available. It is a illustration,
 * never a claim about the real vehicle type. */
export function makeVehicleMesh(T,kind){
  const bus=kind==='bus',root=new T.Group();
  const mat=(hex,metalness=.15,roughness=.67)=>new T.MeshStandardMaterial({color:hex,metalness,roughness});
  const white=mat(0xecf1f3,.22,.52), blue=mat(0x144c79,.26,.52),orange=mat(0xd7a243,.19,.54);
  const glass=mat(0x1a344c,.18,.27),black=mat(0x1f252d),rubber=mat(0x1b222a);
  const silver=mat(0x93a8b3,.42,.4),light=mat(0xfff4d2,.12,.45);
  const red=mat(0xc33d46,.16,.5);
  function box(w,h,d,x,y,z,material,parent=root,rx=0){
   const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);if(rx)mesh.rotation.x=rx;parent.add(mesh);return mesh;
  }
  function wheels(zPositions,axleY,width){
   for(const z of zPositions)for(const side of [-1,1]){
    const wheel=new T.Mesh(new T.CylinderGeometry(.47,.47,.20,12),rubber);
    wheel.rotation.z=Math.PI/2;wheel.position.set(side*(width/2+.025),axleY,z);root.add(wheel);
    const hub=new T.Mesh(new T.CylinderGeometry(.20,.20,.215,12),silver);
    hub.rotation.z=Math.PI/2;hub.position.set(side*(width/2+.145),axleY,z);root.add(hub);
   }
  }
  if(bus){
   box(2.55,2.22,11.8,0,1.63,0,orange);
   box(2.54,.24,11.85,0,2.87,0,white);
   box(2.48,.22,11.6,0,.45,0,black);
   box(2.28,1.05,.10,0,2.05,-5.96,glass,root,-.08);
   box(2.25,.18,.13,0,.93,-6.015,blue);
   for(const side of [-1,1]){
    for(let z=-4.7;z<=4.9;z+=1.4)box(.065,.83,1.13,side*1.278,2.16,z,glass);
    box(.075,.20,10.8,side*1.285,1.25,0,blue);
    box(.085,1.8,.10,side*1.30,1.73,-1.75,white);
   }
   for(const x of [-.84,.84]){
    box(.43,.20,.10,x,1.22,-6.03,light);
    box(.37,.17,.10,x,1.18,5.98,red);
   }
   wheels([-3.95,3.30],.51,2.55);
   box(1.35,.12,1.4,0,3.06,.15,silver);
  }else{
   // Three articulated coaches, streamlined ends, dark panoramic windshields,
   // continuous side-window ribbon and roof pantograph.
   const centers=[-14.8,0,14.8];
   const coachLength=14.4,width=2.8;
   for(const center of centers){
    const coach=new T.Group();root.add(coach);
    box(width,2.63,coachLength,0,1.96,center,white,coach);
    box(width-.08,.22,coachLength+.04,0,3.385,center,blue,coach);
    box(width+.01,.28,coachLength+.02,0,1.48,center,blue,coach);
    box(width-.04,.21,coachLength-.1,0,.64,center,black,coach);
    for(const side of [-1,1]){
     for(let i=0;i<6;i++){
      const dz=-5.30+i*2.03;
      box(.055,.82,1.67,side*1.411,2.69,center+dz,glass,coach);
      box(.071,.10,1.72,side*1.436,2.20,center+dz,blue,coach);
     }
     // recognizable lowered access door
     box(.074,1.62,1.12,side*1.418,1.62,center+4.90,blue,coach);
     box(.081,.56,.72,side*1.459,2.14,center+4.9,glass,coach);
    }
   }
   // Rounded, slanted ends of the stylized EMU; geometry remains low-poly.
   box(2.74,1.85,1.65,0,1.86,-22.60,white,root,-.11);
   box(2.53,.94,.22,0,2.64,-23.47,glass,root,-.22);
   box(2.72,.27,.14,0,1.37,-23.50,blue);
   box(2.74,1.72,1.57,0,1.86,22.60,white,root,.11);
   box(2.51,.91,.20,0,2.65,23.43,glass,root,.20);
   for(const side of [-1,1]){
    box(.30,.18,.11,side*.89,1.64,-23.54,light);
    box(.29,.16,.11,side*.89,1.65,23.50,red);
   }
   wheels([-18.5,-10.5,-3.8,3.8,10.5,18.5],.58,2.8);
   // Roof appliances and low-poly pantograph silhouette (not accurate rail type).
   box(1.20,.22,5.8,0,3.64,.5,silver);
   function rod(a,b,r=.065){
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),dv=vb.clone().sub(va);
    const m=new T.Mesh(new T.CylinderGeometry(r,r,dv.length(),6),silver);
    m.position.copy(va).add(vb).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dv.normalize());root.add(m);
   }
   rod([-.70,3.72,-.55],[0,4.37,-.04]);rod([.70,3.72,-.55],[0,4.37,-.04]);
   rod([0,4.37,-.04],[-.68,4.57,.65]);rod([0,4.37,-.04],[.68,4.57,.65]);
   rod([-.83,4.57,.65],[.83,4.57,.65],.075);
  }
  root.userData={schematic:true,kind:bus?'bus':'train',label:VEHICLE_SPECS[bus?'bus':'train'].label};
  return root;
}
