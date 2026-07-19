import type { VaultSearchTurnContext } from '../../../core/runtime/types';
import { t } from '../../../i18n/i18n';

const MAX_VISIBLE_SOURCES = 3;

function createChild<K extends keyof HTMLElementTagNameMap>(
  parentEl: HTMLElement,
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  return parentEl.createEl(tagName, className ? { cls: className } : undefined);
}

function uniqueSourcePaths(context: VaultSearchTurnContext): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const snippet of context.snippets) {
    const path = snippet.source.path;
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    paths.push(path);
  }

  return paths;
}

export function renderVaultSearchSources(
  containerEl: HTMLElement,
  context: VaultSearchTurnContext,
  openVaultPath: (path: string) => void,
): void {
  if (context.snippets.length === 0) {
    return;
  }

  const paths = uniqueSourcePaths(context);
  if (paths.length === 0) {
    return;
  }

  const rowEl = createChild(containerEl, 'div', 'grimoire-vault-search-sources');
  const labelEl = createChild(rowEl, 'span', 'grimoire-vault-search-label');
  labelEl.textContent = t('chat.vaultSearch.sources', {
    count: paths.length,
    sourceLabel: t(paths.length === 1 ? 'chat.vaultSearch.sourceSingular' : 'chat.vaultSearch.sourcePlural'),
  });

  for (const path of paths.slice(0, MAX_VISIBLE_SOURCES)) {
    const sourceEl = createChild(rowEl, 'button', 'grimoire-vault-search-source');
    sourceEl.type = 'button';
    sourceEl.textContent = path;
    sourceEl.addEventListener('click', () => openVaultPath(path));
  }

  const overflowCount = paths.length - MAX_VISIBLE_SOURCES;
  if (overflowCount > 0) {
    const overflowEl = createChild(rowEl, 'span', 'grimoire-vault-search-overflow');
    overflowEl.textContent = `+${overflowCount}`;
  }
}
