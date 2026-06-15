import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  resolveExistingGrokDatabasePath,
  resolveGrokDatabasePath,
  resolveGrokDataDir,
} from '../../../../src/providers/grok/runtime/GrokPaths';

describe('GrokPaths', () => {
  it('prefers GROK_HOME when set', () => {
    expect(resolveGrokDataDir({
      GROK_HOME: '/tmp/grok-home',
      HOME: '/home/tester',
    } as NodeJS.ProcessEnv)).toBe('/tmp/grok-home');
  });

  it('falls back to ~/.grok when GROK_HOME is unset', () => {
    expect(resolveGrokDataDir({
      HOME: '/home/tester',
    } as NodeJS.ProcessEnv)).toBe('/home/tester/.grok');
  });

  it('falls back to the existing resolved database when persisted metadata points at a missing path', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-grok-paths-'));
    const grokHome = path.join(tmpRoot, 'grok-home');
    const dbPath = path.join(grokHome, 'grok.db');
    fs.mkdirSync(grokHome, { recursive: true });
    fs.writeFileSync(dbPath, '');

    const env = {
      GROK_HOME: grokHome,
      HOME: path.join(tmpRoot, 'home'),
    } as NodeJS.ProcessEnv;

    expect(resolveGrokDatabasePath(env)).toBe(dbPath);
    expect(resolveExistingGrokDatabasePath('/missing/grok.db', env)).toBe(dbPath);
  });
});