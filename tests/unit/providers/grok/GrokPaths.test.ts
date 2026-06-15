import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  encodeGrokWorkspaceKey,
  resolveGrokChatHistoryPath,
  resolveGrokDataDir,
  resolveGrokNativeDataDir,
  resolveGrokSessionDirectory,
} from '../../../../src/providers/grok/runtime/GrokPaths';

describe('GrokPaths', () => {
  it('prefers GROK_HOME for managed config data', () => {
    expect(resolveGrokDataDir({
      GROK_HOME: '/tmp/grok-home',
      HOME: '/home/tester',
    } as NodeJS.ProcessEnv)).toBe('/tmp/grok-home');
  });

  it('keeps native session storage under ~/.grok even when GROK_HOME is set', () => {
    expect(resolveGrokNativeDataDir({
      GROK_HOME: '/tmp/grok-home',
      HOME: '/home/tester',
    } as NodeJS.ProcessEnv)).toBe('/home/tester/.grok');
  });

  it('falls back to ~/.grok when GROK_HOME is unset', () => {
    expect(resolveGrokDataDir({
      HOME: '/home/tester',
    } as NodeJS.ProcessEnv)).toBe('/home/tester/.grok');
  });

  it('resolves chat history from the encoded workspace session directory', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-grok-paths-'));
    const home = path.join(tmpRoot, 'home');
    const workspacePath = path.join(tmpRoot, 'vault');
    const sessionId = 'session-123';
    const sessionDir = path.join(
      home,
      '.grok',
      'sessions',
      encodeGrokWorkspaceKey(workspacePath),
      sessionId,
    );
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'chat_history.jsonl'), '{"type":"user","content":"hi"}\n');

    const env = { HOME: home } as NodeJS.ProcessEnv;

    expect(resolveGrokSessionDirectory(sessionId, workspacePath, null, env)).toBe(sessionDir);
    expect(resolveGrokChatHistoryPath(sessionId, workspacePath, null, env)).toBe(
      path.join(sessionDir, 'chat_history.jsonl'),
    );
  });

  it('prefers a persisted session directory when it still contains chat history', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-grok-paths-'));
    const preferredDir = path.join(tmpRoot, 'preferred-session');
    fs.mkdirSync(preferredDir, { recursive: true });
    fs.writeFileSync(path.join(preferredDir, 'chat_history.jsonl'), '{"type":"user","content":"hi"}\n');

    expect(resolveGrokSessionDirectory(
      'session-1',
      '/missing/workspace',
      preferredDir,
    )).toBe(preferredDir);
  });
});