# Changelog And What's New Design

## Goal

Give Grimoire users a quiet, reliable way to learn what changed after an update. Release notes should be visible inside Obsidian at the right moment, while `CHANGELOG.md` remains the durable source of truth for GitHub releases, BRAT/manual installs, and external review.

## Problem

Grimoire already has release discipline around `package.json`, `manifest.json`, `versions.json`, and generated release artifacts, but users inside Obsidian do not have a clear product-native way to see:

- what was added
- what was improved
- what was fixed

Relying only on GitHub release notes or repository history means many users will miss useful changes. A noisy notification system would solve visibility at the cost of trust, especially for a pre-release agent workspace that should stay calm while people work in their vaults.

## Design

Use three connected surfaces:

1. `CHANGELOG.md` in the repository root as the source of truth.
2. A compact in-window `What's New` card shown once inside the Grimoire chat panel after the installed version changes.
3. A persistent `What's new` button or link beside the version in Settings that opens the manual modal.

The recommended behavior is option 2 from the brainstorm, refined after implementation feedback: automatic one-time update disclosure should stay inside Grimoire's own window, while Settings keeps a manual modal for deliberate access. There should be no toast spam and no marketing-style release page.

## Changelog Format

`CHANGELOG.md` should use a predictable, parser-friendly format:

```md
# Changelog

## 1.0.23 - 2026-06-20

### Added

- New capability...

### Improved

- Existing workflow is smoother...

### Fixed

- Bug fix...
```

Initial supported categories:

- `Added`
- `Improved`
- `Fixed`

The in-app surface should ignore unknown categories until there is a product reason to expose them. The full markdown file can still contain richer details for maintainers.

## UI Behavior

On plugin load, compare the current manifest version with `settings.lastSeenChangelogVersion`.

Queue the in-window card when all of these are true:

- the current version is known
- `lastSeenChangelogVersion` is missing or older than the current version
- the current version has a parsable changelog section

Do not open a global Obsidian modal automatically. The queued card should render inside the active Grimoire chat panel the next time a Grimoire view opens or refreshes. When the user closes the card with `Got it` or the close icon, persist `lastSeenChangelogVersion` as the current manifest version.

The in-window card should show:

- title: `What's New in Grimoire vX.Y.Z`
- short grouped sections for `Added`, `Improved`, and `Fixed`
- only the current version's user-facing bullets

The Settings version row should remain visible and gain a permanent `What's new` action. Clicking it opens the same modal for the current version. If the current version has no parsed section, show a fallback modal with a short explanation and, where possible, an action to open `CHANGELOG.md`.

## Data Flow

Add `lastSeenChangelogVersion?: string` to `GrimoireSettings`.

Add a small provider-neutral changelog module under app or shared code. It should:

- receive the raw changelog markdown bundled with the plugin
- parse release sections by semver heading
- extract supported category lists
- return a view model for a requested version

The plugin runtime should own the one-time show decision because it has access to settings, manifest version, and save behavior. The queued automatic disclosure should be exposed to `GrimoireView` as a small view model and acknowledgement callback. The manual Settings modal should stay UI-only and receive a parsed release view model.

## Bundling

The release build should include `CHANGELOG.md` in the Obsidian plugin bundle so the installed plugin can read the same source users see in the repository.

If direct file access is easier and reliable in Obsidian, read the bundled `CHANGELOG.md` through the vault/plugin adapter. If bundling markdown as text is simpler for the current build pipeline, generate a small TypeScript constant from `CHANGELOG.md` during build. The implementation plan should choose the path that best matches the existing build scripts.

## Error Handling

The changelog feature should fail quietly.

If the changelog cannot be read, parsed, or matched to the current version:

- do not queue the automatic in-window card
- keep plugin load successful
- keep Settings usable
- let the Settings action show a compact fallback instead of throwing

Persist `lastSeenChangelogVersion` only after the user dismisses a successfully rendered current-version card. Do not mark a version as seen when the automatic display is skipped due to missing data.

## Testing

Add focused tests for:

- parsing a current-version changelog section
- ignoring unknown categories
- returning no release when a version is absent
- deciding whether the one-time modal should be shown
- queuing the one-time in-window card instead of opening the automatic modal
- persisting `lastSeenChangelogVersion` only after card dismissal
- rendering the Settings `What's new` action

Existing settings and plugin-load tests should be updated only where the new setting or modal decision affects behavior.

## Boundaries

Do not add a notification center or historical release inbox in the first implementation.

Do not localize changelog content in the first implementation. Repository documentation and release copy stay in English unless a later task explicitly targets localized release notes.

Do not show a toast after update. The in-window card is the automatic disclosure surface; Settings is the permanent modal access point.

## Follow-Ups

Potential later work:

- include a `Security` category if Grimoire starts shipping user-visible security fixes
- add a `View previous versions` selector inside the modal
- generate GitHub release notes from `CHANGELOG.md`
- validate changelog headings during `build:release`
