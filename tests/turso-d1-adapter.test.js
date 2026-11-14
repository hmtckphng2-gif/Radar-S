import test from 'node:test';
import assert from 'node:assert/strict';
import { createTursoD1Adapter } from '../db/turso-d1-adapter.mjs';

test('D1-compatible first() returns an object row', async () => {
  const calls = [];
  const client = {
    async execute(statement) {
      calls.push(statement);
      return { columns: ['n'], rows: [[7]], rowsAffected: 0 };
    },
    async batch() { return []; }
  };
  const db = createTursoD1Adapter(client);
  assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n').bind().first(), { n: 7 });
  assert.equal(calls[0].sql, 'SELECT COUNT(*) AS n');
});

test('D1-compatible all() maps libSQL rows by column name', async () => {
  const client = {
    async execute() {
      return { columns: ['source', 'vehicle_key'], rows: [['sta', 'bus-1']], rowsAffected: 0 };
    },
    async batch() { return []; }
  };
  const db = createTursoD1Adapter(client);
  assert.deepEqual((await db.prepare('SELECT source, vehicle_key FROM vehicle_observations').all()).results, [
    { source: 'sta', vehicle_key: 'bus-1' }
  ]);
});

test('D1-compatible batch() sends bound statements as one write batch', async () => {
  let captured;
  const client = {
    async execute() { return { columns: [], rows: [], rowsAffected: 1 }; },
    async batch(statements, mode) { captured = { statements, mode }; return []; }
  };
  const db = createTursoD1Adapter(client);
  await db.batch([
    db.prepare('INSERT INTO test(value) VALUES (?)').bind('a'),
    db.prepare('INSERT INTO test(value) VALUES (?)').bind('b')
  ]);
  assert.equal(captured.mode, 'write');
  assert.deepEqual(captured.statements, [
    { sql: 'INSERT INTO test(value) VALUES (?)', args: ['a'] },
    { sql: 'INSERT INTO test(value) VALUES (?)', args: ['b'] }
  ]);
});

test('adapter rejects invalid clients and unbound batch items', async () => {
  assert.throws(() => createTursoD1Adapter({}), /compatible libSQL client/);
  const db = createTursoD1Adapter({ async execute() {}, async batch() {} });
  await assert.rejects(db.batch([{}]), /prepared and bound statements/);
});
