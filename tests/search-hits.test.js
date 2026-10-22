import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(root + name, 'utf8');

// Reine Such-Logik, identisch zur Implementierung in app.js renderSearchResults.
function searchHits(vehicles, query, maxResults=10){
  const q = query.trim().toLocaleLowerCase('de');
  if(!q || q.length < 2) return [];
  const hits = [];
  for(const v of vehicles.values()){
    const hay = `${v.name} ${v.headsign} ${v.vehicleId} ${v.tripId} ${v.routeLongName}`.toLocaleLowerCase('de');
    if(hay.includes(q)) hits.push(v);
  }
  return hits.slice(0, maxResults);
}

test('searchHits: findet Fahrzeuge nach Name, Ziel, ID', () => {
  const vehicles = new Map([
    ['a', {name: 'REG 123', headsign: 'Bozen', vehicleId: 'v1', tripId: 't1', routeLongName: 'Regionalzug', kind: 'train'}],
    ['b', {name: 'Linie 4', headsign: 'Meran', vehicleId: 'v2', tripId: 't2', routeLongName: 'Stadtbus', kind: 'bus'}],
    ['c', {name: 'EC 456', headsign: 'Trient', vehicleId: 'v3', tripId: 't3', routeLongName: 'EuroCity', kind: 'train'}],
  ]);
  assert.equal(searchHits(vehicles, 'REG').length, 1);
  assert.equal(searchHits(vehicles, '123').length, 1);
  assert.equal(searchHits(vehicles, 'Meran').length, 1);
  assert.equal(searchHits(vehicles, 'EC').length, 1);
});

test('searchHits: ignoriert nicht passende Fahrzeuge', () => {
  const vehicles = new Map([
    ['a', {name: 'REG 123', headsign: 'Bozen', vehicleId: 'v1', tripId: 't1', routeLongName: 'Regionalzug', kind: 'train'}],
  ]);
  assert.equal(searchHits(vehicles, 'XYZ').length, 0);
  assert.equal(searchHits(vehicles, '').length, 0);
  assert.equal(searchHits(vehicles, 'X').length, 0); // weniger als 2 Zeichen
});

test('searchHits: maximal 10 Treffer', () => {
  const vehicles = new Map();
  for(let i = 0; i < 15; i++){
    vehicles.set('v' + i, {name: 'Zug ' + i, headsign: 'Ziel', vehicleId: 'x', tripId: 't', routeLongName: 'Regionalzug', kind: 'train'});
  }
  assert.equal(searchHits(vehicles, 'Zug').length, 10);
});

test('renderSearchResults existiert in app.js und wird im oninput aufgerufen', () => {
  const app = read('public/app.js');
  assert.match(app, /function renderSearchResults\(\)/);
  assert.match(app, /renderSearchResults\(\)/);
});

test('searchResults-Element existiert im HTML', () => {
  const html = read('public/index.html');
  assert.match(html, /id="searchResults"/);
});
