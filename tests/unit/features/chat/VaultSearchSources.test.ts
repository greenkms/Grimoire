/**
 * @jest-environment jsdom
 */

import type { VaultSearchTurnContext } from '@/core/runtime/types';
import { renderVaultSearchSources } from '@/features/chat/ui/VaultSearchSources';
import { setLocale } from '@/i18n/i18n';

function createContext(paths: string[]): VaultSearchTurnContext {
  return {
    query: 'project notes',
    snippets: paths.map((path, index) => ({
      source: {
        id: `source-${index}`,
        path,
        title: path.split('/').pop() ?? path,
        kind: 'vault-note' as const,
      },
      text: `Snippet ${index}`,
      score: 1 - index / 10,
      matchedTerms: ['project'],
    })),
  };
}

describe('renderVaultSearchSources', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('renders the source count and first three source paths', () => {
    const container = document.createElement('div');

    renderVaultSearchSources(
      container,
      createContext(['notes/A.md', 'notes/B.md', 'notes/C.md']),
      jest.fn(),
    );

    const row = container.querySelector('.grimoire-vault-search-sources');
    const sources = Array.from(container.querySelectorAll('.grimoire-vault-search-source'));

    expect(row?.textContent).toContain('Vault search: 3 sources');
    expect(sources.map((source) => source.textContent)).toEqual([
      'notes/A.md',
      'notes/B.md',
      'notes/C.md',
    ]);
  });

  it('opens the clicked source path', () => {
    const container = document.createElement('div');
    const openVaultPath = jest.fn();

    renderVaultSearchSources(container, createContext(['notes/A.md']), openVaultPath);

    const source = container.querySelector<HTMLButtonElement>('.grimoire-vault-search-source');
    source?.click();

    expect(source?.getAttribute('type')).toBe('button');
    expect(openVaultPath).toHaveBeenCalledWith('notes/A.md');
  });

  it('deduplicates source paths and renders overflow count', () => {
    const container = document.createElement('div');

    renderVaultSearchSources(
      container,
      createContext(['notes/A.md', 'notes/B.md', 'notes/A.md', 'notes/C.md', 'notes/D.md']),
      jest.fn(),
    );

    const sources = Array.from(container.querySelectorAll('.grimoire-vault-search-source'));

    expect(container.textContent).toContain('Vault search: 4 sources');
    expect(sources.map((source) => source.textContent)).toEqual([
      'notes/A.md',
      'notes/B.md',
      'notes/C.md',
    ]);
    expect(container.textContent).toContain('+1');
  });

  it('renders nothing for empty snippets', () => {
    const container = document.createElement('div');

    renderVaultSearchSources(container, createContext([]), jest.fn());

    expect(container.childElementCount).toBe(0);
  });

  it('localizes the source count label', () => {
    const container = document.createElement('div');
    setLocale('de');

    renderVaultSearchSources(container, createContext(['notes/A.md']), jest.fn());

    expect(container.textContent).toContain('Tresorsuche: 1 Quelle');
  });
});
