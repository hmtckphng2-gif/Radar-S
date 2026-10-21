/* Radar 8.5 - fetch a real 3D vehicle model from Sketchfab.
 *
 * Sketchfab models are downloadable for free, but the download needs a
 * personal access token. This script does the whole import in one step:
 * download the GLB, write it to public/models/, fill models.json and
 * CREDITS.md with the licence and the author.
 *
 *   1. Create a free token:  https://sketchfab.com/settings/password
 *      (Developer settings, or "Personal Access Token")
 *   2. Set it:
 *        Windows PowerShell:  $env:SKETCHFAB_TOKEN="sk-..."
 *        bash:                export SKETCHFAB_TOKEN="sk-..."
 *   3. Run:
 *        node tools/fetch-sketchfab-model.mjs --uid 3f45e0d560614aab98cee987cb7347e9 --kind train
 *        node tools/fetch-sketchfab-model.mjs --uid 6a5c6c970ab34a869c2be6b34c678aea --kind bus
 *
 * The model is only used if it is actually there. If the download fails,
 * nothing changes and the schematic model stays in place.
 */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';

const args=process.argv.slice(2);
const arg=(name,fallback='')=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]?args[i+1]:fallback;
};
const uid=arg('uid');
const kind=arg('kind','train');
const token=arg('token')||process.env.SKETCHFAB_TOKEN||'';
const root=process.cwd();
const modelsDir=path.join(root,'public','models');

if(!uid){
  console.error('Fehlt: --uid <Sketchfab-UID>');
  console.error('Beispiel: node tools/fetch-sketchfab-model.mjs --uid 3f45e0d560614aab98cee987cb7347e9 --kind train');
  process.exit(1);
}
if(!token){
  console.error('Fehlt: SKETCHFAB_TOKEN (Umgebungsvariable) oder --token');
  console.error('Ein kostenloses Token gibt es unter https://sketchfab.com/settings/password');
  process.exit(1);
}
if(!['train','bus'].includes(kind)){
  console.error('Unbekannte Fahrzeugart: '+kind+' (erlaubt: train, bus)');
  process.exit(1);
}

const api='https://api.sketchfab.com/v3/models/'+uid;
const headers={'User-Agent':'suedtirol-radar-model-import'};

console.log('== Modellinformationen ==');
const metaRes=await fetch(api,{headers});
if(!metaRes.ok){
  console.error('Modell nicht gefunden (HTTP '+metaRes.status+')');
  process.exit(1);
}
const meta=await metaRes.json();
const licence=meta.license?.label||'unbekannt';
const author=meta.user?.displayName||meta.user?.username||'unbekannt';
const title=meta.name||uid;
console.log('  Titel   : '+title);
console.log('  Autor   : '+author);
console.log('  Lizenz  : '+licence);
console.log('  Seite   : https://sketchfab.com/3d-models/'+uid);

if(!/CC|Creative Commons|Public Domain|CC0/i.test(licence)){
  console.error('\nAbbruch: Die Lizenz "'+licence+'" verlangt keine Namensnennung.');
  console.error('Die App muss den Autor sichtbar nennen, das geht nur mit einer CC-Lizenz.');
  process.exit(1);
}

console.log('\n== Download ==');
const dlRes=await fetch(api+'/download',{headers:{...headers,Authorization:'Bearer '+token}});
if(!dlRes.ok){
  console.error('Download nicht erlaubt (HTTP '+dlRes.status+'). Pruefe das Token und die Rechte.');
  process.exit(1);
}
const dl=await dlRes.json();
const gltfUrl=dl.gltf?.url;
if(!gltfUrl){
  console.error('Die API liefert keine GLB-URL. Verfuegbare Formate: '+Object.keys(dl).join(', '));
  process.exit(1);
}
const glbRes=await fetch(gltfUrl,{headers});
if(!glbRes.ok){
  console.error('GLB-Download fehlgeschlagen (HTTP '+glbRes.status+')');
  process.exit(1);
}
const buffer=Buffer.from(await glbRes.arrayBuffer());
if(buffer.length<4||buffer.toString('ascii',0,4)!=='glTF'){
  console.error('Die Datei ist kein gueltiges GLB (Magic "'+buffer.toString('ascii',0,4)+'")');
  process.exit(1);
}
await mkdir(modelsDir,{recursive:true});
const fileName=kind+'.glb';
const target=path.join(modelsDir,fileName);
await writeFile(target,buffer);
const size=(await stat(target)).size;
console.log('  Gespeichert: public/models/'+fileName+' ('+Math.round(size/1024)+' KB)');

console.log('\n== Konfiguration ==');
const configPath=path.join(modelsDir,'models.json');
const config=JSON.parse(await readFile(configPath,'utf8'));
const entry=config.models?.[kind];
if(!entry){
  console.error('Kein Eintrag fuer "'+kind+'" in models.json');
  process.exit(1);
}
entry.file=fileName;
entry.credit={title,author,license:licence,licenseUrl:meta.license?.url||'',source:'https://sketchfab.com/3d-models/'+uid};
await writeFile(configPath,JSON.stringify(config,null,2)+'\n','utf8');
console.log('  models.json aktualisiert (Credit eingetragen)');

console.log('\n== Naechste Schritte ==');
console.log('  1. Datei pruefen: public/models/'+fileName);
console.log('  2. Optional verkleinern:');
console.log('       npx @gltf-transform/cli optimize public/models/'+fileName+' --compress meshopt --texture-compress webp');
console.log('  3. "npm run verify" und dann committen.');
console.log('  4. Nach dem Download einmal auf dem Geraet pruefen: die Richtung');
console.log('     (yawOffset in models.json) stimmt eventuell noch nicht.');
