jest.mock('obsidian', () => ({
  Modal: class MockModal {},
  Notice: jest.fn(),
  Setting: jest.fn(),
  setIcon: jest.fn(),
}));

jest.mock('@/shared/modals/ConfirmModal', () => ({
  confirmDelete: jest.fn(),
}));

import { createKimicodeAgentPersistenceKey } from '@/providers/kimicode/storage/KimicodeAgentStorage';
import type { KimicodeAgentDefinition } from '@/providers/kimicode/types/agent';
import {
  findKimicodeAgentNameConflict,
  validateKimicodeAgentName,
} from '@/providers/kimicode/ui/KimicodeAgentSettings';

function makeAgent(overrides: Partial<KimicodeAgentDefinition> = {}): KimicodeAgentDefinition {
  return {
    name: 'review',
    description: 'Reviews code.',
    prompt: 'Review carefully.',
    ...overrides,
  };
}

describe('validateKimicodeAgentName', () => {
  it('accepts mixed-case nested names with spaces', () => {
    expect(validateKimicodeAgentName('Security Review/Builder')).toBeNull();
  });

  it('rejects leading or trailing slashes', () => {
    expect(validateKimicodeAgentName('/review')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
    expect(validateKimicodeAgentName('review/')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
  });

  it('rejects dot path segments', () => {
    expect(validateKimicodeAgentName('review/../builder')).toBe(
      'Agent name cannot include "." or ".." path segments',
    );
  });

  it('rejects Windows-reserved filename characters', () => {
    expect(validateKimicodeAgentName('review:builder')).toBe(
      'Agent name path segments cannot contain Windows-reserved filename characters',
    );
  });

  it('rejects leading or trailing whitespace inside a segment', () => {
    expect(validateKimicodeAgentName('review /builder')).toBe(
      'Agent name path segments cannot start or end with whitespace',
    );
  });
});

describe('findKimicodeAgentNameConflict', () => {
  it('detects conflicts against primary-capable agents, not just visible subagents', () => {
    const agents = [
      makeAgent({
        name: 'Builder',
        mode: 'primary',
        persistenceKey: createKimicodeAgentPersistenceKey({ filePath: '.kimicode/agent/Builder.md' }),
      }),
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey: createKimicodeAgentPersistenceKey({ filePath: '.kimicode/agent/review.md' }),
      }),
    ];

    expect(findKimicodeAgentNameConflict(agents, 'builder')?.name).toBe('Builder');
  });

  it('ignores the current backing file when editing in place', () => {
    const persistenceKey = createKimicodeAgentPersistenceKey({ filePath: '.kimicode/agent/review.md' });
    const agents = [
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey,
      }),
    ];

    expect(findKimicodeAgentNameConflict(agents, 'review', persistenceKey)).toBeNull();
  });
});
