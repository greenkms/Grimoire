import { readFileSync } from 'fs';

function readNavigationCss(): string {
  return readFileSync('src/style/components/nav-sidebar.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

describe('nav-sidebar.css', () => {
  it('anchors the conversation navigator to the chat viewport', () => {
    const css = readNavigationCss();

    expect(getRule(css, '.grimoire-chat-window-grid')).toContain('position: relative');
    expect(getRule(css, '.grimoire-nav-sidebar')).toContain('position: absolute');
    expect(getRule(css, '.grimoire-nav-sidebar.visible')).toContain('pointer-events: auto');
  });

  it('uses theme surfaces for the compact conversation directory', () => {
    const css = readNavigationCss();
    const directory = getRule(css, '.grimoire-nav-directory');

    expect(directory).toContain('background: var(--background-primary)');
    expect(directory).toContain('border: 1px solid var(--background-modifier-border)');
    expect(directory).toContain('box-shadow: 0 4px 12px');
  });
});
