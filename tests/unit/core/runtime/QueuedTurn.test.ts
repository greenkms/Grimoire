import type { ContextSnippet } from '@/core/context/types';
import {
  cloneChatTurnRequest,
  mergeQueuedChatTurns,
  type QueuedChatTurn,
} from '@/core/runtime/QueuedTurn';
import type { ChatTurnRequest } from '@/core/runtime/types';

function createSnippet(overrides: Partial<ContextSnippet> = {}): ContextSnippet {
  return {
    source: {
      id: 'v1',
      path: 'notes/A.md',
      title: 'A',
      kind: 'vault-note',
    },
    text: 'Original text',
    score: 1.23,
    matchedTerms: ['alpha', 'beta'],
    ...overrides,
  };
}

function createWorkspace() {
  return {
    id: 'workspace-1',
    name: 'Workspace',
    systemPrompt: 'Use these notes',
    vaultFolders: ['notes'],
    vaultFiles: ['notes/A.md'],
    tags: ['project'],
    externalContextPaths: ['/tmp/project'],
  };
}

describe('QueuedTurn context cloning', () => {
  it('deep clones vault snippets enough for consumer mutation', () => {
    const request: ChatTurnRequest = {
      text: 'Use search',
      vaultSearchContext: {
        query: 'alpha',
        snippets: [createSnippet()],
      },
    };

    const cloned = cloneChatTurnRequest(request);
    cloned.vaultSearchContext!.snippets[0].text = 'Changed text';
    cloned.vaultSearchContext!.snippets[0].source.path = 'notes/B.md';
    cloned.vaultSearchContext!.snippets[0].matchedTerms.push('gamma');

    expect(request.vaultSearchContext!.snippets[0].text).toBe('Original text');
    expect(request.vaultSearchContext!.snippets[0].source.path).toBe('notes/A.md');
    expect(request.vaultSearchContext!.snippets[0].matchedTerms).toEqual(['alpha', 'beta']);
  });

  it('clones project workspace arrays', () => {
    const request: ChatTurnRequest = {
      text: 'Use workspace',
      projectWorkspaceContext: {
        workspace: createWorkspace(),
      },
    };

    const cloned = cloneChatTurnRequest(request);
    cloned.projectWorkspaceContext!.workspace.vaultFolders.push('drafts');
    cloned.projectWorkspaceContext!.workspace.vaultFiles.push('notes/B.md');
    cloned.projectWorkspaceContext!.workspace.tags.push('archive');
    cloned.projectWorkspaceContext!.workspace.externalContextPaths.push('/tmp/other');

    expect(request.projectWorkspaceContext!.workspace.vaultFolders).toEqual(['notes']);
    expect(request.projectWorkspaceContext!.workspace.vaultFiles).toEqual(['notes/A.md']);
    expect(request.projectWorkspaceContext!.workspace.tags).toEqual(['project']);
    expect(request.projectWorkspaceContext!.workspace.externalContextPaths).toEqual(['/tmp/project']);
  });
});

describe('mergeQueuedChatTurns context merging', () => {
  it('preserves existing contexts when incoming lacks them', () => {
    const existing: QueuedChatTurn = {
      displayContent: 'First',
      request: {
        text: 'First',
        vaultSearchContext: { query: 'first', snippets: [createSnippet()] },
        projectWorkspaceContext: { workspace: createWorkspace() },
      },
    };
    const incoming: QueuedChatTurn = {
      displayContent: 'Second',
      request: { text: 'Second' },
    };

    const merged = mergeQueuedChatTurns(existing, incoming);

    expect(merged.request.vaultSearchContext?.query).toBe('first');
    expect(merged.request.projectWorkspaceContext?.workspace.id).toBe('workspace-1');
  });

  it('uses incoming contexts when incoming provides them', () => {
    const existing: QueuedChatTurn = {
      displayContent: 'First',
      request: {
        text: 'First',
        vaultSearchContext: { query: 'first', snippets: [createSnippet()] },
        projectWorkspaceContext: { workspace: createWorkspace() },
      },
    };
    const incomingWorkspace = {
      ...createWorkspace(),
      id: 'workspace-2',
      vaultFolders: ['incoming'],
    };
    const incoming: QueuedChatTurn = {
      displayContent: 'Second',
      request: {
        text: 'Second',
        vaultSearchContext: {
          query: 'second',
          snippets: [createSnippet({ text: 'Incoming text' })],
        },
        projectWorkspaceContext: { workspace: incomingWorkspace },
      },
    };

    const merged = mergeQueuedChatTurns(existing, incoming);

    expect(merged.request.vaultSearchContext?.query).toBe('second');
    expect(merged.request.vaultSearchContext?.snippets[0].text).toBe('Incoming text');
    expect(merged.request.projectWorkspaceContext?.workspace.id).toBe('workspace-2');
    expect(merged.request.projectWorkspaceContext?.workspace.vaultFolders).toEqual(['incoming']);
  });
});
