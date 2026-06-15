import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  GROK_FULL_ACCESS_MODE_ID,
  GROK_PLAN_MODE_ID,
  GROK_SAFE_MODE_ID,
} from '../../../../src/providers/grok/modes';
import {
  buildGrokManagedConfigToml,
  prepareGrokLaunchArtifacts,
} from '../../../../src/providers/grok/runtime/GrokLaunchArtifacts';

describe('buildGrokManagedConfigToml', () => {
  it('writes managed agent permission modes and instructions path', () => {
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain('[instructions]');
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain('path = "/vault/.grimoire/grok/system.md"');
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain('username = "Test User"');
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain(`[agent.${GROK_FULL_ACCESS_MODE_ID}]`);
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain(`[agent.${GROK_SAFE_MODE_ID}]`);
    expect(buildGrokManagedConfigToml({
      systemPromptPath: '/vault/.grimoire/grok/system.md',
      userName: 'Test User',
    })).toContain(`[agent.${GROK_PLAN_MODE_ID}]`);
  });

  it('can default a managed aux agent', () => {
    const config = buildGrokManagedConfigToml({
      defaultAgentId: 'grimoire-aux-readonly',
      managedAgents: [{ id: 'grimoire-aux-readonly', permissionMode: 'ask' }],
      systemPromptPath: '/vault/.grimoire/grok/auxiliary/system.md',
    });

    expect(config).toContain('[agents]');
    expect(config).toContain('default = "grimoire-aux-readonly"');
  });
});

describe('prepareGrokLaunchArtifacts', () => {
  it('writes managed_config.toml and system.md under .grimoire/grok', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-grok-artifacts-'));

    const result = await prepareGrokLaunchArtifacts({
      settings: {
        customPrompt: '',
        mediaFolder: '',
        userName: 'Test User',
        vaultPath: tmpRoot,
      },
      workspaceRoot: tmpRoot,
    });

    expect(result.grokHomePath).toBe(path.join(tmpRoot, '.grimoire', 'grok'));
    expect(result.managedConfigPath).toBe(path.join(tmpRoot, '.grimoire', 'grok', 'managed_config.toml'));
    expect(result.systemPromptPath).toBe(path.join(tmpRoot, '.grimoire', 'grok', 'system.md'));
    expect(result.configContent).toContain('username = "Test User"');
    await expect(fs.readFile(result.managedConfigPath, 'utf8')).resolves.toContain('[instructions]');
    await expect(fs.readFile(result.systemPromptPath, 'utf8')).resolves.toContain('Grimoire');
  });

  it('keeps the launch key stable across repeated preparation', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-grok-artifacts-'));
    const baseParams = {
      settings: {
        customPrompt: '',
        mediaFolder: '',
        userName: '',
        vaultPath: tmpRoot,
      },
      workspaceRoot: tmpRoot,
    };
    const first = await prepareGrokLaunchArtifacts(baseParams);
    const second = await prepareGrokLaunchArtifacts(baseParams);

    expect(first.grokHomePath).toBe(second.grokHomePath);
    expect(first.launchKey).toBe(second.launchKey);
  });
});