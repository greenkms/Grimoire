# Changelog

## 1.0.25 - 2026-06-26

### Improved

- Added Plan mode to the shared permission control so supported providers can cycle through Safe, Auto-approve, and Plan from the composer.
- Documented both ways to enter or leave Plan mode: the permission control and the `Shift+Tab` shortcut.
- Documented how Claude Code `AskUserQuestion` and Codex `request_user_input` appear in Grimoire's shared inline question UI.

### Fixed

- Normalized the Plan permission label across Claude and Codex.
- Removed the Plan-only composer border so Plan mode uses the same inactive composer styling as Safe and Auto-approve.

## 1.0.24 - 2026-06-21

### Fixed

- Bundled What's New release notes into the plugin so Obsidian auto-updates can show them without downloading extra files.
- Removed the unsupported `CHANGELOG.md` release asset from the Obsidian release package.

### Improved

- Added a direct Full changelog link from What's New surfaces to the repository changelog.

## 1.0.23 - 2026-06-21

### Added

- Added a bundled changelog as the source of truth for Grimoire release notes.
- Added a one-time What's New card inside the Grimoire chat window after updates.
- Added a persistent What's new action in Settings for manually opening the current release notes.

### Improved

- Kept automatic release notes inside Grimoire's own window instead of showing a global Obsidian modal.

## 1.0.22 - 2026-06-20

### Added

- Added Antigravity CLI support with provider settings, launch handling, and model discovery.
- Added Gemini CLI (Legacy) as a provider option for users who still rely on the classic Gemini CLI.

### Improved

- Documented provider limitations and release tag expectations for safer Obsidian releases.

### Fixed

- Fixed Antigravity launch assertions and localized provider limitation copy.
