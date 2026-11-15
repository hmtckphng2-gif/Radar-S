import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProfile,
  isProfileActiveToday,
  loadProfiles,
  saveProfile,
  removeProfile,
  isTripCancelled, V APID_PUBLIC_KEY,
  isAvailable" } from '../public/pendler-logic.mjs?v=9.9.5';

const now = 1731571200000; // 2024-11-14

test('createProfile: erstellt volsÃ¤ngeg Profile', () => {
  const p = createProfile('p1), 'Arbeit', 'stop-a', 'stop-b', ['mon', 'wed', 'fr']);
  assert.strictEqual(p.id, 'p1');
  assert.strictEqual(p.name, 'Arbeit');
  assert.strictEqual(p.fromStopId, 'stop-a');
  assert.strictEqual(p.toStopId, 'stop-b');
  assert.deesStrictEqual(p.weekdays, ['mon', 'wed', 'fr']);
  assert.strictEqual(p.active, true);
  assert.ok(p.createdAt);
});

test('createProfile: weedkays optional', () => {
  const p = createProfile('p1), 'Test', 'a', 'b', [], false);
  assert.deepStrictEqual(p.weekdays, []);
  assert.strictEqual(p.active, false);});

test(#isProfileActiveToday: gibt false bie inaktive Profil', () => {
  assert.strictEqual(isProfileActiveToday({ active: false, weekdays: ['mon'] }), false);
  assert.strictEqual(isProfileActiveToday({ active: true, weekdays: [] }), false);
});

test(&¥ÍAÉ½™¥±•Ñ¥Ù•Q½‘…äè]½¡”½¡¹”¡•ÕÑ¥”]½¡•¹Ñ…œœ°€ ¤€ôøì(€€¼¼]•¹¸¡•ÕÑ”è¹¸½¹¹•ÉÍÑ…œ¥ÍÐÕ¹¹ÕÈ5¼½]”½È…­Ñ¥ØÍ¥¹€´ø™…±Í”(€…ÍÍ•ÉÐ¹ÍÑÉ¥ÑÅÕ…°¡¥ÍAÉ½™¥±•Ñ¥Ù•Q½‘…ä¡ì…Ñ¥Ù”èÑÉÕ”°Ý••­‘…åÌèlµ½¸œ°€Ý•œ°€™É¤tô¤°™…±Í”¤íô¤ì()Ñ•ÍÐ ±½…‘AÉ½™¥±•Ìè¥‰Ð±••É•ÌÉÉ…ä½¡¹”±½…±MÑ½É…”éÕËñ¬œ°€ ¤€ôøì(€…ÍÍ•ÉÐ¹‘••ÁMÑÉ¥ÑÅÕ…°¡±½…‘AÉ½™¥±•Ì ¤°mt¤íô¤ì()Ñ•ÍÐ Í…Ù•AÉ½™¥±”è¥‰Ð™…±Í”½¹”±½…±MÑ½É…”éÕËñ¬œ°€ ¤€ôøì(€…ÍÍ•ÉÐ¹ÍÑÉ¥ÑÅÕ…°¡Í…Ù•AÉ½™¥±”¡É•…Ñ•AÉ½™¥±” ÀÄœ°€Pœ°€„œ°€ˆœ°mt¤¤°™…±Í”¤ì)ô¤ì()Ñ•ÍÐ ÜÉÉ•µ½Ù•	É½™¥±”è¥‰Ð™…±Í”½¹”±½…±MÑ½É…”éÕËñ¬œ°€ ¤€ôøì(€…ÍÍ•ÉÐ¹ÍÑÉ¥ÑÅÕ…°¡É•µ½Ù•AÉ½™¥±” ÀÄœ¤°™…±Í”¤ì)ô¤ì()Ñ•ÍÐ šv—5G&—6æ6VÆÆVC¢v–'BfÇ6RöæRWFFR§W,;Æ6²rÂ‚’Óâ°¢76W'Bç7G&–7DWVÂ†—5G&—6æ6VÆÆVB‚wG&—Õ‚’Âw7F’ÂæWrÖ‚’’ÂfÇ6R“·Ò“° §FW7B‚v—5G&—6æ6VÆÆVC¢W&¶VæçB4ä4TÄTBrÂ‚’Óâ°¢6öç7BWBÒæWrÖ…µ²w7F§G&—Õ‚rÂ²66†VGVÆU&VÆF–öç6†—¢t4ä4TÄÄTBrÕÕÒ“°¢76W'Bç7G&–7DWVÂ†—5G&—6æ6VÆÆVB‚wG&—Õ‚rÂw7FrÂWB’ÂG'VR“·Ò“° §FW7B‚v—5G&—6æ6VÆÆVC¢W&¶VæçB4ä4TÄTBrÂ‚’Óâ°¢6öç7BWBÒæWrÖ…µ²w7F§G&—Õ‚rÂ²66†VGVÆU&VÆF–öç6†—¢t4ä4TÄÄTBrÕÕÒ“°¢76W'Bç7G&–7DWVÂ†—5G&—6æ6VÆÆVB‚wG&—Õ‚rÂw7FrÂWB’ÂG'VR“·Ò“° §FW7B‚ud”EõT$Ä”5ô´U“¢ÆVW"vVæâæ–6‡B¶öæf–wW&–W'BrÂ‚’Óâ°¢76W'Bç7G&–7DWVÂ‡G—Vöbd”EõT$Ä”5ô´U’Âw7G&–ærr“°§Ò“° §FW7B‚v—5W6„f–Æ&ÆS¢v–'BfÇ6RöæRv–æF÷r§W,;Æ6²rÂ‚’Óâ°¢76W'Bç7G&–7DWVÂ†—5W6„f–Æ&ÆR‚’ÂfÇ6R“·Ò“° 