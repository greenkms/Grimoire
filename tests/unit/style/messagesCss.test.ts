import { readFileSync } from 'fs';

function readMessagesCss(): string {
  return readFileSync('src/style/components/messages.css', 'utf8');
}

function readContainerCss(): string {
  return readFileSync('src/style/base/container.css', 'utf8');
}

function readChatMarkdownCss(): string {
  return [
    readFileSync('src/style/components/messages.css', 'utf8'),
    readFileSync('src/style/components/code.css', 'utf8'),
    readFileSync('src/style/features/image-embed.css', 'utf8'),
  ].join('\n');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

function getExactRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('messages.css', () => {
  it('keeps wide assistant markdown from expanding the chat pane', () => {
    const css = readMessagesCss();

    expect(getRule(css, '.grimoire-container--chat-window .grimoire-message'))
      .toContain('min-width: 0');
    expect(getRule(css, '.grimoire-container--chat-window .grimoire-message-assistant'))
      .toContain('min-width: 0');
    expect(getRule(css, '.grimoire-message-content')).toContain('min-width: 0');
    expect(getRule(css, '.grimoire-text-block')).toContain('min-width: 0');

    const renderedMarkdownRule = getRule(css, '.grimoire-message-content .markdown-rendered');
    expect(renderedMarkdownRule).toContain('max-width: 100%');
    expect(renderedMarkdownRule).toContain('overflow-x: auto');
  });

  it('makes wide markdown tables scroll inside the message instead of clipping text', () => {
    const wrapperRule = getRule(readMessagesCss(), '.grimoire-message-content .grimoire-table-scroll');

    expect(wrapperRule).toContain('display: block');
    expect(wrapperRule).toContain('max-width: 100%');
    expect(wrapperRule).toContain('overflow-x: auto');
    expect(wrapperRule).toContain('overflow-y: hidden');

    const tableRule = getRule(readMessagesCss(), '.grimoire-message-content .grimoire-table-scroll > table');

    expect(tableRule).toContain('width: max-content');
    expect(tableRule).toContain('min-width: 100%');
    expect(tableRule).toContain('max-width: none');
    expect(tableRule).toContain('table-layout: auto');

    const cellRule = getRule(readMessagesCss(), '.grimoire-message-content th,\n.grimoire-message-content td');
    expect(cellRule).toContain('overflow-wrap: normal');
    expect(cellRule).toContain('word-break: normal');
    expect(cellRule).toContain('white-space: nowrap');
  });

  it('wraps provider markdown prose without clipping long links or paths', () => {
    const css = readMessagesCss();

    expect(getRule(css, '.grimoire-message-content p')).toContain('overflow-wrap: anywhere');
    expect(getRule(css, '.grimoire-message-content li,\n.grimoire-message-content a,\n.grimoire-message-content blockquote,\n.grimoire-message-content details,\n.grimoire-message-content summary')).toContain('overflow-wrap: anywhere');
    expect(getRule(css, '.grimoire-message-content h1,\n.grimoire-message-content h2,\n.grimoire-message-content h3,\n.grimoire-message-content h4,\n.grimoire-message-content h5,\n.grimoire-message-content h6')).toContain('overflow-wrap: anywhere');
  });

  it('keeps a small inline-end buffer so wrapped markdown glyphs and copy controls are not clipped', () => {
    const css = readMessagesCss();
    const textBlockRule = getRule(css, '.grimoire-text-block');
    const renderedMarkdownRule = getRule(
      css,
      '.grimoire-message-content .markdown-rendered'
    );
    const copyButtonRule = getRule(css, '.grimoire-text-copy-btn');

    expect(textBlockRule).toContain('--grimoire-text-block-inline-end-buffer: 44px');
    expect(textBlockRule).toContain('box-sizing: border-box');
    expect(textBlockRule).toContain('padding-inline-end: var(--grimoire-text-block-inline-end-buffer)');
    expect(renderedMarkdownRule).toContain('box-sizing: border-box');
    expect(renderedMarkdownRule).toContain('padding-inline-end: var(--grimoire-text-block-inline-end-buffer, 28px)');
    expect(copyButtonRule).toContain('inset-inline-end: 12px');
    expect(copyButtonRule).toContain('width: 24px');
    expect(copyButtonRule).toContain('height: 24px');
    expect(copyButtonRule).toContain('box-sizing: border-box');
  });

  it('keeps assistant markdown and copy controls in a capped content column on wide panes', () => {
    const assistantTextBlockRule = getExactRule(
      readMessagesCss(),
      '.grimoire-message-assistant .grimoire-text-block'
    );

    expect(assistantTextBlockRule).toContain('justify-self: start');
    expect(assistantTextBlockRule).toContain('width: 100%');
    expect(assistantTextBlockRule).toContain('max-width: min(100%, 760px)');
  });

  it('does not reserve assistant copy-button space inside user bubbles', () => {
    const userTextBlockRule = getExactRule(
      readMessagesCss(),
      '.grimoire-message-user .grimoire-text-block'
    );

    expect(userTextBlockRule).toContain('--grimoire-text-block-inline-end-buffer: 0px');
    expect(userTextBlockRule).toContain('padding-inline-end: 0');
  });

  it('anchors the scroll resume button to the composer edge instead of the chat grid', () => {
    const scrollResumeRule = getExactRule(
      readMessagesCss(),
      '.grimoire-scroll-resume-btn'
    );

    expect(scrollResumeRule).toContain('position: absolute');
    expect(scrollResumeRule).toContain('top: -36px');
    expect(scrollResumeRule).toContain('inset-inline-end: calc(var(--grimoire-window-padding-x) + 8px)');
    expect(scrollResumeRule).not.toContain('grid-row');
    expect(scrollResumeRule).not.toContain('grid-column');

    const scrollResumeIconRule = getExactRule(
      readMessagesCss(),
      '.grimoire-scroll-resume-btn svg,\n.grimoire-scroll-resume-btn .svg-icon'
    );
    expect(scrollResumeIconRule).toContain('display: block');
    expect(scrollResumeIconRule).toContain('width: 18px');
    expect(scrollResumeIconRule).toContain('height: 18px');
    expect(scrollResumeIconRule).toContain('overflow: visible');
  });

  it('can hide the chat scrollbar while streaming is auto-following output', () => {
    const css = readContainerCss();

    expect(getExactRule(css, '.grimoire-chat-scroll.grimoire-chat-scroll--quiet'))
      .toContain('scrollbar-width: none');
    expect(getExactRule(css, '.grimoire-chat-scroll.grimoire-chat-scroll--quiet::-webkit-scrollbar'))
      .toContain('width: 0');
  });

  it('constrains provider markdown media and raw html embeds to the chat width', () => {
    const mediaRule = getRule(
      readChatMarkdownCss(),
      '.grimoire-message-content img,\n.grimoire-message-content video,\n.grimoire-message-content iframe,\n.grimoire-message-content canvas,\n.grimoire-message-content svg'
    );

    expect(mediaRule).toContain('max-width: 100%');
    expect(mediaRule).toContain('height: auto');
  });

  it('keeps code blocks and inline code inside the markdown layout boundary', () => {
    const css = readChatMarkdownCss();

    expect(getRule(css, '.grimoire-code-wrapper')).toContain('max-width: 100%');
    expect(getRule(css, '.grimoire-message-content pre')).toContain('max-width: 100%');
    expect(getRule(css, '.grimoire-message-content :not(pre) > code')).toContain('overflow-wrap: anywhere');
  });
});
