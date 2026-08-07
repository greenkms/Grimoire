jest.mock('obsidian', () => ({
  Modal: class MockModal {},
  Notice: jest.fn(),
  Setting: jest.fn(),
  setIcon: jest.fn(),
}));

import type { ProviderCommandEntry } from '@/core/providers/commands/ProviderCommandEntry';
import { hasProviderSkillNameConflict } from '@/features/settings/ui/ProviderSkillSettings';

function makeEntry(id: string, storagePath: string): ProviderCommandEntry {
  return {
    id,
    providerId: 'opencode',
    kind: 'skill',
    name: 'review',
    description: 'Review code',
    content: 'Review it.',
    scope: 'vault',
    source: 'user',
    isEditable: true,
    isDeletable: true,
    displayPrefix: '/',
    insertPrefix: '/',
    storagePath,
  };
}

describe('hasProviderSkillNameConflict', () => {
  const entries = [
    makeEntry('native-review', '.opencode/skills'),
    makeEntry('compat-review', '.claude/skills'),
  ];

  it('allows the same name in a different physical root', () => {
    expect(hasProviderSkillNameConflict(
      entries,
      'review',
      '.opencode/skills',
      'native-review',
    )).toBe(false);
  });

  it('detects a different entry in the target physical root', () => {
    expect(hasProviderSkillNameConflict(
      entries,
      'REVIEW',
      '.opencode/skills',
    )).toBe(true);
  });

  it('does not let another root block a new provider-native override', () => {
    expect(hasProviderSkillNameConflict(
      [makeEntry('shared-review', '.agents/skills')],
      'review',
      '.opencode/skills',
    )).toBe(false);
  });
});
