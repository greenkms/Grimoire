import { readFileSync } from 'fs';

function readModelSelectorCss(): string {
  return readFileSync('src/style/toolbar/model-selector.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('model-selector.css', () => {
  it('keeps provider group headers visually flat', () => {
    const css = readModelSelectorCss();

    const baseRule = getRule(css, '.grimoire-model-dropdown button.grimoire-model-group');
    expect(baseRule).toContain('appearance: none');
    expect(baseRule).toContain('border: 0');
    expect(baseRule).toContain('background: transparent');
    expect(baseRule).toContain('box-shadow: none');

    const hoverRule = getRule(css, '.grimoire-model-dropdown button.grimoire-model-group:hover');
    expect(hoverRule).toContain('background: transparent');
    expect(hoverRule).toContain('box-shadow: none');
  });

  it('keeps the model search container height stable while filtering', () => {
    const css = readModelSelectorCss();
    const searchRule = getRule(css, '.grimoire-model-search');
    expect(searchRule).toContain('height: 48px');
    expect(searchRule).toContain('min-height: 48px');
    expect(searchRule).toContain('max-height: 48px');
    expect(searchRule).toContain('padding: 0 12px');
  });

  it('frames the model search container so it does not bleed past the dropdown edges', () => {
    const css = readModelSelectorCss();
    const searchRule = getRule(css, '.grimoire-model-search');
    expect(searchRule).toContain('border: 1px solid var(--grimoire-line-3)');
    expect(searchRule).toContain('border-radius: var(--grimoire-radius-2)');
    expect(searchRule).toContain('box-sizing: border-box');
    expect(searchRule).toMatch(/margin:\s*0/);
  });

  it('prevents the native search input from changing the selector height', () => {
    const css = readModelSelectorCss();
    const inputRule = getRule(css, '.grimoire-model-search input.grimoire-model-search-input[type="search"]');
    expect(inputRule).toContain('height: 24px !important');
    expect(inputRule).toContain('min-height: 24px !important');
    expect(inputRule).toContain('max-height: 24px !important');
    expect(inputRule).toContain('box-shadow: none !important');
  });
});
