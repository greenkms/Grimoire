# In-Window What's New Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the automatic post-update `What's New` disclosure from a global Obsidian modal into a dismissible card inside the Grimoire chat panel, while keeping the manual Settings modal.

**Architecture:** Keep changelog parsing, bundled source reading, and Settings modal behavior unchanged. Replace plugin-load auto modal dispatch with a queued release view model on `GrimoirePlugin`, then let `GrimoireView` render that release inside its own window after the tab workspace is built. Acknowledging the card persists `lastSeenChangelogVersion`.

**Tech Stack:** TypeScript, Obsidian view DOM APIs, existing Grimoire chat window styles, Jest integration/unit tests.

---

## File Structure

- Modify `src/main.ts`: replace automatic `showWhatsNewModal()` with queued release state and an acknowledgement method.
- Modify `src/features/chat/GrimoireView.ts`: render pending automatic release notes inside the chat window shell.
- Create `src/shared/whats-new/renderWhatsNewCard.ts`: UI-only renderer shared by `GrimoireView` tests and future embedded surfaces.
- Create `src/style/components/whats-new-card.css`: in-window card styling using existing workbench tokens.
- Modify `src/style/index.css`: import the card stylesheet.
- Modify `tests/integration/main.test.ts`: assert plugin load queues a pending in-window release and no longer opens the modal automatically.
- Create `tests/unit/shared/whats-new/renderWhatsNewCard.test.ts`: assert card content and dismissal callback.

## Task 1: Queue Automatic Release Instead Of Opening Modal

**Files:**
- Modify: `tests/integration/main.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing integration expectations**

Update the automatic changelog tests in `tests/integration/main.test.ts` so plugin load expects `showWhatsNewModal` not to be called. Assert the plugin exposes a pending release:

```ts
expect(showWhatsNewModal).not.toHaveBeenCalled();
expect(plugin.getPendingWhatsNewRelease()).toEqual(expect.objectContaining({
  version: '0.1.0',
}));
```

Then acknowledge it through the plugin API:

```ts
await plugin.acknowledgePendingWhatsNew();
expect(plugin.settings.lastSeenChangelogVersion).toBe('0.1.0');
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run:

```bash
npm.cmd run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: FAIL because `getPendingWhatsNewRelease()` and `acknowledgePendingWhatsNew()` do not exist and plugin load still calls the modal.

- [ ] **Step 3: Implement queued release state**

In `src/main.ts`, remove the `showWhatsNewModal` import and change `maybeShowWhatsNew()` to set private fields:

```ts
private pendingWhatsNewRelease: ChangelogRelease | null = null;
private pendingWhatsNewVersion = '';

getPendingWhatsNewRelease(): ChangelogRelease | null {
  return this.pendingWhatsNewRelease;
}

async acknowledgePendingWhatsNew(): Promise<void> {
  if (!this.pendingWhatsNewRelease || !this.pendingWhatsNewVersion) {
    return;
  }
  const version = this.pendingWhatsNewVersion;
  this.pendingWhatsNewRelease = null;
  this.pendingWhatsNewVersion = '';
  this.settings.lastSeenChangelogVersion = version;
  await this.saveSettings();
}
```

Inside `maybeShowWhatsNew()`, assign:

```ts
this.pendingWhatsNewRelease = release;
this.pendingWhatsNewVersion = currentVersion;
```

- [ ] **Step 4: Run integration test to verify it passes**

Run:

```bash
npm.cmd run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: PASS.

## Task 2: Render The In-Window Card

**Files:**
- Create: `tests/unit/shared/whats-new/renderWhatsNewCard.test.ts`
- Create: `src/shared/whats-new/renderWhatsNewCard.ts`
- Modify: `src/features/chat/GrimoireView.ts`
- Create: `src/style/components/whats-new-card.css`
- Modify: `src/style/index.css`

- [ ] **Step 1: Write failing card renderer tests**

Create `tests/unit/shared/whats-new/renderWhatsNewCard.test.ts`:

```ts
import { renderWhatsNewCard } from '@/shared/whats-new/renderWhatsNewCard';
import { createMockEl } from '@test/helpers/mockElement';

describe('renderWhatsNewCard', () => {
  it('renders release notes and acknowledges dismissal', async () => {
    const container = createMockEl('div');
    const onDismiss = jest.fn().mockResolvedValue(undefined);

    renderWhatsNewCard(container as unknown as HTMLElement, {
      release: {
        version: '1.0.0',
        date: '2026-06-21',
        categories: [
          { title: 'Added', items: ['Inline release card.'] },
          { title: 'Fixed', items: ['Small fix.'] },
        ],
      },
      onDismiss,
    });

    expect(container.textContent).toContain("What's New in Grimoire v1.0.0");
    expect(container.textContent).toContain('Inline release card.');

    const button = container.querySelector('.grimoire-whats-new-card-dismiss') as HTMLButtonElement;
    button.click();
    await Promise.resolve();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.grimoire-whats-new-card')).toBeNull();
  });
});
```

- [ ] **Step 2: Run renderer test to verify it fails**

Run:

```bash
npm.cmd run test -- --selectProjects unit tests/unit/shared/whats-new/renderWhatsNewCard.test.ts
```

Expected: FAIL because `renderWhatsNewCard.ts` does not exist.

- [ ] **Step 3: Implement renderer and mount it from `GrimoireView`**

Create `src/shared/whats-new/renderWhatsNewCard.ts` with a UI-only renderer that creates:

- `.grimoire-whats-new-card`
- title `What's New in Grimoire v${release.version}`
- date summary
- grouped category sections
- dismiss button `.grimoire-whats-new-card-dismiss`

In `GrimoireView.onOpen()`, after `const header = shellEl.createDiv(...)` and `this.buildHeader(header)`, create a card host:

```ts
const whatsNewHost = shellEl.createDiv({ cls: 'grimoire-whats-new-host' });
this.renderPendingWhatsNew(whatsNewHost);
```

Update shell grid rows if needed so the host takes an `auto` row between header and tab content. `renderPendingWhatsNew()` should read `this.plugin.getPendingWhatsNewRelease()` and call `this.plugin.acknowledgePendingWhatsNew()` on dismiss.

- [ ] **Step 4: Add CSS and import it**

Create `src/style/components/whats-new-card.css` using existing workbench colors, `8px` radius, compact spacing, no marketing-style hero.

Add to `src/style/index.css`:

```css
@import "./components/whats-new-card.css";
```

- [ ] **Step 5: Run renderer and integration tests**

Run:

```bash
npm.cmd run test -- --selectProjects unit tests/unit/shared/whats-new/renderWhatsNewCard.test.ts
npm.cmd run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: PASS.

## Task 3: Final Verification

**Files:**
- Verify all touched source, style, tests, docs, and generated artifacts.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npm.cmd run test -- --selectProjects unit tests/unit/shared/whats-new/renderWhatsNewCard.test.ts tests/unit/shared/modals/WhatsNewModal.test.ts tests/unit/features/settings/GrimoireSettings.test.ts tests/unit/app/changelog/parser.test.ts tests/unit/app/changelog/display.test.ts tests/unit/app/changelog/source.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run integration plugin test**

Run:

```bash
npm.cmd run test -- --selectProjects integration tests/integration/main.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 4: Rebuild release artifacts**

Run:

```bash
npm.cmd run build:release
```

Expected: PASS and generated `main.js`, `styles.css`, and `dist/grimoire` reflect the in-window card.

## Self-Review

Spec coverage:

- Automatic update disclosure stays inside Grimoire window: Task 1 and Task 2.
- Settings modal remains available: Task 1 keeps Settings/manual modal tests intact.
- `lastSeenChangelogVersion` persists only after card dismissal: Task 1 and Task 2.
- No toast spam or marketing surface: Task 2 CSS/DOM uses compact workbench card.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified test steps remain.

Type consistency:

- `ChangelogRelease` remains the shared view model.
- Plugin exposes pending release state through methods consumed by `GrimoireView`.
- Settings still calls `showWhatsNewModal()` manually.
