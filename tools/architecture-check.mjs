import {readdir,readFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),failures=[];
const walk=async dir=>{let out=[];for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.wrangler'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out};
const all=await walk(root),code=all.filter(f=>/\.(m?js)$/.test(f)&&!f.endsWith('.min.js'));
const publicFiles=new Set(all.filter(f=>f.startsWith(path.join(root,'public')+path.sep)).map(f=>path.relative(path.join(root,'public'),f).replaceAll('\\','/')));
for(const f of code){
 const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8',timeout:18000});
 if(result.status!==0)failures.push('Syntax: '+path.relative(root,f)+' '+(result.stderr||result.error?.message||'').slice(0,140));
 if(!f.includes(path.sep+'public'+path.sep))continue;
 const source=await readFile(f,'utf8'),pattern=/(?:import\s+(?:[^'";]*?\s+from\s+)?|import\s*\(|export\s+[^'";]*?\s+from\s*)['"](\.\.?\/[^'"?#]+)(?:\?[^'"]*)?['"]/g;
 for(const m of source.matchAll(pattern)){
  const target=path.resolve(path.dirname(f),m[1]);
  try{const info=await stat(target);if(!info.isFile())failures.push('Import ist keine Datei: '+path.relative(root,f)+' → '+m[1])}
  catch{failures.push('Fehlender Import: '+path.relative(root,f)+' → '+m[1])}
 }
}
const html=await readFile(path.join(root,'public/index.html'),'utf8');
const localRefs=[...html.matchAll(/(?:src|href)\s*=\s*["'](\/[^"'#?]+)(?:\?[^"']*)?["']/g)].map(m=>m[1]);
for(const ref of localRefs)if(!publicFiles.has(decodeURIComponent(ref.slice(1))))failures.push('HTML-Verweis nicht gefunden: '+ref);
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]);
for(const src of new Set(scripts))if(scripts.filter(x=>x===src).length>1)failures.push('Doppeltes Script im Index: '+src);
console.log('Architecture check:',code.length,'JS-Module,',localRefs.length,'HTML-Dateiverweise');
if(failures.length){for(const e of failures)console.error('✗',e);process.exitCode=1}else console.log('Alle Dateiverweise und Syntaxprüfungen erfolgreich.');
