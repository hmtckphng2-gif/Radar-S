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
//
// The models are compressed with Meshopt. Its decoder is a separate module
// that carries the WebAssembly binary inline, so nothing else has to be
// loaded and the decoder works offline once it is cached.
const GLTF_URL='https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
const MESHOPT_URL='https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/libs/meshopt_decoder.module.js';
let loaderPromise;
export function loadGLTFLoader(){
  return loaderPromise??=(Promise.all([import(GLTF_URL),import(MESHOPT_URL)])
    .then(([mod,decoder])=>{
     const Loader=mod.GLTFLoader||mod.default?.GLTFLoader;
     if(!Loader)throw Error('GLTFLoader nicht verfuegbar');
     const loader=new Loader();
     const Meshopt=decoder.MeshoptDecoder||decoder.default?.MeshoptDecoder;
     if(Meshopt&&typeof loader.setMeshoptDecoder==='function')loader.setMeshoptDecoder(Meshopt);
     return loader;
    })
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
//
// scaleBy decides which real dimension is the reference:
// "length" scales the long axis to lengthMeters, "height" scales the
// vertical axis to heightMeters. A train reads better from its height, a bus
// from its length. Either way the model is measured, never assumed.
export function normalizeModel(object3D,spec,THREE){
  if(!object3D||!spec)return null;
  const length=Number(spec.lengthMeters),height=Number(spec.heightMeters);
  if(!Number.isFinite(length)||length<=0)return null;
  const {box,size}=measureModel(object3D,THREE);
  const longIsX=size.x>size.z;
  const longest=longIsX?size.x:size.z;
  if(!Number.isFinite(longest)||longest<=0)return null;
  const byHeight=spec.scaleBy==='height'&&Number.isFinite(height)&&height>0&&size.y>0;
  const basis=byHeight?size.y:longest;
  const reference=byHeight?height:length;
  const scale=reference/basis;
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
  // Manche Modelle sind um 180 Grad falsch herum authored. frontAxis sagt,
  // wo die Nase des Modells liegt: Standard ist -z, '+z' dreht es um 180 Grad.
  holder.rotation.y+=frontAxisYaw(spec);
  return {object:holder,scale,rotated:longIsX,scaledBy:byHeight?'height':'length',sourceSize:{x:size.x,y:size.y,z:size.z},realHeight:byHeight?height:size.y*scale};
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
  try{config=await loadModelConfig()}catch(error){console.error('[Radar 3D] model config load failed',error);throw error}
  const entry=config?.models?.[kind];
  if(!entry||!entry.file)return null;
  if(!THREE)return null;
  let loader=null;
  try{loader=await loadGLTFLoader()}catch(error){console.error('[Radar 3D] GLTFLoader/decoder import failed',error);throw error}
  if(!loader)return null;
  const url='/models/'+String(entry.file).replace(/^\/+/,'');
  const gltf=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Modell-Download zu langsam')),Math.max(1000,Number(timeoutMs)||8000));
    try{
      loader.load(url,(data)=>{clearTimeout(timer);resolve(data)},undefined,(err)=>{clearTimeout(timer);reject(err||Error('Modell nicht ladbar'))});
    }catch(error){clearTimeout(timer);reject(error)}
  });
  const scene=gltf?.scene;
  if(!scene)return null;
  // South Tyrol regional liveries are applied at runtime so the original
  // CC BY GLBs and their Meshopt-compressed buffers/textures remain intact.
  // This is a visual livery treatment, not a claim that the source mesh is an
  // exact ETR 170 / local fleet model. Keep glass, rubber, lights and interiors.
  const liveryMaterials=[];
  scene.traverse((node)=>{
    if(!node.isMesh||!node.material)return;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const original of mats){
      if(!original||!original.color)continue;
      const material=original.clone();
      const label=String(node.name+' '+original.name).toLowerCase();
      if(kind==='bus'){
        if(/glass|window|wheel|tire|tyre|rubber|mirror|dash|interior|gauge|light|lamp/.test(label))continue;
        // Yellow body paint; the texture is preserved and modulated, not replaced.
        material.color.set('#f1c928');
        liveryMaterials.push(material);
      }else{
        if(/glass|window|wheel|tire|tyre|rubber|mirror|interior|light|lamp/.test(label))continue;
        // Neutral metallic silver base; original texture details remain visible.
        material.color.set('#d7dce0');
        liveryMaterials.push(material);
      }
    }
    if(Array.isArray(node.material)){
      node.material=node.material.map(m=>{const found=liveryMaterials.find(x=>x.name===m.name&&x!==m);return found||m});
    }else{const found=liveryMaterials.find(x=>x.name===node.material.name&&x!==node.material);if(found)node.material=found;}
  });
  const normalized=normalizeModel(scene,entry,THREE);
  if(!normalized)return null;
  // Fine accent bands sit on the exterior sides in model metres. Since these
  // are children of the normalized holder, they inherit the measured model scale.
  const accents=new THREE.Group(); accents.name='radar-regional-livery-accents';
  const band=(width,height,length,x,y,z,color)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,length),new THREE.MeshBasicMaterial({color,roughness:.7}));
    mesh.position.set(x,y,z);mesh.name='radar-livery-accent';accents.add(mesh);
  };
  if(kind==='train'){
    for(const side of [-1,1]){
      band(.018,.105,42.0,side*1.415,1.52,0,'#b73b32');
      band(.019,.035,42.0,side*1.422,1.435,0,'#e28b32');
    }
  }else{
    for(const side of [-1,1]){
      band(.018,.19,10.7,side*1.29,1.62,0,'#c8cdd1');
      band(.019,.045,10.7,side*1.30,1.505,0,'#e4e7e9');
    }
  }
  normalized.object.add(accents);
  return {object:normalized.object,scale:normalized.scale,credit:entry.credit||null,url};
}

// A cheap contact shadow so the vehicle reads as standing on the ground
// instead of floating above it. Two flat discs with different opacity give a
// soft falloff. No texture, no shadow map, no canvas - that would be far too
// heavy for a phone and would not be testable outside the browser.
export function makeContactShadow(T,radius=1){
  const group=new T.Group();
  group.name='radar-contact-shadow';
  for(const [scale,opacity] of [[1,0.28],[1.55,0.1]]){
    const mesh=new T.Mesh(
      new T.CircleGeometry(radius*scale,24),
      new T.MeshBasicMaterial({color:0x000000,transparent:true,depthWrite:false,opacity})
    );
    mesh.rotation.x=-Math.PI/2;
    mesh.position.y=0.02;
    mesh.renderOrder=-1;
    group.add(mesh);
  }
  group.position.y=0.02;
  return group;
}

/* The schematic fallback geometry. It is deliberately simple and is used
 * whenever no real model is configured or available. It is an illustration,
 * never a claim about the real vehicle type.
 *
 * The train follows the proportions of a modern regional EMU such as a FLIRT:
 * 44.5 m long, 2.80 m wide, 3.5 m high, three body segments, a continuous
 * window band with recessed doors, a blue band with a red accent line, a
 * rounded cab at both ends and a raised pantograph on the middle segment.
 * All measures are physical metres: +y up, -z is the front, +x is right.
 */
// The extra turn a model needs so that its nose ends up at -z, the direction
// the app expects. The app wants the nose at -z because the 3D transform
// (see modelWorldDirection) turns a model nose at -z exactly along the
// heading, that is along the direction of travel.
export function frontAxisYaw(spec){
  return spec&&spec.frontAxis==='+z'?Math.PI:0;
}
export function makeVehicleMesh(T,kind){
  const bus=kind==='bus',root=new T.Group();
  const mat=(hex,metalness=.15,roughness=.67)=>new T.MeshStandardMaterial({color:hex,metalness,roughness});
  const white=mat(0xf2f5f7,.24,.5), blue=mat(0x1c4f86,.3,.5),red=mat(0xc0392b,.18,.5);
  const orange=mat(0xd8862c,.2,.55),glass=mat(0x16283a,.2,.28),black=mat(0x1b2129),rubber=mat(0x15191f);
  const silver=mat(0x9aa9b4,.45,.38),light=mat(0xfff6e0,.1,.4),door=mat(0x33404e,.16,.55);
  function box(w,h,d,x,y,z,material,parent=root,rx=0){
   const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
   mesh.position.set(x,y,z);if(rx)mesh.rotation.x=rx;parent.add(mesh);return mesh;
  }
  function wheels(zPositions,axleY,width,radius=.42){
   for(const z of zPositions)for(const side of [-1,1]){
    const wheel=new T.Mesh(new T.CylinderGeometry(radius,radius,.20,14),rubber);
    wheel.rotation.z=Math.PI/2;wheel.position.set(side*(width/2+.02),axleY,z);root.add(wheel);
    const hub=new T.Mesh(new T.CylinderGeometry(radius*.44,radius*.44,.08,14),silver);
    hub.rotation.z=Math.PI/2;hub.position.set(side*(width/2+.06),axleY,z);root.add(hub);
   }
  }
  if(bus){
   /* 12 m low floor city bus, 2.55 m wide, 3.15 m high. */
   box(2.55,2.06,11.6,0,1.62,0,white);
   box(2.46,.26,11.4,0,2.74,0,white);
   box(2.58,.40,11.5,0,1.30,0,orange);
   box(2.60,.09,11.4,0,1.10,0,red);
   for(const side of [-1,1]){
    for(let z=-4.9;z<=4.9;z+=1.28)box(.06,.92,1.08,side*1.285,2.20,z,glass);
    box(.08,1.92,1.30,side*1.27,1.60,-3.9,door);
    box(.10,.80,.56,side*1.29,2.10,-3.9,glass);
    box(.10,.80,.56,side*1.29,2.10,3.9,glass);
    box(.09,.16,11.2,side*1.30,1.05,0,red);
    box(.10,1.70,.12,side*1.30,1.86,-1.6,black);
   }
   box(2.30,1.05,.16,0,2.05,-5.86,glass,root,-.07);
   box(2.20,.22,.14,0,1.16,-5.90,black);
   box(1.20,.22,1.30,0,2.92,0,silver);
   for(const x of [-.86,.86]){
    box(.30,.17,.12,x,1.30,-5.88,light);
    box(.28,.15,.12,x,1.28,5.88,red);
   }
   wheels([-3.85,3.25],.44,2.55,.44);
  }else{
   /* Three segments: 15.0 m in the middle, 12.0 m outside, rounded cabs. */
   const segments=[{center:0,length:15.0},{center:-13.5,length:12.0},{center:13.5,length:12.0}];
   for(const seg of segments){
    const coach=new T.Group();root.add(coach);
    const c=seg.center,l=seg.length;
    // Karosserie
    box(2.80,2.64,l,0,2.10,c,white,coach);
    box(2.62,.14,l-.2,0,3.46,c,white,coach);
    // Blaues Band mit rotem Zierstreifen, leicht vorstehend
    box(2.84,.42,l-.1,0,1.78,c,blue,coach);
    box(2.85,.10,l-.2,0,1.51,c,red,coach);
    // Fensterband in Abschnitten, Tueren dazwischen
    const winCount=seg.length>13?7:6;
    for(const side of [-1,1]){
     for(let i=0;i<winCount;i++){
      const dz=-l/2+1.1+(i+0.5)*((l-2.2)/winCount);
      box(.06,.86,(l-2.2)/winCount-.42,side*1.42,2.64,c+dz,glass,coach);
     }
     for(const dz of [-l/2+1.85,l/2-1.85]){
      box(.08,1.98,1.28,side*1.41,1.74,c+dz,door,coach);
      box(.10,.80,.56,side*1.43,2.80,c+dz,glass,coach);
     }
     box(.04,.12,l-.3,side*1.44,1.51,c,red,coach);
    }
    // Dachgeraete
    box(1.26,.26,4.8,0,3.62,c-1.8,silver,coach);
    if(seg.center===0)box(.9,.18,2.2,0,3.60,c+3.4,silver,coach);
   }
   // Gerundete FLIRT-Stirn mit geneigter Frontscheibe, Lichtgruppen und tiefer Schuerze.
   // The downloaded RABe 523 GLB remains the primary model; this is the fallback.
   for(const side of [-1,1]){
    // Two stepped, sloped body sections approximate the FLIRT cab without
    // introducing a new geometry class or extra GPU cost on mobile Safari.
    box(2.70,1.88,2.35,0,2.00,side*20.05,white,root,side*-0.085);
    box(2.42,.76,.72,0,2.60,side*20.96,white,root,side*-0.12);
    // Dark windscreen surround, divided panoramic glass and destination display.
    box(2.12,1.06,.09,0,2.82,side*21.23,black,root,side*-0.17);
    box(1.92,.86,.07,0,2.82,side*21.30,glass,root,side*-0.17);
    box(.045,.78,.035,0,2.82,side*21.345,black,root,side*-0.17);
    box(1.36,.18,.08,0,3.39,side*20.98,black,root);
    // The lower blue mask and stainless lower skirt define the FLIRT nose.
    box(2.34,.26,.14,0,1.34,side*21.34,blue,root);
    box(2.16,.13,.12,0,1.18,side*21.31,silver,root);
    box(2.06,.20,.14,0,3.04,side*20.92,white,root);
    for(const x of [-.91,.91]){
     box(.30,.18,.12,x,1.66,side*21.32,light,root);
     box(.18,.08,.12,x,1.43,side*21.35,red,root);
     box(.12,.34,.18,x*1.53,2.72,side*20.42,black,root,side*-.08);
     box(.10,.16,.11,x*1.53,2.78,side*20.48,silver,root);
    }
    // Fine wiper strokes on the windscreen; these are intentionally subtle at map scale.
    const wiperL=box(.58,.035,.025,-.30,2.53,side*21.36,black,root,side*-.04);
    wiperL.rotation.z=-.12;
    const wiperR=box(.58,.035,.025,.30,2.53,side*21.36,black,root,side*.04);
    wiperR.rotation.z=.12;
   }
   // Dachstromabnehmer auf dem mittleren Segment
   function rod(a,b,r=.065){
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),dv=vb.clone().sub(va);
    const m=new T.Mesh(new T.CylinderGeometry(r,r,dv.length(),6),silver);
    m.position.copy(va).add(vb).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dv.normalize());root.add(m);
   }
   rod([-.66,3.54,-1.2],[0,4.24,-.5]);rod([.66,3.54,-1.2],[0,4.24,-.5]);
   rod([0,4.24,-.5],[-.64,4.42,.5]);rod([0,4.24,-.5],[.64,4.42,.5]);
   rod([-.72,4.42,.5],[.72,4.42,.5],.075);
   // Drehgestelle
   wheels([-19.9,-16.6,-5.4,-2.2,2.2,5.4,16.6,19.9],.42,2.80);
  }
  root.userData={schematic:true,kind:bus?'bus':'train',label:VEHICLE_SPECS[bus?'bus':'train'].label};
  return root;
}
