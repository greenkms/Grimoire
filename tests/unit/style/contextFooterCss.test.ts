import { readFileSync } from 'fs';

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('context footer CSS', () => {
  it('uses only a short, light shadow for the context tooltip', () => {
    const css = readFileSync('src/style/components/context-footer.css', 'utf8');
    const tooltipRule = getRule(css, '.grimoire-context-meter-tip');

    expect(tooltipRule).toContain('box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18)');
    expect(tooltipRule).not.toContain('0 14px 40px');
    expect(tooltipRule).not.toContain('inset');
  });
});
