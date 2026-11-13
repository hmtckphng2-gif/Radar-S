import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/* Radar 8.5 - no module may call a function it does not have.
 *
 * This guard exists because of a real mistake: while removing the duplicated
 * version writers, a scripted line deletion also swallowed three real
 * functions in radar55.js ("tools", "openPanel", "closePanel"). The result was
 * a ReferenceError in the browser, a broken "Weitere Kartenwerkzeuge" menu and
 * a broken 3D view - while the local test suite stayed green, because the
 * tests never load the browser modules.
 *
 * The check is static: a called name must be declared in the same file,
 * imported, or be a known global. Method calls on an object (foo.bar()) are
 * not free functions and are therefore not checked.
 */

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = root + 'public/';

const GLOBALS = new Set([
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'queueMicrotask', 'fetch', 'structuredClone', 'performance', 'crypto', 'atob', 'btoa',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'String', 'Number', 'Boolean', 'Object', 'Array', 'Math', 'JSON', 'Date', 'Promise',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'RegExp', 'Intl', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'Headers', 'Request', 'Response', 'TextEncoder', 'TextDecoder', 'AbortController',
  'DOMParser', 'XMLHttpRequest', 'Image', 'Audio', 'Worker', 'MessageChannel',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'matchMedia',
  'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
  'screen', 'alert', 'confirm', 'prompt', 'open', 'close', 'focus', 'blur', 'print',
  'getComputedStyle', 'caches', 'indexedDB', 'WebSocket', 'EventSource', 'Notification',
  'CustomEvent', 'Event', 'HTMLElement', 'Node', 'NodeList', 'URLPattern',
  'L', 'maplibregl', 'self', 'globalThis', 'undefined', 'NaN', 'Infinity',
  'arguments', 'super', 'this', 'require', 'module', 'exports', '__dirname', '__filename',
]);

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 'typeof',
  'await', 'do', 'else', 'delete', 'void', 'in', 'of', 'instanceof', 'yield', 'case',
  'async', 'import', 'export', 'default', 'extends', 'super', 'get', 'set',
]);

// Namen, die im Code vorkommen, aber keine freien Funktionen sind: Parameter
// von Promises, Objekt-Kurzformen und aehnliche Formen, die der Parser oben
// nicht zuverlaessig erkennt. Bewusst klein gehalten - jeder Eintrag hier
// schwaecht den Test ein Stueck.
const ALLOWED = new Set([
  'resolve', 'reject',                    // new Promise((resolve, reject) => ...)
  'favoriteId', 'action', 'cell',         // Objekt-Kurzformen
  'fetchFeed', 'onModel',                 // Parameter
]);

// Strings, Template-Literale und Kommentare entfernen: dort steht Text,
// der kein Code ist.
function stripLiterals(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

// Namen, die als freie Funktion aufgerufen werden: kein Methodenaufruf.
function freeCalls(source) {
  const names = new Set();
  for (const m of source.matchAll(/(^|[^.\w$?])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[2]);
  return names;
}

// Namen, die in der Datei deklariert oder importiert sind.
function declarations(source) {
  const names = new Set();
  const add = (n) => { if (n && /^[A-Za-z_$][\w$]*$/.test(n)) names.add(n); };
  for (const m of source.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // const, let, var - auch mehrere Deklarationen mit Komma
  for (const m of source.matchAll(/\b(?:const|let|var)\s+([^;]+)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split('=>')[0].split('=')[0].split(':').pop().split('[')[0].trim().replace(/^\.\.\./, '');
      add(name);
    }
  }
  for (const m of source.matchAll(/import\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) add(part.split(/\s+as\s+/).pop().trim());
  }
  for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from/g)) add(m[1]);
  // Objektliteral-Schluessel und Destrukturierung
  for (const m of source.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*[:,}]/g)) add(m[1]);
  // Methoden-Kurzschreibweise in Objektliteralen und Klassen
  for (const m of source.matchAll(/([A-Za-z_$][\w$]*)\s*\(((?:[^()]|\([^()]*\))*)\)\s*\{/g)) add(m[1]);
  // Funktions- und Arrow-Parameter
  for (const m of source.matchAll(/\(((?:[^()]|\([^()]*\))*)\s*(?:=>|\{)/g)) {
  }
  for (const m of source.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of source.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) add(m[1]);
  return names;
}

test('no module calls a function that it does not define', () => {
  const problems = [];
  for (const name of readdirSync(publicDir)) {
    if (!/\.(js|mjs)$/.test(name)) continue;
    const source = stripLiterals(readFileSync(publicDir + name, 'utf8'));
    const declared = declarations(source);
    for (const called of freeCalls(source)) {
      if (KEYWORDS.has(called)) continue;
      if (declared.has(called) || GLOBALS.has(called) || ALLOWED.has(called)) continue;
      problems.push(name + ' -> ' + called);
    }
  }
  assert.deepEqual(problems, [], 'Aufrufe ohne eigene Definition: ' + problems.join(', '));
});

test('the modules that were broken are complete again', () => {
  // Regression auf den konkreten Fehler: die drei Funktionen aus radar55.js
  const source = readFileSync(publicDir + 'radar55.js', 'utf8');
  for (const fn of ['openPanel', 'closePanel', 'tools']) {
    assert.match(source, new RegExp('function\\s+' + fn + '\\s*\\('), fn + ' fehlt in radar55.js');
  }
  // Und die Versionsschreiber duerfen nicht wiederkommen.
  assert.doesNotMatch(source, /function\s+setVersion\s*\(/);
  assert.doesNotMatch(source, /function\s+versionGuard\s*\(/);
});
