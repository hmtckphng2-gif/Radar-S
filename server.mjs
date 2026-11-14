import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@libsql/client';
import { createTursoD1Adapter } from './db/turso-d1-adapter.mjs';
import { collectHistory } from './public/radar-history-worker.mjs';
import worker from './worker.js';

const ROOT = resolve('public');
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm'
};

const windows = new Map();
const limiter = {
  async limit({ key }) {
    const now = Date.now();
    const current = windows.get(String(key)) || { start: now, count: 0 };
    if (now - current.start >= 60_000) {
      current.start = now;
      current.count = 0;
    }
    current.count += 1;
    windows.set(String(key), current);
    if (windows.size > 10_000) {
      for (const [id, item] of windows) if (now - item.start >= 60_000) windows.delete(id);
    }
    return { success: current.count <= 10 };
  }
};

async function assetFetch(request) {
  const url = new URL(request.url);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', { status: 400 }); }
  if (pathname === '/') pathname = '/index.html';
  const file = resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return new Response('Not found', { status: 404 });
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    return new Response(body, { status: 200, headers: {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': String(body.byteLength),
      'x-content-type-options': 'nosniff'
    }});
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const env = {
  ASSISTANT_ENABLED: process.env.ASSISTANT_ENABLED || 'false',
  GROQ_FREE_TIER_ONLY: process.env.GROQ_FREE_TIER_ONLY || 'true',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  BUSONE_CLIENT: process.env.BUSONE_CLIENT || 'Suedtirol Radar read-only transit viewer',
  HISTORY_COLLECTOR_ENABLED: process.env.HISTORY_COLLECTOR_ENABLED || 'false',
  HISTORY_DB: null,
  HISTORY_DB_STATUS: 'not_configured',
  AI_JOURNEY_LIMITER: limiter,
  ASSETS: { fetch: assetFetch }
};

async function initializeHistoryStorage() {
  const url = String(process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = String(process.env.TURSO_AUTH_TOKEN || '').trim();
  if (!url || !authToken) {
    env.HISTORY_DB_STATUS = url || authToken ? 'incomplete_configuration' : 'not_configured';
    console.log('Turso history storage not configured; collector remains disabled.');
    return;
  }

  let client;
  try {
    client = createClient({ url, authToken, intMode: 'number', concurrency: 5 });
    const schema = await readFile(resolve('db/history-schema.sql'), 'utf8');
    await client.executeMultiple(schema);
    await client.execute('SELECT 1 AS turso_connection_ok');
    env.HISTORY_DB = createTursoD1Adapter(client);
    env.HISTORY_DB_STATUS = 'ready';
    console.log('Turso history database connected; schema verified. Collector remains disabled unless explicitly enabled.');
  } catch (error) {
    try { client?.close(); } catch {}
    env.HISTORY_DB = null;
    env.HISTORY_DB_STATUS = 'connection_failed';
    console.error('Turso history initialization failed:', error?.name || 'Error');
  }
}

await initializeHistoryStorage();

async function readBody(request, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validCollectorSecret(request) {
  const expected = String(process.env.HISTORY_COLLECTOR_SECRET || '');
  const supplied = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || 'localhost';
    const proto = String(incoming.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    const url = proto + '://' + host + (incoming.url || '/');
    const method = incoming.method || 'GET';
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(name, item);
      else if (value !== undefined) headers.set(name, String(value));
    }
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(incoming);

    if (new URL(url).pathname === '/internal/collect-history') {
      let status = 200;
      let payload;
      if (method !== 'POST') {
        status = 405;
        payload = { ok: false, error: 'Method not allowed' };
      } else if (!validCollectorSecret(new Request(url, { method, headers }))) {
        status = 401;
        payload = { ok: false, error: 'Unauthorized' };
      } else if (env.HISTORY_COLLECTOR_ENABLED !== 'true') {
        status = 503;
        payload = { ok: false, error: 'History collector is disabled' };
      } else if (env.HISTORY_DB_STATUS !== 'ready' || !env.HISTORY_DB) {
        status = 503;
        payload = { ok: false, error: 'History database is not ready' };
      } else {
        try {
          payload = await collectHistory(env);
          if (!payload?.ok) status = 503;
        } catch (error) {
          status = 500;
          payload = { ok: false, error: 'Collection failed', type: error?.name || 'Error' };
          console.error('History collection failed:', error?.name || 'Error');
        }
      }
      outgoing.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return outgoing.end(JSON.stringify(payload));
    }

    const request = new Request(url, { method, headers, body: body?.length ? body : undefined });
    const response = await worker.fetch(request, env);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    if (!response.body || method === 'HEAD') return outgoing.end();
    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    outgoing.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    outgoing.end(JSON.stringify({ error: status === 413 ? 'Request too large' : 'Internal server error' }));
    if (status === 500) console.error('Request failed:', error?.stack || error);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log('Südtirol Radar Node server listening on ' + PORT));
