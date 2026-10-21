/* Radar 8.5 - one version for the whole project.
 *
 * Every "?v=" in the app is a cache buster. Keeping 96 of them in sync by
 * hand is exactly the kind of work that gets forgotten: a forgotten buster
 * leaves an old file in the browser cache, and an old file can then fight
 * with the new one. That happened with the version display in 8.4.
 *
 * This tool derives every buster from the version in package.json:
 *
 *   node tools/sync-version.mjs            rewrite all ?v= to the package version
 *   node tools/sync-version.mjs --check    only report, exit 1 if something differs
 *
 * `npm run check` uses the check mode, `npm run sync` rewrites.
 */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const checkOnly=process.argv.includes('--check');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const version=String(pkg.version||'');
if(!version)throw new Error('package.json hat keine Version');

// Every ?v= in these files is a cache buster. Nothing else uses that pattern.
const BUSTER=/(\?v=)[0-9][0-9A-Za-z.\-]*/g;

async function collect(){
  const files=[];
  const html=await readFile(path.join(root,'public/index.html'),'utf8');
  files.push({name:'public/index.html',content:html});
  const entries=await readdir(path.join(root,'public'),{withFileTypes:true});
  for(const entry of entries){
    if(!entry.isFile())continue;
    if(!/\.(js|mjs)$/.test(entry.name))continue;
    const name='public/'+entry.name;
    files.push({name,content:await readFile(path.join(root,name),'utf8')});
  }
  return files;
}

const files=await collect();
const changed=[];
let total=0;
for(const file of files){
  const matches=file.content.match(BUSTER);
  total+=matches?matches.length:0;
  const updated=file.content.replace(BUSTER,(_,prefix)=>prefix+version);
  if(updated!==file.content){
    changed.push(file.name);
    if(!checkOnly)await writeFile(path.join(root,file.name),updated,'utf8');
  }
}

if(changed.length){
  if(checkOnly){
    console.error('Versionsabweichung gefunden ('+changed.length+' Datei(en)):');
    for(const name of changed)console.error('  '+name);
    console.error('Mit "npm run sync" korrigieren.');
    process.exitCode=1;
  }else{
    console.log('Cache-Buster auf '+version+' gesetzt: '+changed.length+' Datei(en), '+total+' Stellen.');
  }
}else{
  console.log('Alle '+total+' Cache-Buster stehen auf '+version+'.');
}
