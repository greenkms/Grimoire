import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { readAcpSqliteRows } from '@/providers/acp/history/AcpSqliteReader';

describe('readAcpSqliteRows', () => {
  let tempDir: string;
  let databasePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-acp-sqlite-'));
    databasePath = path.join(tempDir, 'history.db');

    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (location: string) => {
        close(): void;
        exec(sql: string): void;
        prepare(sql: string): { run(...params: unknown[]): void };
      };
    };
    const database = new DatabaseSync(databasePath);
    database.exec('create table message (id text, session_id text, data text)');
    database.prepare('insert into message values (?, ?, ?)').run(
      'message-1',
      "session-'quoted",
      '{"role":"assistant"}',
    );
    database.close();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { force: true, recursive: true });
  });

  it('reads multiple parameterized queries outside the renderer process', async () => {
    await expect(readAcpSqliteRows(databasePath, [
      {
        params: ["session-'quoted"],
        sql: 'select id, data from message where session_id = ?',
      },
      {
        params: ['missing-session'],
        sql: 'select id from message where session_id = ?',
      },
    ])).resolves.toEqual([
      [{ id: 'message-1', data: '{"role":"assistant"}' }],
      [],
    ]);
  });

  it('returns null for unreadable databases', async () => {
    await expect(readAcpSqliteRows(path.join(tempDir, 'missing.db'), [{
      sql: 'select * from message',
    }])).resolves.toBeNull();
  });
});
