import test from 'node:test';
import assert from 'node:assert/strict';

import {
  vehicleToTripEntry,
  groupVehiclesByTrip,
  sortTripEntries,
  getTripStops,
  getStopDelay,
  isUpdateFresh
} from '../public/fahrtverfolgung-logic.mjs?v=9.9.5';

const now = 1731571200000; // 2024-11-14T12:00:00Z

// Minimal static data: sta index with routes, trips, stops, times
const staticData = {
  sta: {
    routes: {
      '1-110-26a-1': ['110', 'Bronzolo â€“ Bozen', 3]
    },
    trips: {
      '1.T0.1-110-26a-1.7.H': ['1-110-26a-1', 'Bronzolo Raif', 'shape1', '', 'T2#17', true, '0']
    },
    stops: {
      'it:22021:100:0:1': ['Haltestelle A', 46.5, 11.3, '', ''],
      'it:22021:200:0:2': ['Haltestelle B', 46.51, 11.31, '', ''],
      'it:22021:300:0:3': ['Haltestelle C', 46.52, 11.32, '', '']
    },
    times: {
      '1.T0.1-110-26a-1.7.H': [
        ['it:22021:100:0:1', 25200, 25200, 1],
        ['it:22021:200:0:2', 25500, 25500, 2],
        ['it:22021:300:0:3', 25800, 25800, 3]
      ]
    }
  }
};

const baseVehicle = {
  key: 'sta:veh123',
  source: 'sta',
  kind: 'bus',
  tripId: '1.T0.1-110-26a-1.7.H',
  routeId: '1-110-26a-1',
  vehicleId: 'BUS-123',
  lat: 46.505,
  lon: 11.305,
  timestamp: 1731571100,
  currentStopId: 'it:22021:100:0:1',
  currentStopSequence: 1,
  currentStatus: 'IN_TRANSIT_TO',
  name: '110',
  headsign: 'Bronzolo Raif',
  bearing: 90,
  speed: 25,
  positionType: 'Feedposition (GPS nicht garantiert)',
  lineVerified: true,
  nameVerified: false
};

const emptyUpdates = new Map();

test('vehicleToTripEntry: erstellt vollsÃ¤ngeg Eintrag aus Fahrzeugdaten', () => {
  const entry = vehicleToTripEntry(baseVehicle, staticData, emptyUpdates);
  assert.ok(entry, 'Eintrag darg nicht null sein');
  assert.strictEqual(entry.key, 'sta:veh123');
  assert.strictEqual(entry.tripId, '1.T0.1-110-26a-1.7.H');
  assert.strictEqual(entry.line, '110');
  assert.strictEqual(entry.headsign, 'Bronzolo Raif');
  assert.strictEqual(entry.vehicleId, 'BUS-123');
  assert.strictEqual(entry.lat, 46.505);
  assert.strictEqual(entry.lon, 11.305);
  assert.strictEqual(entry.kind, 'bus');
  assert.ok(entry.ageLabel, 'Datenalter sollte gesetzt sein');
});

test('vehicleToTripEntry: gibt null bei fehlender tripId zurÃ¼ck', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, tripId: '' }, staticData, emptyUpdates);
  assert.strictEqual(entry, null);
});

test('vehicleToTripEntry: gibt null bei ungÃ¼ltigen Koordinaten zurÃ¼ck', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, lat: 999, lon: 999 }, staticData, emptyUpdates);
  assert.strictEqual(entry, null);
});

test('vehicleToTripEntry: zeigt fehlende Linien-Daten ehrlich an wenn kein Static-Index', () => {
  const entry = vehicleToTripEntry({ ...baseVehicle, name: '', headsign: '' }, {}, emptyUpdates);
  assert.strictEqual(entry.line, 'Linie unbekannt');
  assert.strictEqual(entry.headsign, 'Fahrtziel unbekannt');
});

test('vehicleToTripEntry: zeigt Fahrzeug-ID als nicht verbdÛÙ\ˆÙ[›ˆY\‰Ë

HOˆÂˆÛÛœİ[HH™ZXÛUÕš\[JÈ‹‹˜˜\ÙU™ZXÛK™ZXÛRYˆ	ÉÈKİ]XÑ]K[\U\]\ÊNÂˆ\ÜÙ\œİšXİ\]X[
[K™ZXÛRY	ÓšXÚ™\™°ïØ˜\‰ÊNÂŸJNÂ‚\İ
	ÙÜ›İ\™ZXÛ\ĞUš\ˆÜ\Y\˜Z™]YÙH˜XÚš\Y	Ë

HOˆÂˆÛÛœİ™ZXÛ\ÈHÂˆÈ‹‹˜˜\ÙU™ZXÛKÙ^Nˆ	ÜİNŒIËš\Yˆ	İš\PIË[Y\İ[\ˆLKˆÈ‹‹˜˜\ÙU™ZXÛKÙ^Nˆ	ÜİNŒ‰Ëš\Yˆ	İš\P‰Ë[Y\İ[\ˆŒKˆÈ‹‹˜˜\ÙU™ZXÛKÙ^Nˆ	ÜİNŒÉËš\Yˆ	İš\PIË[Y\İ[\ˆÌBˆNÂˆÛÛœİÜ›İ\YHÜ›İ\™ZXÛ\ĞUš\
™ZXÛ\ÊNÂˆ\ÜÙ\œİšXİ\]X[
Ü›İ\YœÚ^™KŠNÂˆ\ÜÙ\œİšXİ\]X[
Ü›İ\Y™Ù]
	İš\PIÊK›[™İŠNÂˆ\ÜÙ\œİšXİ\]X[
Ü›İ\Y™Ù]
	İš\P‰ÊK›[™İJNÂŸJNÂ‚\İ
	ÙÜ›İ\™ZXÛ\ĞUš\ˆYÛ›ÜšY\˜Z™]YÙHÚ™Hš\Y	Ë

HOˆÂˆÛÛœİ™ZXÛ\ÈHÂˆÈ‹‹˜˜\ÙU™ZXÛKÙ^Nˆ	ÜİNŒIËš\Yˆ	İš\PIÈKˆÈ‹‹˜˜\ÙU™ZXÛKÙ^Nˆ	ÜİNŒ‰Ëš\Yˆ	ÉÈBˆNÂˆÛÛœİÜ›İ\YHÜ›İ\™ZXÛ\ĞUš\
™ZXÛ\ÊNÂˆ\ÜÙ\œİšXİ\]X[
Ü›İ\YœÚ^™KJNÂˆ\ÜÙ\›ÚÊÜ›İ\Yš\Ê	İš\PIÊJNÂŸJNÂ‚\İ
	ÜÛÜš\[šY\ÎˆÛÜY\˜XÚ[šYH[›ˆ˜ZšY[	Ë

HOˆÂˆÛÛœİ[šY\ÈHÂˆÈ[™Nˆ	ÌŒ	ËXYÚYÛˆ	ÖšY[‰ËÙ^Nˆ	ÚÌ‰ÈKˆÈ[™Nˆ	ÌLL	ËXYÚYÛˆ	ÖšY[IËÙ^Nˆ	ÚÌIÈKˆÈ[™Nˆ	ÌLL	ËXYÚYÛˆ	ÖšY[‰ËÙ^Nˆ	ÚÌÉÈBˆNÂˆÛÛœİÛÜYHÛÜš\[šY\Ê[šY\ÊNÂˆ\ÜÙ\œİšXİ\]X[
ÛÜYÌKšÙ^K	ÚÌIÊNÂˆ\ÜÙ\œİšXİ\]X[
ÛÜYÌWKšÙ^K	ÚÌÉÊNÂˆ\ÜÙ\œİšXİ\]X[
ÛÜYÌ—KšÙ^K	ÚÌ‰ÊNÂŸJNÂ‚\İ
	ÙÙ]š\İÜÎˆYY™\[\İ[[ˆZ]™Z][‰Ë

HOˆÂˆÛÛœİİÜÈHÙ]š\İÜÊ	ÌK•ŒKLLLL˜KLKË’	Ëİ]XÑ]K	ÜİIÊNÂˆ\ÜÙ\œİšXİ\]X[
İÜË›[™İÊNÂˆ\ÜÙ\œİšXİ\]X[
İÜÖÌK›˜[YK	Ò[\İ[HIÊNÂˆ\ÜÙ\œİšXİ\]X[
İÜÖÌKœİÜY	Ú]ŒŒŒŒNŒLŒŒIÊNÂˆ\ÜÙ\œİšXİ\]X[
İÜÖÌKœÙ\KJNÂŸJNÂ‚\İ
	ÙÙ]š\İÜÎˆÚXY\™\È\œ˜^H™ZH[˜™ZØ[›\ˆ˜Z\°ïÚÉË

HOˆÂˆÛÛœİİÜÈHÙ]š\İÜÊ	İ[˜™ZØ[›KY˜Z	Ëİ]XÑ]K	ÜİIÊNÂˆ\ÜÙ\œİšXİ\]X[
İÜË›[™İ
NÂŸJNÂ‚\İ
	ÙÙ]İÜ[^NˆYY™\[Ú™H\]IË

HOˆÂˆÛÛœİ[^HHÙ]İÜ[^J	İš\V	Ë	ÜİÜLIËİ]XÑ]K	ÜİIË[\U\]\ÊNÂˆ\ÜÙ\œİšXİ\]X[
[^K[
NÂŸJNÂ‚\İ
	Ú\Õ\]Qœ™\Úˆ\šÙ[›œš\ØÚH\]\ÉË

HOˆÂˆÛÛœİœ™\ÚHÈ™]ÚY]ˆ›İÈHLNÂˆ\ÜÙ\œİšXİ\]X[
\Õ\]Qœ™\Ú
œ™\Ú›İÊKYJNÂŸJNÂ‚\İ
	Ú\Õ\]Qœ™\Úˆ\šÙ[›[H\]\ÉË

HOˆÂˆÛÛœİÛHÈ™]ÚY]ˆ›İÈHŒNÂˆ\ÜÙ\œİšXİ\]X[
\Õ\]Qœ™\Ú
Û›İÊK˜[ÙJNÂŸJNÂ‚\İ
	Ú\Õ\]Qœ™\ÚˆÚX˜[ÙHšYH™Z[™[H\]H\°ïÚÉË

HOˆÂˆ\ÜÙ\œİšXİ\]X[
\Õ\]Qœ™\Ú
[›İÊK˜[ÙJNÂˆ\ÜÙ\œİšXİ\]X[
\Õ\]Qœ™\Ú
[™Yš[™Y›İÊK˜[ÙJNÂŸJNÂ