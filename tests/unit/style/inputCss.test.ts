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

  it('keeps controls and send on one line until their intrinsic widths require wrapping', () => {
    const css = readInputCss();
    const actionsRule = getRule(css, '.grimoire-container--chat-window .grimoire-input-toolbar-actions-row');
    const configRule = getRule(css, '.grimoire-container--chat-window .grimoire-input-toolbar-config-actions');
    const sendRule = getRule(css, '.grimoire-send-actions');

    expect(actionsRule).toContain('flex-wrap: wrap');
    expect(configRule).toContain('flex: 0 0 auto');
    expect(configRule).toContain('max-width: 100%');
    expect(sendRule).toContain('margin-inline-start: auto');
    expect(css).not.toContain('@container grimoire-composer');
    expect(css).not.toContain('flex: 0 0 100%');
  });

  it('uses a borderless soft-accent send button with a deeper hover surface', () => {
    const css = readInputCss();
    const sendRule = getRule(css, '.grimoire-container--chat-window button.grimoire-send-button');
    const hoverRule = getRule(css, '.grimoire-container--chat-window button.grimoire-send-button:hover');

    expect(sendRule).toContain('border: 0');
    expect(sendRule).toContain('background: var(--grimoire-accent-soft)');
    expect(sendRule).toContain('color: var(--grimoire-accent-text)');
    expect(hoverRule).toContain('background: rgba(var(--grimoire-brand-rgb), 0.22)');
    expect(hoverRule).toContain('filter: none');
  });
});
