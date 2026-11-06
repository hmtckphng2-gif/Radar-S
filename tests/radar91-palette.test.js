import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const paletteFiles=['../public/styles.css','../public/radar40.css','../public/radar47.css','../public/radar47.js','../public/radar50.css','../public/radar51.css','../public/radar51.js','../public/radar53.css','../public/radar53.js','../public/radar54.css','../public/radar55.css','../public/radar56.css','../public/radar57.css','../public/radar58.css','../public/radar60.css','../public/radar62.css','../public/radar63.css','../public/radar64.css','../public/radar65.css','../public/radar66.css','../public/radar67.css','../public/radar70.css','../public/radar84.css','../public/radar10-map-first.css'];
const obsolete=['#53e1c1','#50e6c6','#4fe0c0','#6cdfd0','#74edd4','#6bd6ba','#a0d7dc','#65dfc8','#6ae8ce','#7ce0c2','#6fe0bc','#9bf5ce','#36ac9c','#bcfff4','#78e1c2','#87efc1','#42d6b1','#36d6ae','#60debc','#58dfb6','#61dbb1','#47daa8','#65e8bb','#69d4ba','#79c5a7','#7bccac','#7fd6a8','#9ddbbf','#69c995','#91ffdc','#b6ffda','#42d5a5'];
test('active UI styles and inline scripts no longer contain the old mint palette',()=>{
  for(const path of paletteFiles){const src=read(path);for(const color of obsolete)assert.equal(src.toLowerCase().includes(color),false,`${path} still contains ${color}`)}
  assert.equal(read('../public/radar60.css').includes('--nova-mint'),false);
});
test('Feed and Soll markers use silver and amber consistently in SVG and map overlays',()=>{
  const js=read('../public/radar51.js'),css=read('../public/radar51.css'),enhancer=read('../public/radar53.js');
  assert.match(js,/marker\(planned,20,'#d6a75f','SOLL'\);marker\(actual,67,'#c4ccd5','FEED'\)/);
  assert.match(js,/mk\(calc\.scheduled,'#d6a75f','Soll laut Fahrplan'\);mk\(calc\.observed,'#c4ccd5','Feedposition'\)/);
  assert.match(js,/sr51-legend-feed/);assert.match(js,/sr51-legend-soll/);
  assert.match(css,/sr51-legend-feed\{color:#c4ccd5\}/);assert.match(css,/sr51-legend-soll\{color:#d6a75f\}/);
  assert.match(enhancer,/!labels\.querySelector\('\.sr51-legend-feed'\)/);
});
test('progress indicators use graphite/silver while punctual/live status stays muted green',()=>{
  assert.match(read('../public/radar56.css'),/linear-gradient\(90deg,#4b5968,#c4ccd5\)/);
  assert.match(read('../public/radar47.css'),/\.sr47-progress-fill[^}]*background:#c4ccd5/);
  assert.match(read('../public/radar62.css'),/\.sr62-progress-fill[^}]*background:#c4ccd5/);
  assert.match(read('../public/styles.css'),/--good:#6fae86/);
  assert.match(read('../public/radar51.css'),/sr51-delay-zero[^}]*color:#6fae86/);
});
test('all recolored assets have a fresh cache key without changing release version',()=>{
  const html=read('../public/index.html');
  for(const name of ['styles.css','radar40.css','radar47.css','radar47.js','radar50.css','radar51.css','radar51.js','radar53.css','radar53.js','radar54.css','radar55.css','radar56.css','radar58.css','radar60.css','radar62.css','radar63.css','radar64.css','radar65.css','radar66.css','radar67.css','radar70.css','radar84.css'])
    assert.match(html,new RegExp('/'+name+'\\?v=9\\.9\\.5[^" ]*palette=1'));
});
