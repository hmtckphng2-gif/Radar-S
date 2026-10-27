import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('scroll-craft adaptation is loaded after the existing visual fixpack',()=>{
 const html=read('public/index.html');
 assert.match(html,/radar10-fixpack\.css\?v=9\.9\.0/);
 assert.match(html,/radar10-scrollcraft\.css\?v=9\.9\.0/);
 assert.ok(html.indexOf('radar10-scrollcraft.css')>html.indexOf('radar10-fixpack.css'));
});

test('sheet content retains native touch scrolling without boundary preventDefault guards',()=>{
 const css=read('public/radar10-scrollcraft.css');
 const app=read('public/app.js');
 assert.match(css,/\.sheet \.sheet-scroll[\s\S]*?overflow-y:\s*auto/);
 assert.match(css,/-webkit-overflow-scrolling:\s*touch/);
 assert.match(css,/overscroll-behavior-y:\s*contain/);
 assert.match(css,/touch-action:\s*pan-y/);
 assert.doesNotMatch(app,/scroller\.addEventListener\(['"]touchmove['"][\s\S]{0,500}?event\.preventDefault\(\)/);
});

test('downward swipe dismisses only from the sheet handle and not from content',()=>{
 const app=read('public/app.js');
 assert.match(app,/handle\.addEventListener\('pointerdown'/);
 assert.match(app,/handle\.addEventListener\('pointerup'/);
 assert.match(app,/dy>=64 && Math\.abs\(dx\)<72/);
 assert.match(app,/if\(!sheet\.classList\.contains\('open'\) \|\| event\.pointerType==='mouse'/);
 assert.doesNotMatch(app,/scroller\.addEventListener\('touchmove'/);
});

test('home and more tabs get independent mobile momentum scroll with safe bottom space',()=>{
 const css=read('public/radar10-scrollcraft.css');
 assert.match(css,/\.sr70-home,[\s\S]*?\.sr70-more[\s\S]*?overflow-y:\s*auto/);
 assert.match(css,/scroll-padding-block:\s*16px 100px/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});

test('service worker uses a fresh shell cache and still bypasses live API data',()=>{
 const sw=read('public/sw.js');
 assert.match(sw,/radar-shell-v9\.9\.0-scrollcraft/);
 assert.match(sw,/if\(isApi\(url\)\)return/);
});
