import { readFileSync } from 'fs';

function readSettingsCss(): string {
  return readFileSync('src/style/settings/base.css', 'utf8').replace(/\r\n/g, '\n');
}

function getRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('settings base CSS', () => {
  it('lets Obsidian and the active theme own setting cards and section geometry', () => {
    const css = readSettingsCss();

    expect(getRule(css, '.grimoire-settings .setting-item')).toBe('');
    expect(getRule(css, '.grimoire-settings .setting-item-heading')).toBe('');
    expect(getRule(css, '.grimoire-settings .setting-item-heading:first-child')).toBe('');
    expect(getRule(css, '.grimoire-adv-body .setting-item-heading:first-child')).toBe('');
    expect(css).not.toContain('border-top: 1px solid var(--background-modifier-border)');
  });

  it('isolates the custom settings page from Obsidian declarative group styling', () => {
    const css = readSettingsCss();
    const groupItemsRule = getRule(
      css,
      '.setting-group.grimoire-settings-root-group > .setting-items',
    );
    const nestedSettingRule = getRule(
      css,
      '.grimoire-settings-root-group .grimoire-settings .setting-item:not(.setting-item-heading)',
    );
    const nestedDividerRule = getRule(
      css,
      '.grimoire-settings-root-group .grimoire-settings .setting-item:not(.setting-item-heading)::before',
    );

    expect(groupItemsRule).toContain('background-color: transparent');
    expect(groupItemsRule).toContain('border: 0');
    expect(nestedSettingRule).toContain('background-color: var(--setting-items-background)');
    expect(nestedSettingRule).toContain('border: var(--setting-items-border-width) solid var(--setting-items-border-color)');
    expect(nestedSettingRule).toContain('border-radius: var(--setting-items-radius)');
    expect(nestedDividerRule).toContain('content: none');
  });

  it('keeps the official gap between the tab bar and the first setting', () => {
    const tabsRule = getRule(readSettingsCss(), '.grimoire-settings-tabs');

    expect(tabsRule).toContain('margin-bottom: 16px');
  });

  it('renders settings tabs as rounded filled segments with an accent underline', () => {
    const css = readSettingsCss();
    const tabRule = getRule(css, '.grimoire-settings-tabs-viewport > .grimoire-settings-tab');
    const activeRule = getRule(css, '.grimoire-settings-tabs-viewport > .grimoire-settings-tab--active,\n.grimoire-settings-tabs-viewport > .grimoire-settings-tab--active:hover');

    expect(tabRule).toContain('height: 30px');
    expect(tabRule).toContain('padding: 0 8px');
    expect(tabRule).toContain('border: 1px solid var(--background-modifier-border)');
    expect(tabRule).toContain('border-radius: var(--gs-r1) var(--gs-r1) 0 0');
    expect(tabRule).toContain('background: var(--background-modifier-form-field)');
    expect(tabRule).toContain('font-weight: 400');

    expect(activeRule).toContain('border-bottom-color: var(--grimoire-brand)');
    expect(activeRule).toContain('border-bottom-width: 3px');
    expect(activeRule).toContain('background: rgba(var(--grimoire-brand-rgb), 0.1)');
    expect(activeRule).toContain('color: var(--grimoire-brand)');
    expect(activeRule).toContain('font-weight: 600');
  });

  it('keeps overflowing provider tabs compact and horizontally scrollable', () => {
    const css = readSettingsCss();
    const viewportRule = getRule(css, '.grimoire-settings-tabs-viewport');
    const tabRule = getRule(css, '.grimoire-settings-tabs-viewport > .grimoire-settings-tab');
    const scrollButtonRule = getRule(css, '.grimoire-settings-tab-scroll');
    const overflowingScrollButtonRule = getRule(css, '.grimoire-settings-tabs.is-overflowing .grimoire-settings-tab-scroll');
    const previousScrollButtonRule = getRule(css, '.grimoire-settings-tab-scroll--previous');
    const nextScrollButtonRule = getRule(css, '.grimoire-settings-tab-scroll--next');

    expect(viewportRule).toContain('overflow-x: auto');
    expect(viewportRule).toContain('gap: 4px');
    expect(tabRule).toContain('flex: 0 0 auto');
    expect(tabRule).toContain('min-width: max-content');
    expect(scrollButtonRule).toContain('width: 26px');
    expect(scrollButtonRule).toContain('height: 30px');
    expect(overflowingScrollButtonRule).toContain('display: inline-flex');
    expect(previousScrollButtonRule).toContain('margin-inline-end: 4px');
    expect(nextScrollButtonRule).toContain('margin-inline-start: 4px');
  });
});
