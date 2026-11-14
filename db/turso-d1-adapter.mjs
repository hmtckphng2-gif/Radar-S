/**
 * Small D1-compatible surface for the existing history module.
 * Keeps Turso access server-side and preserves the existing prepared-statement API.
 */
function rowsAsObjects(result) {
  const columns = Array.isArray(result?.columns) ? result.columns : [];
  return (result?.rows || []).map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]]))
  );
}

function createBoundStatement(client, sql, args) {
  const statement = { sql, args };
  return {
    async all() {
      const result = await client.execute(statement);
      return { results: rowsAsObjects(result), success: true };
    },
    async first(column) {
      const result = await client.execute(statement);
      const row = rowsAsObjects(result)[0] ?? null;
      return column && row ? row[column] : row;
    },
    async run() {
      const result = await client.execute(statement);
      return {
        success: true,
        meta: {
          changes: Number(result?.rowsAffected || 0),
          last_row_id: result?.lastInsertRowid == null ? null : Number(result.lastInsertRowid)
        }
      };
    },
    toStatement() {
      return statement;
    }
  };
}

export function createTursoD1Adapter(client) {
  if (!client || typeof client.execute !== 'function' || typeof client.batch !== 'function') {
    throw new TypeError('A compatible libSQL client is required');
  }

  return {
    prepare(sql) {
      if (typeof sql !== 'string' || !sql.trim()) throw new TypeError('SQL statement required');
      return {
        bind(...args) {
          return createBoundStatement(client, sql, args);
        },
        all() {
          return createBoundStatement(client, sql, []).all();
        },
        first(column) {
          return createBoundStatement(client, sql, []).first(column);
        },
        run() {
          return createBoundStatement(client, sql, []).run();
        }
      };
    },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.length === 0) return [];
      const batch = statements.map((item) => {
        if (!item || typeof item.toStatement !== 'function') {
          throw new TypeError('Turso batch expects prepared and bound statements');
        }
        return item.toStatement();
      });
      return client.batch(batch, 'write');
    }
  };
}
