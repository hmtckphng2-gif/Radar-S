import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(fileURLToPath(new URL('../',import.meta.url)));
const html=readFileSync(join(root,'public/index.html'),'utf8');
const app=readFileSync(join(root,'public/app.js'),'utf8');
const tr=readFileSync(join(root,'public/translations.mjs'),'utf8');

// Alle data-t Keys aus HTML extrahieren
const htmlKeys=[...html.matchAll(/data-t="([^"]+)"/g)].map(m=>m[1]);
// Alle data-t-placeholder Keys aus HTML extrahieren
const htmlPlaceholderKeys=[...html.matchAll(/data-t-placeholder="([^"]+)"/g)].map(m=>m[1]);
// Alle data-t-aria-label Keys aus HTML extrahieren
const htmlAriaKeys=[...html.matchAll(/data-t-aria-label="([^"]+)"/g)].map(m=>m[1]);
// Alle data-t-title Keys aus HTML extrahieren
const htmlTitleKeys=[...html.matchAll(/data-t-title="([^"]+)"/g)].map(m=>m[1]);
// Alle t('key') Aufrufe aus app.js extrahieren (Filtert False Positives: Event-Namen, CSS-Selektoren, HTML-Tags, Locale)
const appKeys=[...new Set([...app.matchAll(/t\('([^']+)'/g)].map(m=>m[1]).filter(k=>{
  // Filtere False Positives: Event-Namen, CSS-Selektoren, HTML-Tags, Locale-Strings, dynamische Keys (endet mit .)
  if(k.startsWith('#')||k.startsWith('sr')||k.startsWith('en-')||k.endsWith('.'))return false;
  if(['div','span','button','li','b','small','strong','h3','vehicle','station'].includes(k))return false;
  return true;
}))];

const allHtmlKeys=[...new Set([...htmlKeys,...htmlPlaceholderKeys,...htmlAriaKeys,...htmlTitleKeys])];
const allAppKeys=[...new Set(appKeys)];

test('alle data-t Keys im HTML haben einen Eintrag in translations.mjs', () => {
  const missing=[];
  for(const key of allHtmlKeys){
    if(!tr.includes(`'${key}':`))missing.push(key);
  }
  assert.deepEqual(missing,[],'HTML Keys ohne Übersetzung: '+missing.join(', '));
});

test('alle t() Keys in app.js haben einen Eintrag in translations.mjs', () => {
  const missing=[];
  for(const key of allAppKeys){
    if(!tr.includes(`'${key}':`))missing.push(key);
  }
  assert.deepEqual(missing,[],'app.js Keys ohne Übersetzung: '+missing.join(', '));
});

test('kein Übersetzungs-Eintrag ist leer', () => {
  const entries=[...tr.matchAll(/'([^']+)':\s*\{[^}]*\}/g)];
  const empty=[];
  for(const m of entries){
    const key=m[1];
    const deMatch=tr.match(new RegExp(`'${key}':\\s*\\{[^}]*de:\\s*'([^']*)'`));
    const itMatch=tr.match(new RegExp(`'${key}':\\s*\\{[^}]*it:\\s*'([^']*)'`));
    if(deMatch&&deMatch[1]==='')empty.push(key+' (de leer)');
    if(itMatch&&itMatch[1]==='')empty.push(key+' (it leer)');
  }
  assert.deepEqual(empty,[],'Leere Übersetzungen: '+empty.join(', '));
});

test('alle Übersetzungen haben sowohl de als auch it', () => {
  // Extrahiere jeden Key-Block zwischen 'key': { ... } Paaren.
  // Einfache Heuristik: finde alle Key-Positionen und prüfe den Text zwischen zwei Keys.
  const keys=[...tr.matchAll(/'([^']+)'\s*:\s*\{/g)].map(m=>m[1]);
  const missingLang=[];
  for(let i=0;i<keys.length;i++){
    const key=keys[i];
    const start=tr.indexOf(`'${key}':`);
    const end=i+1<keys.length?tr.indexOf(`'${keys[i+1]}':`,start):tr.length;
    const body=tr.substring(start,end);
    if(!body.includes('de:'))missingLang.push(key+' (fehlt de)');
    if(!body.includes('it:'))missingLang.push(key+' (fehlt it)');
  }
  assert.deepEqual(missingLang,[],'Übersetzungen ohne beide Sprachen: '+missingLang.join(', '));
});
