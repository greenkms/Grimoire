import { readFileSync } from 'fs';

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('whats-new-card.css', () => {
  it('caps release notes in an independently contained scroll region', () => {
    const css = readFileSync('src/style/components/whats-new-card.css', 'utf8');
    const listRule = getRule(css, '.grimoire-whats-new-card-list');

    expect(listRule).toContain('max-height: min(48vh, 440px)');
    expect(listRule).toContain('overflow-y: auto');
    expect(listRule).toContain('overscroll-behavior-y: contain');
    expect(listRule).toContain('min-height: 0');
    expect(listRule).toContain('scrollbar-width: thin');
    expect(css).toContain('.grimoire-whats-new-card-list:focus-visible');
  });
});
