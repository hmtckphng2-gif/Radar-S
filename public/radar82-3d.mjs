/* Radar 8.2: actual Three.js WebGL meshes anchored to a Leaflet vehicle position.
 * Only one selected vehicle gets a WebGL canvas. Never infer a real fleet type.
 */
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
let threePromise;
export function loadThree(){return threePromise??=(import(THREE_URL).catch(e=>{threePromise=null;throw e}))}
export function modelKind(vehicle){return vehicle?.kind==='bus'?'bus':'train'}
export function headingRadians(degrees){return Number.isFinite(degrees)?-degrees*Math.PI/180:0}
export function createVehicleMesh(T,kind){
 const root=new T.Group(),bus=kind==='bus';
 const shell=new T.MeshStandardMaterial({color:bus?0xe5b35c:0xe8eef5,metalness:.24,roughness:.45});
 const glass=new T.MeshStandardMaterial({color:0x24445c,metalness:.22,roughness:.25});
 const dark=new T.MeshStandardMaterial({color:0x252c35,roughness:.65});
 const lights=new T.MeshStandardMaterial({color:0xfff5d9,emissive:0xe7b26b,emissiveIntensity:.35});
 const box=(w,h,d,x,y,z,mat)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);root.add(mesh);return mesh};
 const length=bus?4.5:6.8;
 box(1.9,1.35,length,0,1.18,0,shell);
 box(1.77,.54,length-.38,0,1.85,0,glass);
 box(1.82,.10,length-.28,0,2.17,0,shell);
 box(1.72,.40,.07,0,1.85,-length/2-.005,glass);
 box(1.72,.28,.07,0,.9,-length/2-.04,dark);
 for(const side of [-1,1]){
  for(const z of (bus?[-1.45,1.45]:[-2.5,0,2.5])){
   const wheel=new T.Mesh(new T.CylinderGeometry(.33,.33,.16,16),dark);
   wheel.rotation.z=Math.PI/2;wheel.position.set(side*.98,.56,z);root.add(wheel);
  }
  for(let z=-length/2+.85;z<length/2-.4;z+=1.1)box(.025,.42,.07,side*.91,1.86,z,shell);
 }
 for(const x of [-.62,.62])box(.30,.17,.06,x,1.12,-length/2-.08,lights);
 if(!bus){box(1.86,.18,length-.3,0,.48,0,dark);box(.85,.14,2.2,0,2.31,.1,dark)}
 return root;
}
export class Vehicle3DOverlay{
 constructor(map){this.map=map;this.current=null;this.visible=false;this.disposed=false;this.sequence=0;this.update=()=>this.draw();map.on('move zoom resize',this.update)}
 async show(vehicle,point,heading){
  const id=++this.sequence;this.visible=true;this.current={vehicle,point,heading};
  try{
   const T=await loadThree();if(this.disposed||!this.visible||id!==this.sequence)return;
   if(!this.renderer){
    this.T=T;this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    this.renderer.setSize(190,190,false);
    this.canvas=this.renderer.domElement;this.canvas.className='sr82-model-canvas';
    this.canvas.setAttribute('aria-hidden','true');this.map.getContainer().append(this.canvas);
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(34,1,.1,100);
    this.camera.position.set(7,7,-10);this.camera.lookAt(0,1,0);
    this.scene.add(new T.HemisphereLight(0xffffff,0x64788b,2.1));
    const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(-4,9,-5);this.scene.add(sun);
   }
   const kind=modelKind(vehicle);
   if(this.kind!==kind){if(this.mesh){this.scene.remove(this.mesh);this.mesh.traverse(x=>{x.geometry?.dispose?.();if(x.material&&!Array.isArray(x.material))x.material.dispose?.()})}
    this.mesh=createVehicleMesh(T,kind);this.scene.add(this.mesh);this.kind=kind;
   }
   this.draw();
   document.body.classList.add('sr82-3d-active');
  }catch(e){console.info('Radar 8.2 3D unavailable; standard marker retained',e);this.hide();document.body.classList.remove('sr82-3d-active')}
 }
 draw(){
  if(!this.visible||!this.renderer||!this.current)return;
  const p=this.map.latLngToContainerPoint(this.current.point);
  const size=this.map.getSize();
  if(p.x< -100||p.y< -100||p.x>size.x+100||p.y>size.y+100){this.canvas.hidden=true;return}
  this.canvas.hidden=false;
  this.canvas.style.transform='translate3d('+Math.round(p.x-95)+'px,'+Math.round(p.y-130)+'px,0)';
  this.mesh.rotation.y=headingRadians(this.current.heading);
  this.renderer.render(this.scene,this.camera);
 }
 updatePoint(point,heading){if(!this.current)return;this.current.point=point;this.current.heading=heading;this.draw()}
 hide(){this.visible=false;this.sequence++;if(this.canvas)this.canvas.hidden=true}
 destroy(){this.disposed=true;this.hide();this.map.off('move zoom resize',this.update);this.renderer?.dispose();this.canvas?.remove()}
}
