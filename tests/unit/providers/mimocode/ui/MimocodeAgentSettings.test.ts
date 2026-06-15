jest.mock('obsidian', () => ({
  Modal: class MockModal {},
  Notice: jest.fn(),
  Setting: jest.fn(),
  setIcon: jest.fn(),
}));

jest.mock('@/shared/modals/ConfirmModal', () => ({
  confirmDelete: jest.fn(),
}));

import { createMimocodeAgentPersistenceKey } from '@/providers/mimocode/storage/MimocodeAgentStorage';
import type { MimocodeAgentDefinition } from '@/providers/mimocode/types/agent';
import {
  findMimocodeAgentNameConflict,
  validateMimocodeAgentName,
} from '@/providers/mimocode/ui/MimocodeAgentSettings';

function makeAgent(overrides: Partial<MimocodeAgentDefinition> = {}): MimocodeAgentDefinition {
  return {
    name: 'review',
    description: 'Reviews code.',
    prompt: 'Review carefully.',
    ...overrides,
  };
}

describe('validateMimocodeAgentName', () => {
  it('accepts mixed-case nested names with spaces', () => {
    expect(validateMimocodeAgentName('Security Review/Builder')).toBeNull();
  });

  it('rejects leading or trailing slashes', () => {
    expect(validateMimocodeAgentName('/review')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
    expect(validateMimocodeAgentName('review/')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
  });

  it('rejects dot path segments', () => {
    expect(validateMimocodeAgentName('review/../builder')).toBe(
      'Agent name cannot include "." or ".." path segments',
    );
  });

  it('rejects Windows-reserved filename characters', () => {
    expect(validateMimocodeAgentName('review:builder')).toBe(
      'Agent name path segments cannot contain Windows-reserved filename characters',
    );
  });

  it('rejects leading or trailing whitespace inside a segment', () => {
    expect(validateMimocodeAgentName('review /builder')).toBe(
      'Agent name path segments cannot start or end with whitespace',
    );
  });
});

describe('findMimocodeAgentNameConflict', () => {
  it('detects conflicts against primary-capable agents, not just visible subagents', () => {
    const agents = [
      makeAgent({
        name: 'Builder',
        mode: 'primary',
        persistenceKey: createMimocodeAgentPersistenceKey({ filePath: '.mimocode/agent/Builder.md' }),
      }),
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey: createMimocodeAgentPersistenceKey({ filePath: '.mimocode/agent/review.md' }),
      }),
    ];

    expect(findMimocodeAgentNameConflict(agents, 'builder')?.name).toBe('Builder');
  });

  it('ignores the current backing file when editing in place', () => {
    const persistenceKey = createMimocodeAgentPersistenceKey({ filePath: '.mimocode/agent/review.md' });
    const agents = [
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey,
      }),
    ];

    expect(findMimocodeAgentNameConflict(agents, 'review', persistenceKey)).toBeNull();
  });
});
