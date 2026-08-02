import { readFileSync } from 'fs';

function readModelSelectorCss(): string {
  return readFileSync('src/style/toolbar/model-selector.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

function getLastRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gm'))];
  return matches.at(-1)?.[1] ?? '';
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
    expect(searchRule).toContain('height: 34px');
    expect(searchRule).toContain('min-height: 34px');
    expect(searchRule).toContain('max-height: 34px');
    expect(searchRule).toContain('padding: 0 9px');
  });

  it('frames the model search container so it does not bleed past the dropdown edges', () => {
    const css = readModelSelectorCss();
    const searchRule = getRule(css, '.grimoire-model-search');
    expect(searchRule).toContain('border: 1px solid var(--background-modifier-border)');
    expect(searchRule).toContain('border-radius: 6px');
    expect(searchRule).toContain('box-sizing: border-box');
    expect(searchRule).toMatch(/margin:\s*0/);
  });

  it('prevents the native search input from changing the selector height', () => {
    const css = readModelSelectorCss();
    const inputRule = getRule(css, '.grimoire-model-search input.grimoire-model-search-input[type="search"]');
    expect(inputRule).not.toContain('!important');
    expect(inputRule).toContain('height: 24px');
    expect(inputRule).toContain('min-height: 24px');
    expect(inputRule).toContain('max-height: 24px');
    expect(inputRule).toContain('box-shadow: none');
  });

  it('keeps a readable selected model label before wrapping adjacent controls', () => {
    const css = readModelSelectorCss();
    const selectorRule = getRule(css, '.grimoire-container--chat-window .grimoire-model-selector');
    const buttonRule = getRule(css, '.grimoire-container--chat-window .grimoire-model-btn');

    expect(selectorRule).toContain('min-width: 132px');
    expect(buttonRule).toContain('min-width: 132px');
    expect(buttonRule).toContain('max-width: min(100%, 260px)');
  });

  it('colors the selected model dot from the resolved provider', () => {
    const css = readModelSelectorCss();

    expect(css).toContain('.grimoire-model-button-provider-icon[data-provider="claude"]');
    expect(css).toContain('color: var(--grimoire-provider-claude, #d97757)');
    expect(css).toContain('.grimoire-model-button-provider-icon[data-provider="opencode"]');
    expect(css).toContain('color: var(--grimoire-provider-opencode, #e0b341)');
  });

  it('gives model choices room and preserves distinguishing secondary context', () => {
    const css = readModelSelectorCss();
    const dropdownRule = getRule(css, '.grimoire-container--chat-window .grimoire-model-dropdown');
    const detailRule = getLastRule(css, '.grimoire-model-option-detail');

    expect(dropdownRule).toContain('width: min(360px, calc(100vw - 24px))');
    expect(detailRule).not.toContain('display: none');
    expect(detailRule).toContain('font-size: 10px');
  });
});
