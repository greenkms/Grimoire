import { createMockEl } from '@test/helpers/mockElement';

import { renderProjectWorkspaceSettings } from '@/features/settings/ProjectWorkspaceSettings';
import { setLocale } from '@/i18n/i18n';

function findByTagAndAttribute<T extends { tagName: string; children: T[]; getAttribute: (name: string) => string | null }>(
  element: T,
  tagName: string,
  attributeName: string,
  attributeValue: string,
): T | null {
  if (element.tagName === tagName.toUpperCase() && element.getAttribute(attributeName) === attributeValue) {
    return element;
  }
  for (const child of element.children) {
    const found = findByTagAndAttribute(child, tagName, attributeName, attributeValue);
    if (found) {
      return found;
    }
  }
  return null;
}

function findButtonByText<T extends { tagName: string; textContent: string; children: T[] }>(
  element: T,
  text: string,
): T | null {
  if (element.tagName === 'BUTTON' && element.textContent === text) {
    return element;
  }
  for (const child of element.children) {
    const found = findButtonByText(child, text);
    if (found) {
      return found;
    }
  }
  return null;
}

function findByTagAndText<T extends { tagName: string; textContent: string; children: T[] }>(
  element: T,
  tagName: string,
  text: string,
): T | null {
  if (element.tagName === tagName.toUpperCase() && element.textContent === text) {
    return element;
  }
  for (const child of element.children) {
    const found = findByTagAndText(child, tagName, text);
    if (found) {
      return found;
    }
  }
  return null;
}

describe('renderProjectWorkspaceSettings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders and saves context engine controls', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: '',
          projectWorkspaces: [],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const vaultToggle = findByTagAndAttribute(
      container as any,
      'input',
      'aria-label',
      'Enable vault search',
    ) as HTMLInputElement;
    vaultToggle.checked = false;
    vaultToggle.dispatchEvent(new Event('change'));
    await Promise.resolve();

    const maxResultsInput = findByTagAndAttribute(
      container as any,
      'input',
      'aria-label',
      'Vault search results',
    ) as HTMLInputElement;
    maxResultsInput.value = '12';
    maxResultsInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    const snippetInput = findByTagAndAttribute(
      container as any,
      'input',
      'aria-label',
      'Vault search snippet length',
    ) as HTMLInputElement;
    snippetInput.value = '50';
    snippetInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    const relevantInput = findByTagAndAttribute(
      container as any,
      'input',
      'aria-label',
      'Relevant notes results',
    ) as HTMLInputElement;
    relevantInput.value = '10';
    relevantInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(plugin.settings.contextEngine.vaultSearchEnabled).toBe(false);
    expect(plugin.settings.contextEngine.vaultSearchMaxResults).toBe(12);
    expect(plugin.settings.contextEngine.vaultSearchMaxSnippetChars).toBe(120);
    expect(plugin.settings.contextEngine.relevantNotesMaxResults).toBe(10);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(4);
  });

  it('renders context engine controls inside the shared settings panel structure', () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: '',
          projectWorkspaces: [],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const contextPanel = (container as any).querySelector('.grimoire-context-engine-settings');
    const workspacePanel = (container as any).querySelector('.grimoire-project-workspaces-settings');
    const workspaceHeader = (container as any).querySelector('.grimoire-project-workspaces-header');
    const controlCells = (container as any).querySelectorAll('.grimoire-context-engine-setting-control');

    expect(contextPanel?.hasClass('grimoire-settings-panel')).toBe(true);
    expect(workspacePanel?.hasClass('grimoire-settings-panel')).toBe(true);
    expect(workspaceHeader).not.toBeNull();
    expect(workspaceHeader?.children.some((child: any) => child.tagName === 'BUTTON')).toBe(true);
    expect(controlCells).toHaveLength(5);
  });

  it('renders existing workspaces and saves normalized edits', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: 'workspace-1',
          projectWorkspaces: [
            {
              id: 'workspace-1',
              name: 'Old name',
              systemPrompt: '',
              vaultFolders: [],
              vaultFiles: [],
              tags: [],
              externalContextPaths: [],
            },
          ],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const nameInput = findByTagAndAttribute(container as any, 'input', 'aria-label', 'Workspace name') as HTMLInputElement;
    nameInput.value = '  New name  ';
    nameInput.dispatchEvent(new Event('change'));

    await Promise.resolve();

    expect(plugin.settings.contextEngine.projectWorkspaces[0].name).toBe('New name');
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it('stores an empty workspace name when the name field is cleared', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: 'workspace-1',
          projectWorkspaces: [
            {
              id: 'workspace-1',
              name: 'Project Alpha',
              systemPrompt: '',
              vaultFolders: [],
              vaultFiles: [],
              tags: [],
              externalContextPaths: [],
            },
          ],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const nameInput = findByTagAndAttribute(container as any, 'input', 'aria-label', 'Workspace name') as HTMLInputElement;
    nameInput.value = '   ';
    nameInput.dispatchEvent(new Event('change'));

    await Promise.resolve();

    expect(plugin.settings.contextEngine.projectWorkspaces[0].name).toBe('');
  });

  it('preserves sequential edits to different fields', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: 'workspace-1',
          projectWorkspaces: [
            {
              id: 'workspace-1',
              name: 'Old name',
              systemPrompt: 'Old prompt',
              vaultFolders: [],
              vaultFiles: [],
              tags: [],
              externalContextPaths: [],
            },
          ],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin });

    const nameInput = findByTagAndAttribute(container as any, 'input', 'aria-label', 'Workspace name') as HTMLInputElement;
    nameInput.value = 'New name';
    nameInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    const systemPromptInput = findByTagAndAttribute(
      container as any,
      'textarea',
      'aria-label',
      'Workspace system prompt',
    ) as HTMLTextAreaElement;
    systemPromptInput.value = 'New prompt';
    systemPromptInput.dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(plugin.settings.contextEngine.projectWorkspaces[0]).toMatchObject({
      name: 'New name',
      systemPrompt: 'New prompt',
    });
  });

  it('adds a new workspace and makes it active', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: '',
          projectWorkspaces: [],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const addButton = findButtonByText(container as any, 'Add workspace') as HTMLButtonElement;
    addButton.click();

    await Promise.resolve();

    expect(plugin.settings.contextEngine.projectWorkspaces).toHaveLength(1);
    expect(plugin.settings.contextEngine.activeProjectWorkspaceId).toBe(
      plugin.settings.contextEngine.projectWorkspaces[0].id,
    );
    expect(plugin.settings.contextEngine.projectWorkspaces[0].name).toBe('');
    expect(plugin.saveSettings).toHaveBeenCalled();
  });

  it('uses a localized new workspace placeholder without storing it as data', async () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: '',
          projectWorkspaces: [],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    setLocale('de');

    renderProjectWorkspaceSettings(container, { plugin: plugin as any });

    const addButton = findButtonByText(container as any, 'Arbeitsbereich hinzufügen') as HTMLButtonElement;
    addButton.click();

    await Promise.resolve();

    expect(plugin.settings.contextEngine.projectWorkspaces[0].name).toBe('');
    expect(findByTagAndAttribute(container as any, 'input', 'placeholder', 'Neuer Arbeitsbereich')).not.toBeNull();
  });

  it('localizes workspace field labels and actions', () => {
    const container = createMockEl('div') as unknown as HTMLElement;
    const plugin: any = {
      settings: {
        contextEngine: {
          vaultSearchEnabled: true,
          vaultSearchMaxResults: 8,
          vaultSearchMaxSnippetChars: 700,
          relevantNotesEnabled: true,
          relevantNotesMaxResults: 6,
          activeProjectWorkspaceId: 'workspace-1',
          projectWorkspaces: [
            {
              id: 'workspace-1',
              name: 'Project Alpha',
              systemPrompt: '',
              vaultFolders: [],
              vaultFiles: [],
              tags: [],
              externalContextPaths: [],
            },
          ],
        },
      },
      saveSettings: jest.fn().mockResolvedValue(undefined),
    };
    setLocale('de');

    renderProjectWorkspaceSettings(container, { plugin });

    expect(findByTagAndText(container as any, 'h3', 'Projektarbeitsbereiche')).not.toBeNull();
    expect(findByTagAndAttribute(container as any, 'input', 'aria-label', 'Arbeitsbereichsname')).not.toBeNull();
    expect(findByTagAndAttribute(container as any, 'textarea', 'aria-label', 'Tresorordner')).not.toBeNull();
    expect(findButtonByText(container as any, 'Arbeitsbereich hinzufügen')).not.toBeNull();
    expect(findButtonByText(container as any, 'Löschen')).not.toBeNull();
  });
});
