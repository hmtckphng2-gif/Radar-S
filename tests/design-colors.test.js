import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Regression: die abgestimmte Farbpalette bleibt frei von Türkis/Mint.
// Status "ok" bleibt #6fae86 (muted green, festgelegt in radar91-palette.test.js);
// Fortschrittsanzeigen bleiben Graphit/Silber #c4ccd5.
const VERBOTEN = [
  '#53e1c1','#50e6c6','#4fe0c0','#6cdfd0','#74edd4','#6bd6ba','#a0d7dc','#65dfc8',
  '#6ae8ce','#7ce0c2','#6fe0bc','#9bf5ce','#36ac9c','#bcfff4','#78e1c2','#87efc1',
  '#42d6b1','#36d6ae','#60debc','#58dfb6','#61dbb1','#47daa8','#65e8bb','#69d4ba',
  '#79c5a7','#7bccac','#7fd6a8','#9ddbbf','#69c995','#91ffdc','#b6ffda','#42d5a5',
];

const cssFiles = readdirSync('public')
  .filter(name => name.endsWith('.css'))
  .sort()
  .map(name => ({ name, text: readFileSync(`public/${name}`, 'utf8') }));

test('keine Türkis- oder Mint-Farben mehr in public/*.css', () => {
  for (const { name, text } of cssFiles) {
    const lower = text.toLowerCase();
    for (const farbe of VERBOTEN) {
      assert.ok(!lower.includes(farbe), `${name} enthält noch die Farbe ${farbe}`);
    }
  }
});

test('styles.css: --muted und --edge sind entblautes Grau (nicht blau-stichig)', () => {
  const [dark, light] = cssFiles.find(f => f.name === 'styles.css').text.split('\n');
  assert.ok(dark.includes('--muted:#a8a8a8'), `dark --muted: ${dark}`);
  assert.ok(dark.includes('--edge:rgba(160,160,160,.17)'), `dark --edge: ${dark}`);
  assert.ok(light.includes('--muted:#8a8a8a'), `light --muted: ${light}`);
  assert.ok(light.includes('--edge:rgba(160,160,160,.14)'), `light --edge: ${light}`);
});