import * as path from 'node:path';

import { resolveClaudeConfigDir } from '@/providers/claude/config/ClaudeConfigDir';

describe('resolveClaudeConfigDir', () => {
  it('uses an absolute CLAUDE_CONFIG_DIR override', () => {
    expect(resolveClaudeConfigDir({
      environment: { CLAUDE_CONFIG_DIR: '/data/claude-config' },
      hostPlatform: 'linux',
      vaultPath: '/vault',
    })).toBe(path.normalize('/data/claude-config'));
  });

  it('resolves relative overrides from the SDK working directory', () => {
    expect(resolveClaudeConfigDir({
      environment: { CLAUDE_CONFIG_DIR: '.runtime/claude' },
      hostPlatform: 'linux',
      vaultPath: '/vault',
    })).toBe(path.resolve('/vault', '.runtime/claude'));
  });

  it('uses the environment home when no override is configured', () => {
    expect(resolveClaudeConfigDir({
      environment: { HOME: '/custom/home' },
      hostPlatform: 'linux',
    })).toBe(path.join('/custom/home', '.claude'));
  });
});
