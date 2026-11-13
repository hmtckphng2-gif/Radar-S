/* Radar 8.5 - shrink a downloaded 3D model for mobile web.
 *
 * A realistic train model is 15 to 25 MB. On a phone that is far too much
 * for a map view. This script runs the model through gltf-transform:
 * fewer triangles, smaller textures, compressed geometry.
 *
 *   node tools/optimize-model.mjs public/models/train.glb
 *   node tools/optimize-model.mjs public/models/train.glb --ratio 0.35
 *
 * gltf-transform is a development tool, not a project dependency. If it is
 * not installed, install it once:
 *   npm install -g @gltf-transform/cli
 */
import {readFile,writeFile,stat,rename} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const ratioArg = args.indexOf('--ratio');
const ratio = ratioArg >= 0 && args[ratioArg + 1] ? Number(args[ratioArg + 1]) : 0.4;
const keepOriginal = args.includes('--keep');

if (!file) {
  console.error('Aufruf: node tools/optimize-model.mjs <datei.glb> [--ratio 0.4] [--keep]');
  process.exit(1);
}

const abs = path.resolve(process.cwd(), file);
const before = (await stat(abs)).size;
if (before < 1024) {
  console.error('Die Datei ist zu klein für eine GLB: ' + file);
  process.exit(1);
}
const head = (await readFile(abs)).subarray(0, 4).toString('ascii');
if (head !== 'glTF') {
  console.error('Kein gültiges GLB (Magic "' + head + '"). Vielleicht eine ZIP-Datei?');
  process.exit(1);
}

console.log('Datei     : ' + file);
console.log('Vorher    : ' + Math.round(before / 1024) + ' KB');
console.log('Ziel      : ' + Math.round(ratio * 100) + ' % der Dreiecke');

const tmp = abs + '.optimized.glb';
const isWin = process.platform === 'win32';

// Find the CLI. It is started through node directly when possible: Node 24
// refuses to spawn a .cmd without a shell, and the shell variant prints a
// deprecation warning about unescaped arguments.
async function findCli() {
  // 1) The JavaScript entry point of a global install
  const roots = [];
  if (process.env.npm_config_prefix) roots.push(path.join(process.env.npm_config_prefix, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js'));
  if (isWin && process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js'));
  if (process.env.HOME) roots.push(path.join(process.env.HOME, '.npm-global', 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js'));
  for (const candidate of roots) {
    try { await stat(candidate); return { cmd: process.execPath, prefix: [candidate] }; } catch { /* weiter */ }
  }
  // 2) The launcher on the PATH
  for (const name of isWin ? ['gltf-transform.cmd', 'gltf-transform'] : ['gltf-transform']) {
    try {
      await run(name, ['--version'], { shell: isWin });
      return { cmd: name, prefix: [] };
    } catch { /* weiter */ }
  }
  // 3) The global npm folder
  try {
    const { stdout } = await run(isWin ? 'npm.cmd' : 'npm', ['prefix', '-g'], { shell: isWin });
    const dir = stdout.trim();
    const bin = isWin ? dir : path.join(dir, 'bin');
    const js = path.join(bin, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
    try { await stat(js); return { cmd: process.execPath, prefix: [js] }; } catch { /* weiter */ }
    const exe = path.join(bin, isWin ? 'gltf-transform.cmd' : 'gltf-transform');
    await run(exe, ['--version'], { shell: isWin });
    return { cmd: exe, prefix: [] };
  } catch { return null; }
}

const cli = await findCli();
if (!cli) {
  console.error('gltf-transform wurde nicht gefunden.');
  console.error('Einmalig installieren:  npm install -g @gltf-transform/cli');
  process.exit(1);
}
console.log('Werkzeug  : ' + cli.prefix.join(' '));

try {
  await run(cli.cmd, [
    ...cli.prefix,
    'optimize', abs, tmp,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
    '--simplify-ratio', String(ratio),
    '--simplify-error', '0.0005',
    '--prune',
    '--join'
  ], { maxBuffer: 1024 * 1024 * 32, shell: isWin && cli.prefix.length === 0 });
} catch (error) {
  const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join(' | ').slice(0, 600);
  console.error('Optimierung fehlgeschlagen: ' + detail);
  process.exit(1);
}

const after = (await stat(tmp)).size;
if (after >= before) {
  console.error('Das Ergebnis ist nicht kleiner (' + Math.round(after / 1024) + ' KB). Original bleibt.');
  await run('cmd', ['/c', 'del', tmp]).catch(() => {});
  process.exit(1);
}
if (keepOriginal) {
  console.log('Ergebnis  : ' + Math.round(after / 1024) + ' KB (Original behalten: ' + file + '.orig)');
  await rename(abs, abs + '.orig');
  await rename(tmp, abs);
} else {
  await rename(tmp, abs);
  console.log('Ergebnis  : ' + Math.round(after / 1024) + ' KB (ersetzt ' + file + ')');
}
console.log('Ersparnis : ' + Math.round((1 - after / before) * 100) + ' %');
console.log('');
console.log('Jetzt noch in public/models/models.json eintragen und "npm run verify" laufen lassen.');
