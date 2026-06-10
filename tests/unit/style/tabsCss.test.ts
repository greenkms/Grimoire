import { readFileSync } from 'fs';

function readTabsCss(): string {
  return readFileSync('src/style/components/tabs.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('tabs.css', () => {
  it('keeps focused panel buttons visually flat until selected', () => {
    const css = readTabsCss();

    const baseRule = getRule(css, '.grimoire-panel-tabs button.grimoire-panel-tab');
    expect(baseRule).toContain('appearance: none');
    expect(baseRule).toContain('border: 0');
    expect(baseRule).toContain('background: transparent');
    expect(baseRule).toContain('box-shadow: none');

    expect(getRule(css, '.grimoire-panel-tabs button.grimoire-panel-tab:hover'))
      .toContain('background: transparent');

    const activeRule = getRule(css, '.grimoire-panel-tabs button.grimoire-panel-tab.is-active');
    expect(activeRule).toContain('background: transparent');
    expect(activeRule).toContain('box-shadow: none');
  });
});
