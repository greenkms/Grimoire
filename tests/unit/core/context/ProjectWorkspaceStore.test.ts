import { ProjectWorkspaceStore } from '@/core/context/ProjectWorkspaceStore';
import type { ProjectWorkspace } from '@/core/context/types';

function createWorkspace(overrides: Partial<ProjectWorkspace> = {}): ProjectWorkspace {
  return {
    id: 'workspace-1',
    name: 'Workspace',
    systemPrompt: '',
    vaultFolders: [],
    vaultFiles: [],
    tags: [],
    externalContextPaths: [],
    ...overrides,
  };
}

describe('ProjectWorkspaceStore', () => {
  it('returns null when the active workspace id is invalid', () => {
    const store = new ProjectWorkspaceStore({
      projectWorkspaces: [createWorkspace({ id: 'existing' })],
      activeProjectWorkspaceId: 'missing',
    });

    expect(store.getActiveWorkspace()).toBeNull();
  });

  it('normalizes workspace strings and dedupes folders and tags', () => {
    const workspace = ProjectWorkspaceStore.normalizeWorkspace({
      id: ' workspace-1 ',
      name: ' Project Alpha ',
      systemPrompt: ' Stay focused. ',
      vaultFolders: [' Projects ', 'Projects', 'Archive'],
      vaultFiles: [],
      tags: ['#alpha', 'alpha', ' beta '],
      externalContextPaths: [],
    });

    expect(workspace).toMatchObject({
      id: 'workspace-1',
      name: 'Project Alpha',
      systemPrompt: 'Stay focused.',
      vaultFolders: ['Projects', 'Archive'],
      tags: ['alpha', 'beta'],
    });
  });

  it('keeps a blank workspace name as data instead of writing an English display fallback', () => {
    const workspace = ProjectWorkspaceStore.normalizeWorkspace({
      id: 'workspace-1',
      name: '   ',
      systemPrompt: '',
      vaultFolders: [],
      vaultFiles: [],
      tags: [],
      externalContextPaths: [],
    });

    expect(workspace.name).toBe('');
  });

  it('generates an id when missing', () => {
    const workspace = ProjectWorkspaceStore.normalizeWorkspace({
      name: 'No Id',
      systemPrompt: '',
      vaultFolders: [],
      vaultFiles: [],
      tags: [],
      externalContextPaths: [],
    });

    expect(workspace.id).toMatch(/^workspace-[a-z0-9]+-[a-z0-9]{6}$/);
  });

  it('omits blank optional provider and model fields', () => {
    const workspace = ProjectWorkspaceStore.normalizeWorkspace({
      id: 'workspace-1',
      name: 'Workspace',
      providerId: '   ',
      model: '',
      systemPrompt: '',
      vaultFolders: [],
      vaultFiles: [],
      tags: [],
      externalContextPaths: [],
    });

    expect(workspace.providerId).toBeUndefined();
    expect(workspace.model).toBeUndefined();
  });

  it('skips malformed entries when normalizing workspace lists', () => {
    const validWorkspace = createWorkspace({
      id: ' valid ',
      name: ' Valid workspace ',
    });

    expect(() => {
      ProjectWorkspaceStore.normalizeWorkspaceList([null, 'bad', validWorkspace]);
    }).not.toThrow();

    expect(ProjectWorkspaceStore.normalizeWorkspaceList([null, 'bad', validWorkspace])).toEqual([
      expect.objectContaining({
        id: 'valid',
        name: 'Valid workspace',
      }),
    ]);
  });
});
