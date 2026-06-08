import { readFileSync } from 'fs';

function readToolcallsCss(): string {
  return readFileSync('src/style/components/toolcalls.css', 'utf8');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

describe('toolcalls.css', () => {
  it('keeps expanded tool output inside the chat viewport', () => {
    const css = readToolcallsCss();

    const contentRule = getRule(css, '.grimoire-tool-step > .grimoire-tool-content');
    expect(contentRule).toContain('max-width: calc(100% - 36px)');
    expect(contentRule).toContain('max-height: min(52vh, 520px)');
    expect(contentRule).toContain('overflow: auto');
  });

  it('wraps long expanded tool output lines instead of clipping them horizontally', () => {
    const css = readToolcallsCss();

    const linesRule = getRule(css, '.grimoire-tool-step .grimoire-tool-lines');
    expect(linesRule).toContain('overflow-x: hidden');

    const lineRule = getRule(css, '.grimoire-tool-step .grimoire-tool-line');
    expect(lineRule).toContain('white-space: pre-wrap');
    expect(lineRule).toContain('overflow-wrap: anywhere');
  });

  it('styles the show-all affordance as part of the expanded output preview', () => {
    const css = readToolcallsCss();

    const actionRule = getRule(css, '.grimoire-tool-truncation-action');
    expect(actionRule).toContain('display: flex');
    expect(actionRule).toContain('justify-content: space-between');
    expect(actionRule).toContain('padding: 8px 10px 6px 0');

    const buttonRule = getRule(css, '.grimoire-tool-show-all');
    expect(buttonRule).toContain('cursor: pointer');
    expect(buttonRule).toContain('border-radius: 999px');
    expect(buttonRule).toContain('padding: 7px 11px');
  });
});
