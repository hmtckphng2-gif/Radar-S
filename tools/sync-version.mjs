/* Radar 9.6 - one version for the whole project.
 *
 * Every "?v=" in the app is a cache buster. Keeping them in sync by hand is
 * exactly the kind of work that gets forgotten: a forgotten buster leaves an
 * old file in the browser cache, and an old file can then fight with the
 * new one. That happened with the version display in 8.4.
 *
 * This tool derives every buster from the version in package.json:
 *
 *   node tools/sync-version.mjs            rewrite all ?v= to the package version
 *   node tools/sync-version.mjs --check    only report, exit 1 if something differs
 *
 * `npm run check` uses the check mode, `npm run sync` rewrites.
 *
 * Two things are done:
 *
 * 1. Every existing "?v=" is set to the package version.
 * 2. Every **relative import** inside the app gets a buster, even if it had
 *    none. The modules import each other without a buster, so after a
 *    release the browser could mix a new index.html with an old core.js.
 *    With the offline shell that would be a real mix of two versions.
 *
 * Only the app itself is touched. The worker entry points keep plain paths,
 * because the worker resolves them from the disk, where "?v=" does not
 * exist as a file name.
 */
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const checkOnly=process.argv.includes('--check');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const version=String(pkg.version||'');
if(!version)throw new Error('package.json hat keine Version');

// Every ?v= in these files is a cache buster. Nothing else uses that pattern.
const BUSTER=/(\?v=)[0-9][0-9A-Za-z.\-]*/g;
// A module specifier that points at a local file. Both "./x.js" and "/x.js"
// are used in the app, and both can already carry a buster.
const SPEC=/((?:import\s+(?:[^'";]*?\s+from\s+)?|import\s*\(|export\s+[^'";]*?\s+from\s*)['"])((?:\.{1,2}\/|\/)[^'"?#]+)(\?[^'"]*)?(['"])/g;
// The same, but only relative paths, for finding the app graph.
const RELATIVE_SPEC=/((?:import\s+(?:[^'";]*?\s+from\s+)?|import\s*\(|export\s+[^'";]*?\s+from\s*)['"])(\.{1,2}\/[^'"?#]+)(\?[^'"]*)?(['"])/g;

const publicDir=path.join(root,'public');
const isFile=async p=>{try{return (await stat(p)).isFile()}catch{return false}};

async function collect(){
  const files=[];
  const html=await readFile(path.join(root,'public/index.html'),'utf8');
  files.push({name:'public/index.html',content:html});
  const entries=await readdir(publicDir,{withFileTypes:true});
  for(const entry of entries){
    if(!entry.isFile())continue;
    if(!/\.(js|mjs)$/.test(entry.name))continue;
    const name='public/'+entry.name;
    files.push({name,content:await readFile(path.join(root,name),'utf8')});
  }
  return files;
}

// The app graph: everything index.html loads, and everything those files
// import. Files that no page loads are separate entry points (the worker)
// and keep their plain paths.
async function appGraph(){
  const html=await readFile(path.join(publicDir,'index.html'),'utf8');
  const queue=[];
  for(const m of html.matchAll(/(?:src|href)\s*=\s*["'](\/[^"'#?]+)(?:\?[^"']*)?["']/g)){
    const rel=decodeURIComponent(m[1].slice(1));
    if(/\.(js|mjs)$/.test(rel))queue.push(rel);
  }
  for(const m of html.matchAll(/<script[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g)){
    for(const s of m[1].matchAll(RELATIVE_SPEC))queue.push(path.posix.normalize(s[2]));
  }
  const graph=new Set();
  while(queue.length){
    const rel=queue.shift();
    if(!rel||graph.has(rel))continue;
    if(!/\.(js|mjs)$/.test(rel))continue;
    // A worker entry point is resolved from the disk, a buster would break it.
    if(/worker/i.test(path.basename(rel)))continue;
    if(!await isFile(path.join(publicDir,rel)))continue;
    graph.add(rel);
    const source=await readFile(path.join(publicDir,rel),'utf8');
    for(const m of source.matchAll(SPEC)){
      // A leading slash points at the root of the public folder.
      queue.push(m[2].startsWith('/')
        ? m[2].slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(rel),m[2])));
    }
  }
  return graph;
}

const graph=await appGraph();
const files=await collect();
const changed=[];
let total=0;
let added=0;
for(const file of files){
  const matches=file.content.match(BUSTER);
  total+=matches?matches.length:0;
  let updated=file.content.replace(BUSTER,(_,prefix)=>prefix+version);
  // Only the app graph gets new busters. Everything else keeps its paths.
  if(graph.has(file.name.replace(/\\/g,'/').replace(/^public\//,''))){
    let addedHere=0;
    updated=updated.replace(SPEC,(all,head,target,query,tail)=>{
      if(query&&query.includes('?v='))return all;
      addedHere++;
      return head+target+'?v='+version+tail;
    });
    if(addedHere){
      added+=addedHere;
    }
  }
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
    if(added)console.log('Neue Cache-Buster in '+added+' Import(en) ergaenzt.');
  }
}else{
  console.log('Alle '+total+' Cache-Buster stehen auf '+version+'.');
}
