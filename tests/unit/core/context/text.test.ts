import {
  escapeXmlAttribute,
  escapeXmlText,
  extractBestSnippet,
  normalizeSearchTerm,
  tokenizeSearchText,
} from '@/core/context/text';

describe('context text utilities', () => {
  it('normalizes search terms', () => {
    expect(normalizeSearchTerm('Roadmap!')).toBe('roadmap');
    expect(normalizeSearchTerm('#Project/Alpha')).toBe('projectalpha');
    expect(normalizeSearchTerm('知识库')).toBe('知识库');
  });

  it('tokenizes search text in first-seen order', () => {
    expect(tokenizeSearchText('Roadmap roadmap, Project Alpha')).toEqual([
      'roadmap',
      'project',
      'alpha',
    ]);
  });

  it('escapes XML text content', () => {
    expect(escapeXmlText('A < B & C')).toBe('A &lt; B &amp; C');
  });

  it('escapes XML attribute content', () => {
    expect(escapeXmlAttribute('"A" & B')).toBe('&quot;A&quot; &amp; B');
  });

  it('extracts a bounded snippet around the first matching term', () => {
    expect(
      extractBestSnippet(
        'Intro paragraph. The project roadmap has milestones and risks. Closing paragraph.',
        ['roadmap'],
        36
      )
    ).toBe('...project roadmap has milestones...');
  });

  it('matches decomposed unicode text without using transformed offsets', () => {
    expect(
      extractBestSnippet(
        'Opening sentence. Nearby cafe\u0301 menu has notes. Closing paragraph.',
        ['café'],
        25
      )
    ).toBe('...Nearby cafe\u0301 menu...');
  });

  it('includes content when the first snippet word exceeds the limit', () => {
    expect(
      extractBestSnippet('supercalifragilistic suffix', ['supercalifragilistic'], 10)
    ).toBe('superca...');
  });

  it('keeps matched term content for small snippet limits', () => {
    const snippet = extractBestSnippet('one two roadmap after', ['roadmap'], 10);

    expect(snippet).toContain('roadmap');
    expect(snippet.length).toBeLessThanOrEqual(10);
  });

  it('preserves the full matched term when it exactly fits the limit', () => {
    expect(extractBestSnippet('one two roadmap after', ['roadmap'], 7)).toBe(
      'roadmap'
    );
  });

  it('keeps tiny snippets within max length with visible content', () => {
    const snippet = extractBestSnippet('zero one roadmap after', ['roadmap'], 5);

    expect(snippet.length).toBeLessThanOrEqual(5);
    expect(snippet).toMatch(/[^.]/u);
  });
});
