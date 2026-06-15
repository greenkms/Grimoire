jest.mock('obsidian', () => ({
  Modal: class MockModal {},
  Notice: jest.fn(),
  Setting: jest.fn(),
  setIcon: jest.fn(),
}));

jest.mock('@/shared/modals/ConfirmModal', () => ({
  confirmDelete: jest.fn(),
}));

import { createGrokAgentPersistenceKey } from '@/providers/grok/storage/GrokAgentStorage';
import type { GrokAgentDefinition } from '@/providers/grok/types/agent';
import {
  findGrokAgentNameConflict,
  validateGrokAgentName,
} from '@/providers/grok/ui/GrokAgentSettings';

function makeAgent(overrides: Partial<GrokAgentDefinition> = {}): GrokAgentDefinition {
  return {
    name: 'review',
    description: 'Reviews code.',
    prompt: 'Review carefully.',
    ...overrides,
  };
}

describe('validateGrokAgentName', () => {
  it('accepts mixed-case nested names with spaces', () => {
    expect(validateGrokAgentName('Security Review/Builder')).toBeNull();
  });

  it('rejects leading or trailing slashes', () => {
    expect(validateGrokAgentName('/review')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
    expect(validateGrokAgentName('review/')).toBe(
      'Agent name must use slash-separated path segments without leading or trailing slashes',
    );
  });

  it('rejects dot path segments', () => {
    expect(validateGrokAgentName('review/../builder')).toBe(
      'Agent name cannot include "." or ".." path segments',
    );
  });

  it('rejects Windows-reserved filename characters', () => {
    expect(validateGrokAgentName('review:builder')).toBe(
      'Agent name path segments cannot contain Windows-reserved filename characters',
    );
  });

  it('rejects leading or trailing whitespace inside a segment', () => {
    expect(validateGrokAgentName('review /builder')).toBe(
      'Agent name path segments cannot start or end with whitespace',
    );
  });
});

describe('findGrokAgentNameConflict', () => {
  it('detects conflicts against primary-capable agents, not just visible subagents', () => {
    const agents = [
      makeAgent({
        name: 'Builder',
        mode: 'primary',
        persistenceKey: createGrokAgentPersistenceKey({ filePath: '.grok/agent/Builder.md' }),
      }),
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey: createGrokAgentPersistenceKey({ filePath: '.grok/agent/review.md' }),
      }),
    ];

    expect(findGrokAgentNameConflict(agents, 'builder')?.name).toBe('Builder');
  });

  it('ignores the current backing file when editing in place', () => {
    const persistenceKey = createGrokAgentPersistenceKey({ filePath: '.grok/agent/review.md' });
    const agents = [
      makeAgent({
        name: 'review',
        mode: 'subagent',
        persistenceKey,
      }),
    ];

    expect(findGrokAgentNameConflict(agents, 'review', persistenceKey)).toBeNull();
  });
});
