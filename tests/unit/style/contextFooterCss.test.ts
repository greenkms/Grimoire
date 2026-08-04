import { readFileSync } from 'fs';

describe('context footer CSS', () => {
  it('does not render a custom oversized context tooltip', () => {
    const css = readFileSync('src/style/components/context-footer.css', 'utf8');
    expect(css).not.toContain('.grimoire-context-meter-tip');
  });
});
