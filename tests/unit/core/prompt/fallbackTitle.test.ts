import { buildFallbackTitle } from '@/core/prompt/fallbackTitle';

describe('buildFallbackTitle', () => {
  it('keeps a short single-line message unchanged', () => {
    expect(buildFallbackTitle('Reply only OK')).toBe('Reply only OK');
  });

  it('returns an empty string for a message without usable text', () => {
    expect(buildFallbackTitle('   \n\n  ')).toBe('');
  });

  it('truncates on a word boundary instead of mid-word', () => {
    const message = 'do you know how to run commands such as search inside our shared notes workspace';

    const title = buildFallbackTitle(message);

    expect(title.endsWith('...')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(50);
    expect(title).toBe('do you know how to run commands such as...');
  });

  it('does not end a sentence on a decimal number or version', () => {
    const message = 'update the firmware from 1.4.5 to 1.5.0';

    expect(buildFallbackTitle(message)).toBe('update the firmware from 1.4.5 to 1.5.0');
  });

  it('still ends the title at a real sentence boundary', () => {
    const message = 'Update the changelog. Then double-check the release notes.';

    expect(buildFallbackTitle(message)).toBe('Update the changelog');
  });

  it('skips leading XML context blocks and uses the first real text', () => {
    const message = [
      '<git_status>',
      'This is the git status at the start of the conversation.',
      '</git_status>',
      '',
      'review the work that was done on reducing the running costs',
    ].join('\n');

    expect(buildFallbackTitle(message)).toBe('review the work that was done on reducing the...');
  });

  it('skips a leading self-closing image tag', () => {
    const message = '<image name=[Image #1] path="C:\\TEMP\\shot.png" />\nTell me what this warning means';

    expect(buildFallbackTitle(message)).toBe('Tell me what this warning means');
  });

  it('gathers more text when the first sentence carries almost no signal', () => {
    const message = 'Hi. Need to pick a colour scheme for the dashboard';

    expect(buildFallbackTitle(message)).toBe('Hi. Need to pick a colour scheme for the dashboard');
  });

  it('falls back to a hard cut when a word boundary would discard most of the title', () => {
    const message = 'Read docs/exports/2026-08-26-handoff-summary-and-continue';

    expect(buildFallbackTitle(message)).toBe('Read docs/exports/2026-08-26-handoff-summary-an...');
  });

  it('disambiguates a title that already exists', () => {
    const existingTitles = ['check the build log'];

    const title = buildFallbackTitle('check the build log', { existingTitles });

    expect(title).toBe('check the build log (2)');
  });

  it('keeps counting up when several duplicates already exist', () => {
    const existingTitles = ['ping', 'ping (2)', 'ping (3)'];

    expect(buildFallbackTitle('ping', { existingTitles })).toBe('ping (4)');
  });

  it('keeps the disambiguated title within the length limit', () => {
    const message = 'Read docs/exports/2026-08-26-handoff-summary-and-continue';
    const first = buildFallbackTitle(message);

    const second = buildFallbackTitle(message, { existingTitles: [first] });

    expect(second.length).toBeLessThanOrEqual(50);
    expect(second.endsWith('(2)')).toBe(true);
  });

  it('honours a custom maximum length', () => {
    const title = buildFallbackTitle('pick a colour scheme for the dashboard', { maxLength: 20 });

    expect(title.length).toBeLessThanOrEqual(20);
    expect(title).toBe('pick a colour...');
  });
});
