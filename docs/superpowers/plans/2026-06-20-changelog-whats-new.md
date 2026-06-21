# Changelog What's New Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `CHANGELOG.md` as Grimoire's release-note source of truth and show a one-time in-app `What's New` modal after updates, with permanent access from Settings.

**Architecture:** Keep changelog parsing and one-time display decisions in provider-neutral app code. Read the bundled `CHANGELOG.md` from the installed plugin directory, parse only supported user-facing categories, and pass a small release view model into a UI-only modal. Settings owns the persistent manual entry point; plugin load owns automatic display.

**Tech Stack:** TypeScript, Obsidian Modal/Setting APIs, existing Grimoire settings storage, Jest via `npm run test -- --selectProjects unit`, release helper scripts.

---

## File Structure

- Create `CHANGELOG.md`: repository source of truth using `## 1.0.22 - YYYY-MM-DD` sections and `Added`/`Improved`/`Fixed` categories.
- Create `src/app/changelog/types.ts`: changelog release and category types.
- Create `src/app/changelog/parser.ts`: pure parser from markdown to release view models.
- Create `src/app/changelog/display.ts`: pure helpers for semver comparison and one-time display decisions.
- Create `src/app/changelog/source.ts`: resolves and reads bundled `CHANGELOG.md` through the vault adapter.
- Create `src/shared/modals/WhatsNewModal.ts`: renders the release modal and persists only through callbacks.
- Modify `src/core/types/settings.ts`: add `lastSeenChangelogVersion?: string`.
- Modify `src/app/settings/defaultSettings.ts`: set `lastSeenChangelogVersion: ''`.
- Modify `src/main.ts`: read changelog and show the automatic modal after settings tab registration.
- Modify `src/features/settings/GrimoireSettings.ts`: add a permanent `What's new` action beside the version.
- Modify `scripts/releaseBundle.js`: copy `CHANGELOG.md` into `dist/grimoire`.
- Modify `esbuild.config.mjs`: copy `CHANGELOG.md` into the local Obsidian plugin folder during dev/build copies.
- Create tests:
  - `tests/unit/app/changelog/parser.test.ts`
  - `tests/unit/app/changelog/display.test.ts`
  - `tests/unit/app/changelog/source.test.ts`
  - `tests/unit/shared/modals/WhatsNewModal.test.ts`
- Modify tests:
  - `tests/unit/features/settings/GrimoireSettings.test.ts`
  - `tests/integration/main.test.ts`
  - `tests/unit/scripts/releaseBundle.test.ts`

## Task 1: Changelog Parser And Decision Helpers

**Files:**
- Create: `CHANGELOG.md`
- Create: `src/app/changelog/types.ts`
- Create: `src/app/changelog/parser.ts`
- Create: `src/app/changelog/display.ts`
- Test: `tests/unit/app/changelog/parser.test.ts`
- Test: `tests/unit/app/changelog/display.test.ts`

- [ ] **Step 1: Create the initial failing parser tests**

Create `tests/unit/app/changelog/parser.test.ts`:

```ts
import { parseChangelogRelease } from '@/app/changelog/parser';

const sample = `# Changelog

## 1.0.23 - 2026-06-20

### Added

- Added item one.
- Added item two.

### Improved

- Improved item.

### Fixed

- Fixed item.

### Internal

- Maintainer-only detail.

## 1.0.22 - 2026-06-19

### Fixed

- Older fix.
`;

describe('parseChangelogRelease', () => {
  it('parses supported categories for the requested version', () => {
    expect(parseChangelogRelease(sample, '1.0.23')).toEqual({
      version: '1.0.23',
      date: '2026-06-20',
      categories: [
        { title: 'Added', items: ['Added item one.', 'Added item two.'] },
        { title: 'Improved', items: ['Improved item.'] },
        { title: 'Fixed', items: ['Fixed item.'] },
      ],
    });
  });

  it('ignores unsupported categories', () => {
    const release = parseChangelogRelease(sample, '1.0.23');
    expect(release?.categories.map(category => category.title)).toEqual([
      'Added',
      'Improved',
      'Fixed',
    ]);
  });

  it('returns null when the version is absent', () => {
    expect(parseChangelogRelease(sample, '9.9.9')).toBeNull();
  });

  it('returns null when the version has no supported items', () => {
    expect(parseChangelogRelease('## 1.0.24\n\n### Internal\n\n- Hidden.', '1.0.24')).toBeNull();
  });
});
```

- [ ] **Step 2: Create the initial failing display-decision tests**

Create `tests/unit/app/changelog/display.test.ts`:

```ts
import { shouldShowWhatsNew } from '@/app/changelog/display';

describe('shouldShowWhatsNew', () => {
  it('shows when the user has never seen a changelog version', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '' })).toBe(true);
  });

  it('shows when the installed version is newer than the last seen version', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '1.0.22' })).toBe(true);
  });

  it('does not show when the current version has already been seen', () => {
    expect(shouldShowWhatsNew({ currentVersion: '1.0.23', lastSeenVersion: '1.0.23' })).toBe(false);
  });

  it('does not show for invalid current versions', () => {
    expect(shouldShowWhatsNew({ currentVersion: '', lastSeenVersion: '1.0.22' })).toBe(false);
    expect(shouldShowWhatsNew({ currentVersion: 'unknown', lastSeenVersion: '1.0.22' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run the parser and decision tests to verify they fail**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/app/changelog/parser.test.ts tests/unit/app/changelog/display.test.ts
```

Expected: FAIL because `src/app/changelog/parser.ts` and `src/app/changelog/display.ts` do not exist yet.

- [ ] **Step 4: Add the parser and display implementation**

Create `src/app/changelog/types.ts`:

```ts
export const CHANGELOG_CATEGORY_TITLES = ['Added', 'Improved', 'Fixed'] as const;

export type ChangelogCategoryTitle = typeof CHANGELOG_CATEGORY_TITLES[number];

export interface ChangelogCategory {
  title: ChangelogCategoryTitle;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date?: string;
  categories: ChangelogCategory[];
}
```

Create `src/app/changelog/parser.ts`:

```ts
import {
  CHANGELOG_CATEGORY_TITLES,
  type ChangelogCategory,
  type ChangelogCategoryTitle,
  type ChangelogRelease,
} from './types';

const RELEASE_HEADING = /^##\s+([0-9]+\.[0-9]+\.[0-9]+)(?:\s+-\s+(.+?))?\s*$/;
const CATEGORY_HEADING = /^###\s+(.+?)\s*$/;
const BULLET = /^-\s+(.+?)\s*$/;

function isSupportedCategory(value: string): value is ChangelogCategoryTitle {
  return (CHANGELOG_CATEGORY_TITLES as readonly string[]).includes(value);
}

function findReleaseBlock(markdown: string, version: string): { date?: string; body: string } | null {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  let date: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(RELEASE_HEADING);
    if (!match) {
      continue;
    }
    if (match[1] === version) {
      start = index + 1;
      date = match[2]?.trim();
      break;
    }
  }

  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start; index < lines.length; index++) {
    if (RELEASE_HEADING.test(lines[index])) {
      end = index;
      break;
    }
  }

  return {
    date,
    body: lines.slice(start, end).join('\n'),
  };
}

export function parseChangelogRelease(markdown: string, version: string): ChangelogRelease | null {
  const trimmedVersion = version.trim();
  if (!trimmedVersion) {
    return null;
  }

  const releaseBlock = findReleaseBlock(markdown, trimmedVersion);
  if (!releaseBlock) {
    return null;
  }

  const categories = new Map<ChangelogCategoryTitle, string[]>();
  let currentCategory: ChangelogCategoryTitle | null = null;

  for (const line of releaseBlock.body.split(/\r?\n/)) {
    const headingMatch = line.match(CATEGORY_HEADING);
    if (headingMatch) {
      const title = headingMatch[1].trim();
      currentCategory = isSupportedCategory(title) ? title : null;
      continue;
    }

    const bulletMatch = line.match(BULLET);
    if (!bulletMatch || !currentCategory) {
      continue;
    }

    const item = bulletMatch[1].trim();
    if (!item) {
      continue;
    }

    const items = categories.get(currentCategory) ?? [];
    items.push(item);
    categories.set(currentCategory, items);
  }

  const orderedCategories: ChangelogCategory[] = CHANGELOG_CATEGORY_TITLES
    .map(title => ({ title, items: categories.get(title) ?? [] }))
    .filter(category => category.items.length > 0);

  if (orderedCategories.length === 0) {
    return null;
  }

  return {
    version: trimmedVersion,
    date: releaseBlock.date,
    categories: orderedCategories,
  };
}
```

Create `src/app/changelog/display.ts`:

```ts
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(value: string): [number, number, number] | null {
  const match = value.trim().match(SEMVER);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    return null;
  }

  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

export function shouldShowWhatsNew(options: {
  currentVersion: string | null | undefined;
  lastSeenVersion: string | null | undefined;
}): boolean {
  const currentVersion = options.currentVersion?.trim() ?? '';
  if (!parseSemver(currentVersion)) {
    return false;
  }

  const lastSeenVersion = options.lastSeenVersion?.trim() ?? '';
  if (!lastSeenVersion) {
    return true;
  }

  const comparison = compareSemver(currentVersion, lastSeenVersion);
  return comparison !== null && comparison > 0;
}
```

- [ ] **Step 5: Add the first changelog entry**

Create `CHANGELOG.md`:

```md
# Changelog

## 1.0.22 - 2026-06-20

### Added

- Added Antigravity CLI support with provider settings, launch handling, and model discovery.
- Added Gemini CLI (Legacy) as a provider option for users who still rely on the classic Gemini CLI.

### Improved

- Documented provider limitations and release tag expectations for safer Obsidian releases.

### Fixed

- Fixed Antigravity launch assertions and localized provider limitation copy.
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/app/changelog/parser.test.ts tests/unit/app/changelog/display.test.ts
```

Expected: PASS.

Commit:

```bash
git add CHANGELOG.md src/app/changelog/types.ts src/app/changelog/parser.ts src/app/changelog/display.ts tests/unit/app/changelog/parser.test.ts tests/unit/app/changelog/display.test.ts
git commit -m "Add changelog parser"
```

## Task 2: Bundled Changelog Source And Release Bundle

**Files:**
- Create: `src/app/changelog/source.ts`
- Test: `tests/unit/app/changelog/source.test.ts`
- Modify: `scripts/releaseBundle.js`
- Modify: `tests/unit/scripts/releaseBundle.test.ts`
- Modify: `esbuild.config.mjs`

- [ ] **Step 1: Write failing source and bundle tests**

Create `tests/unit/app/changelog/source.test.ts`:

```ts
import { getBundledChangelogPath, readBundledChangelog } from '@/app/changelog/source';

describe('changelog source', () => {
  it('uses manifest.dir when available', () => {
    expect(getBundledChangelogPath({ id: 'grimoire', dir: '.obsidian/plugins/grimoire' })).toBe(
      '.obsidian/plugins/grimoire/CHANGELOG.md',
    );
  });

  it('falls back to the plugin id when manifest.dir is missing', () => {
    expect(getBundledChangelogPath({ id: 'grimoire' })).toBe(
      '.obsidian/plugins/grimoire/CHANGELOG.md',
    );
  });

  it('reads the bundled changelog and returns null on failure', async () => {
    const adapter = {
      read: jest.fn()
        .mockResolvedValueOnce('# Changelog')
        .mockRejectedValueOnce(new Error('missing')),
    };

    await expect(readBundledChangelog(adapter as any, { id: 'grimoire' })).resolves.toBe('# Changelog');
    await expect(readBundledChangelog(adapter as any, { id: 'grimoire' })).resolves.toBeNull();
  });
});
```

Modify `tests/unit/scripts/releaseBundle.test.ts` in the first test:

```ts
writeFileSync(join(rootDir, 'CHANGELOG.md'), '# Changelog');
```

Update the expected result:

```ts
expect(result).toEqual({
  outputDir,
  files: ['main.js', 'manifest.json', 'styles.css', 'CHANGELOG.md'],
});
expect(readdirSync(outputDir).sort()).toEqual([
  'CHANGELOG.md',
  'main.js',
  'manifest.json',
  'styles.css',
]);
expect(readFileSync(join(outputDir, 'CHANGELOG.md'), 'utf8')).toBe('# Changelog');
```

Also add `CHANGELOG.md` fixture writes to release-bundle tests that need all required release artifacts before calling `createReleaseBundle`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/app/changelog/source.test.ts tests/unit/scripts/releaseBundle.test.ts
```

Expected: FAIL because `source.ts` does not exist and `releaseBundle.js` does not copy `CHANGELOG.md`.

- [ ] **Step 3: Implement source reading and bundle copying**

Create `src/app/changelog/source.ts`:

```ts
type ReadableAdapter = {
  read: (path: string) => Promise<string>;
};

type ManifestLike = {
  id?: string;
  dir?: string;
};

export function getBundledChangelogPath(manifest: ManifestLike | null | undefined): string {
  const dir = manifest?.dir?.trim();
  if (dir) {
    return `${dir.replace(/\/+$/, '')}/CHANGELOG.md`;
  }

  const id = manifest?.id?.trim() || 'grimoire';
  return `.obsidian/plugins/${id}/CHANGELOG.md`;
}

export async function readBundledChangelog(
  adapter: ReadableAdapter,
  manifest: ManifestLike | null | undefined,
): Promise<string | null> {
  try {
    return await adapter.read(getBundledChangelogPath(manifest));
  } catch {
    return null;
  }
}
```

Modify `scripts/releaseBundle.js`:

```js
const RELEASE_FILES = ['main.js', 'manifest.json', 'styles.css', 'CHANGELOG.md'];
```

Modify the `copyToObsidian` plugin in `esbuild.config.mjs`:

```js
const files = ['main.js', 'manifest.json', 'styles.css', 'CHANGELOG.md'];
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/app/changelog/source.test.ts tests/unit/scripts/releaseBundle.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/app/changelog/source.ts scripts/releaseBundle.js esbuild.config.mjs tests/unit/app/changelog/source.test.ts tests/unit/scripts/releaseBundle.test.ts
git commit -m "Bundle changelog with releases"
```

## Task 3: What's New Modal

**Files:**
- Create: `src/shared/modals/WhatsNewModal.ts`
- Create: `tests/unit/shared/modals/WhatsNewModal.test.ts`
- Create: `src/style/modals/whats-new.css`
- Modify: `src/style/index.css`

- [ ] **Step 1: Write failing modal tests**

Create `tests/unit/shared/modals/WhatsNewModal.test.ts`:

```ts
import { createMockEl } from '@test/helpers/mockElement';

let lastModalInstance: any;
let createdButtons: any[] = [];

jest.mock('obsidian', () => {
  const actual = jest.requireActual('obsidian');

  class MockModal {
    app: any;
    modalEl: any;
    contentEl: any;

    constructor(app: any) {
      this.app = app;
      this.modalEl = createMockEl();
      this.contentEl = createMockEl();
      lastModalInstance = this;
    }

    setTitle = jest.fn();
    open() { this.onOpen(); }
    close() { this.onClose(); }
    onOpen() {}
    onClose() {}
  }

  class MockSetting {
    constructor(_containerEl: any) {}
    addButton(cb: (btn: any) => void) {
      const btn: any = {
        _onClick: null as null | (() => void),
        setButtonText: jest.fn().mockReturnThis(),
        setCta: jest.fn().mockReturnThis(),
        onClick: jest.fn((handler: () => void) => {
          btn._onClick = handler;
          return btn;
        }),
      };
      createdButtons.push(btn);
      cb(btn);
      return this;
    }
  }

  return { ...actual, Modal: MockModal, Setting: MockSetting };
});

import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';

beforeEach(() => {
  lastModalInstance = null;
  createdButtons = [];
});

describe('WhatsNewModal', () => {
  const release = {
    version: '1.0.23',
    date: '2026-06-20',
    categories: [
      { title: 'Added' as const, items: ['Added one.'] },
      { title: 'Fixed' as const, items: ['Fixed one.'] },
    ],
  };

  it('renders release categories and resolves after Got it', async () => {
    const onDismiss = jest.fn().mockResolvedValue(undefined);
    const promise = showWhatsNewModal({ app: {} as any, release, onDismiss });

    expect(lastModalInstance.setTitle).toHaveBeenCalledWith("What's New in Grimoire v1.0.23");
    expect(lastModalInstance.contentEl.textContent).toContain('Added');
    expect(lastModalInstance.contentEl.textContent).toContain('Added one.');
    expect(lastModalInstance.contentEl.textContent).toContain('Fixed one.');

    createdButtons[0]._onClick();

    await expect(promise).resolves.toBeUndefined();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });

  it('does not call onDismiss when closed without the primary action', async () => {
    const onDismiss = jest.fn().mockResolvedValue(undefined);
    const promise = showWhatsNewModal({ app: {} as any, release, onDismiss });

    lastModalInstance.close();

    await expect(promise).resolves.toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the modal test to verify it fails**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/shared/modals/WhatsNewModal.test.ts
```

Expected: FAIL because `WhatsNewModal.ts` does not exist.

- [ ] **Step 3: Implement the modal**

Create `src/shared/modals/WhatsNewModal.ts`:

```ts
import { type App, Modal, Setting } from 'obsidian';

import type { ChangelogRelease } from '../../app/changelog/types';

interface ShowWhatsNewModalOptions {
  app: App;
  release: ChangelogRelease;
  onDismiss?: () => Promise<void> | void;
}

class WhatsNewModal extends Modal {
  private release: ChangelogRelease;
  private onDismiss?: () => Promise<void> | void;
  private resolve: () => void;
  private dismissed = false;

  constructor(options: ShowWhatsNewModalOptions & { resolve: () => void }) {
    super(options.app);
    this.release = options.release;
    this.onDismiss = options.onDismiss;
    this.resolve = options.resolve;
  }

  onOpen(): void {
    this.setTitle(`What's New in Grimoire v${this.release.version}`);
    this.modalEl.addClass('grimoire-whats-new-modal');

    const summaryEl = this.contentEl.createDiv({ cls: 'grimoire-whats-new-summary' });
    summaryEl.setText(this.release.date ? `Released ${this.release.date}` : 'Latest release notes');

    const listEl = this.contentEl.createDiv({ cls: 'grimoire-whats-new-list' });
    for (const category of this.release.categories) {
      const sectionEl = listEl.createDiv({ cls: 'grimoire-whats-new-section' });
      sectionEl.createEl('h3', { text: category.title });
      const itemListEl = sectionEl.createEl('ul');
      for (const item of category.items) {
        itemListEl.createEl('li', { text: item });
      }
    }

    new Setting(this.contentEl)
      .addButton(button => {
        button
          .setButtonText('Got it')
          .setCta()
          .onClick(() => {
            void this.confirmDismiss();
          });
      });
  }

  private async confirmDismiss(): Promise<void> {
    if (this.dismissed) {
      return;
    }
    this.dismissed = true;
    await this.onDismiss?.();
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve();
  }
}

export function showWhatsNewModal(options: ShowWhatsNewModalOptions): Promise<void> {
  return new Promise(resolve => {
    new WhatsNewModal({ ...options, resolve }).open();
  });
}
```

Create `src/style/modals/whats-new.css`:

```css
.grimoire-whats-new-modal .modal-content {
  width: 520px;
  max-width: 90vw;
}

.grimoire-whats-new-summary {
  margin: 0 0 14px;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
}

.grimoire-whats-new-list {
  display: grid;
  gap: 12px;
}

.grimoire-whats-new-section {
  padding: 12px 14px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-secondary);
}

.grimoire-whats-new-section h3 {
  margin: 0 0 8px;
  color: var(--text-normal);
  font-size: var(--font-ui-medium);
}

.grimoire-whats-new-section ul {
  margin: 0;
  padding-left: 18px;
}

.grimoire-whats-new-section li {
  margin: 4px 0;
  color: var(--text-muted);
  line-height: 1.45;
}
```

Modify `src/style/index.css`:

```css
@import "./modals/whats-new.css";
```

Place the import in the `/* Modals */` section.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/shared/modals/WhatsNewModal.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/shared/modals/WhatsNewModal.ts src/style/modals/whats-new.css src/style/index.css tests/unit/shared/modals/WhatsNewModal.test.ts
git commit -m "Add what's new modal"
```

## Task 4: Plugin Load Auto-Display

**Files:**
- Modify: `src/core/types/settings.ts`
- Modify: `src/app/settings/defaultSettings.ts`
- Modify: `src/main.ts`
- Modify: `tests/integration/main.test.ts`

- [ ] **Step 1: Write failing plugin-load tests**

Mock the modal near the top of `tests/integration/main.test.ts`:

```ts
jest.mock('@/shared/modals/WhatsNewModal', () => ({
  showWhatsNewModal: jest.fn().mockResolvedValue(undefined),
}));
```

Import it:

```ts
import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';
```

Add tests under `describe('onload', () => { ... })`:

```ts
it('shows what is new once when the installed version has not been seen', async () => {
  mockApp.vault.adapter.exists.mockImplementation(async (path: string) => (
    path === '.grimoire/grimoire-settings.json'
  ));
  mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
    if (path === '.grimoire/grimoire-settings.json') {
      return JSON.stringify({ lastSeenChangelogVersion: '0.0.9' });
    }
    if (path === '.obsidian/plugins/grimoire/CHANGELOG.md') {
      return [
        '# Changelog',
        '',
        '## 0.1.0 - 2026-06-20',
        '',
        '### Added',
        '',
        '- Release notes.',
      ].join('\n');
    }
    return '';
  });

  await plugin.onload();

  expect(showWhatsNewModal).toHaveBeenCalledWith(expect.objectContaining({
    app: mockApp,
    release: expect.objectContaining({ version: '0.1.0' }),
    onDismiss: expect.any(Function),
  }));

  const onDismiss = (showWhatsNewModal as jest.Mock).mock.calls[0][0].onDismiss;
  await onDismiss();

  expect(plugin.settings.lastSeenChangelogVersion).toBe('0.1.0');
  expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
    '.grimoire/grimoire-settings.json',
    expect.stringContaining('"lastSeenChangelogVersion": "0.1.0"'),
  );
});

it('does not show what is new when the current version has already been seen', async () => {
  mockApp.vault.adapter.exists.mockImplementation(async (path: string) => (
    path === '.grimoire/grimoire-settings.json'
  ));
  mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
    if (path === '.grimoire/grimoire-settings.json') {
      return JSON.stringify({ lastSeenChangelogVersion: '0.1.0' });
    }
    if (path === '.obsidian/plugins/grimoire/CHANGELOG.md') {
      return '# Changelog\n\n## 0.1.0\n\n### Added\n\n- Release notes.';
    }
    return '';
  });

  await plugin.onload();

  expect(showWhatsNewModal).not.toHaveBeenCalled();
});

it('skips the automatic modal when the current release is missing from the changelog', async () => {
  mockApp.vault.adapter.read.mockImplementation(async (path: string) => {
    if (path === '.obsidian/plugins/grimoire/CHANGELOG.md') {
      return '# Changelog\n\n## 0.0.9\n\n### Added\n\n- Older release.';
    }
    return '';
  });

  await plugin.onload();

  expect(showWhatsNewModal).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: FAIL because `main.ts` does not read or show changelog releases yet.

- [ ] **Step 3: Add settings and plugin-load implementation**

Modify `src/core/types/settings.ts` inside `GrimoireSettings`:

```ts
  // Changelog state
  lastSeenChangelogVersion: string;
```

Modify `src/app/settings/defaultSettings.ts`:

```ts
  lastSeenChangelogVersion: '',
```

Add imports to `src/main.ts`:

```ts
import { shouldShowWhatsNew } from './app/changelog/display';
import { parseChangelogRelease } from './app/changelog/parser';
import { readBundledChangelog } from './app/changelog/source';
import { showWhatsNewModal } from './shared/modals/WhatsNewModal';
```

Call after `this.addSettingTab(new GrimoireSettingTab(this.app, this));` and its debug log:

```ts
      await this.maybeShowWhatsNew();
```

Add this private method to `GrimoirePlugin`:

```ts
  private async maybeShowWhatsNew(): Promise<void> {
    const currentVersion = this.manifest.version?.trim() ?? '';
    if (!shouldShowWhatsNew({
      currentVersion,
      lastSeenVersion: this.settings.lastSeenChangelogVersion,
    })) {
      return;
    }

    const markdown = await readBundledChangelog(this.app.vault.adapter, this.manifest);
    if (!markdown) {
      return;
    }

    const release = parseChangelogRelease(markdown, currentVersion);
    if (!release) {
      return;
    }

    void showWhatsNewModal({
      app: this.app,
      release,
      onDismiss: async () => {
        this.settings.lastSeenChangelogVersion = currentVersion;
        await this.saveSettings();
      },
    });
  }
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/core/types/settings.ts src/app/settings/defaultSettings.ts src/main.ts tests/integration/main.test.ts
git commit -m "Show what's new after updates"
```

## Task 5: Settings Entry Point

**Files:**
- Modify: `src/features/settings/GrimoireSettings.ts`
- Modify: `tests/unit/features/settings/GrimoireSettings.test.ts`
- Modify: `src/style/settings/base.css`

- [ ] **Step 1: Write failing Settings tests**

Mock modal and source/parser helpers at the top of `tests/unit/features/settings/GrimoireSettings.test.ts`:

```ts
jest.mock('@/shared/modals/WhatsNewModal', () => ({
  showWhatsNewModal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/changelog/source', () => ({
  readBundledChangelog: jest.fn().mockResolvedValue('# Changelog\n\n## 9.8.7\n\n### Added\n\n- Manual release note.'),
}));
```

Import:

```ts
import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';
```

Add tests:

```ts
it('renders a permanent what is new action beside the plugin version', () => {
  const plugin = createSettingsPlugin();
  const app: any = { hotkeyManager: {} };
  const tab = new GrimoireSettingTab(app, plugin);
  (tab as any).containerEl = createMockEl('div');

  tab.display();

  const versionEl = (tab as any).containerEl.querySelector('.grimoire-settings-version');
  expect(versionEl?.textContent).toContain('Grimoire v9.8.7-test');
  expect(versionEl?.textContent).toContain("What's new");
});

it('opens the current release from the Settings action', async () => {
  const plugin = createSettingsPlugin();
  const app: any = { hotkeyManager: {}, vault: { adapter: { read: jest.fn() } } };
  const tab = new GrimoireSettingTab(app, plugin);
  (tab as any).containerEl = createMockEl('div');

  tab.display();

  const action = (tab as any).containerEl.querySelector('.grimoire-settings-whats-new');
  action?.click();
  await Promise.resolve();

  expect(showWhatsNewModal).toHaveBeenCalledWith(expect.objectContaining({
    app,
    release: expect.objectContaining({ version: '9.8.7' }),
  }));
});
```

- [ ] **Step 2: Run Settings tests to verify they fail**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/features/settings/GrimoireSettings.test.ts
```

Expected: FAIL because Settings does not render or wire the action yet.

- [ ] **Step 3: Implement Settings action**

Add imports to `src/features/settings/GrimoireSettings.ts`:

```ts
import { parseChangelogRelease } from '../../app/changelog/parser';
import { readBundledChangelog } from '../../app/changelog/source';
import { showWhatsNewModal } from '../../shared/modals/WhatsNewModal';
```

Replace the version div creation in `renderSettings()`:

```ts
    const versionEl = containerEl.createDiv({ cls: 'grimoire-settings-version' });
    versionEl.createSpan({ text: formatGrimoireVersion(this.plugin.manifest) });
    const whatsNewButton = versionEl.createEl('button', {
      cls: 'grimoire-settings-whats-new',
      text: "What's new",
    });
    whatsNewButton.addEventListener('click', () => {
      void this.openCurrentChangelog();
    });
```

Add a private method:

```ts
  private async openCurrentChangelog(): Promise<void> {
    const version = this.plugin.manifest.version?.trim() ?? '';
    const normalizedVersion = version.replace(/-.*$/, '');
    const markdown = await readBundledChangelog(this.app.vault.adapter, this.plugin.manifest);
    const release = markdown ? parseChangelogRelease(markdown, normalizedVersion) : null;
    if (!release) {
      new Notice('No release notes are bundled for this Grimoire version.');
      return;
    }

    await showWhatsNewModal({
      app: this.app,
      release,
    });
  }
```

Modify `src/style/settings/base.css`:

```css
.grimoire-settings-version {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.grimoire-settings-whats-new {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

.grimoire-settings-whats-new:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}
```

- [ ] **Step 4: Run Settings tests and commit**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/features/settings/GrimoireSettings.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/features/settings/GrimoireSettings.ts src/style/settings/base.css tests/unit/features/settings/GrimoireSettings.test.ts
git commit -m "Add settings what's new action"
```

## Task 6: Final Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- --selectProjects unit tests/unit/app/changelog/parser.test.ts tests/unit/app/changelog/display.test.ts tests/unit/app/changelog/source.test.ts tests/unit/shared/modals/WhatsNewModal.test.ts tests/unit/features/settings/GrimoireSettings.test.ts tests/unit/scripts/releaseBundle.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run integration plugin test**

Run:

```bash
npm run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run release bundle smoke**

Run:

```bash
npm run build:release
```

Expected: PASS and `dist/grimoire` contains `main.js`, `manifest.json`, `styles.css`, and `CHANGELOG.md`.

- [ ] **Step 5: Commit any final fixes**

If final verification required fixes, commit them:

```bash
git add CHANGELOG.md src tests scripts esbuild.config.mjs
git commit -m "Verify changelog what's new flow"
```

If there were no fixes after Task 5, do not create an empty commit.

## Self-Review

Spec coverage:

- `CHANGELOG.md` source of truth: Task 1 and Task 2.
- One-time modal after update: Task 3 and Task 4.
- Settings permanent access: Task 5.
- `lastSeenChangelogVersion` persistence: Task 4.
- Quiet failure behavior: Task 2 source returns `null`; Task 4 skips automatic modal; Task 5 shows a compact Notice.
- No toast spam: Task 4 uses only modal, no Notice.
- Release bundle includes changelog: Task 2 and Task 6.

Placeholder scan:

- No `TBD`, `TODO`, `implement later`, or unspecified test steps are present.

Type consistency:

- Parser returns `ChangelogRelease`.
- Modal accepts `ChangelogRelease`.
- Plugin and Settings both call `parseChangelogRelease(markdown, version)`.
- Settings key is consistently `lastSeenChangelogVersion`.
