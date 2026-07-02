import { readFileSync } from 'fs';

function readInputCss(): string {
  return readFileSync('src/style/components/input.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('input.css', () => {
  it('does not hard-cap compact chat textarea height before auto-resize runs', () => {
    const css = readInputCss();
    const rule = getRule(css, '.grimoire-container--chat-window .grimoire-input');

    expect(rule).not.toContain('120px');
    expect(rule).toContain('max-height: var(--grimoire-textarea-max-height, none)');
  });
});
