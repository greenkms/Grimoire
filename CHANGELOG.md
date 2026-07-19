# Changelog

## 1.0.34 - 2026-07-19

### Added

- Added repository contribution guidelines and a pull request template covering architecture, security, testing, attribution, and release expectations.

### Improved

- Aligned Grok permission modes with native Grok Build launch behavior while keeping the user's saved Safe, Auto-approve, or Plan choice authoritative.
- Made Grimoire settings discoverable through Obsidian 1.13 settings search while preserving the existing settings UI on Obsidian 1.12.7.
- Refreshed compatible project dependencies and aligned the minimum supported Obsidian version with the tested 1.12.7 stable release.

### Fixed

- Launched Grok Build with its native `--always-approve` flag in Auto-approve mode so approved write operations do not prompt again. (#10)
- Reconciled saved Grok models with the account's current ACP catalog and stopped sending retired model IDs through `session/set_model`.
- Restored Grok's unified weekly usage indicator, reset date, and extra-credit balance through the native billing contract with authenticated compatibility fallbacks.
- Kept Grok's synthetic skills reminders out of visible chat history, including reminders already imported into failed conversations.
- Loaded older Grok sessions whose ACP model records omit display names or the current model instead of failing during normalization.
- Aligned HTML and SVG creation with Obsidian's DOM helpers and removed the partially supported completed-task decoration color flagged by community-plugin review.

## 1.0.33 - 2026-07-12

### Added

- Added task-level progress updates for Codex reasoning summaries and ACP plans from OpenCode, MiMoCode, and Kimi Code.
- Added shared provider-error classification for authentication, quota, rate-limit, unavailable-model, and transport failures.

### Improved

- Asked every main agent to communicate meaningful phase changes, recovery attempts, and completion outcomes without exposing private reasoning.
- Reworked permission requests with semantic command summaries, full-command tooltips, clearer shell copy, responsive actions, and readable multi-line commands.
- Reduced Codex tool noise by keeping typed tool activity while suppressing duplicate raw execution wrappers.

### Fixed

- Reconnected OpenCode, MiMoCode, and Kimi Code after early JSON-RPC transport closures without reviving stale turns during runtime cleanup.
- Recovered hidden MiMoCode API errors from native session metadata, preserved them in restored history, and switched unsupported Ultraspeed selections to an available base model.
- Replaced empty ACP turns with actionable errors and recorded successful prompt enqueue metadata consistently.
- Normalized Grok execute approvals as shell commands and prevented long permission titles from breaking the dialog layout.

## 1.0.32 - 2026-07-12

### Improved

- Documented Grimoire's composer keyboard shortcuts across every localized README.

### Fixed

- Made `Shift+Tab` cycle the complete Safe, Auto-approve, and Plan permission sequence instead of skipping Auto-approve. (#6)

## 1.0.31 - 2026-07-12

### Added

- Added a translated **Delete all** action to History, with a confirmation dialog before clearing every saved conversation.

### Improved

- Made the Codex plan-usage indicator explicitly show used quota and the time of its last successful refresh.

### Fixed

- Restored complete Grimoire chat history when a Codex replacement session persists only a replayed suffix.
- Kept Codex replay prompts, selected-file context, and injected plugin instructions out of visible user message bubbles.
- Correctly marked context files as loaded when a shell command reads the file successfully before a later command segment fails.

## 1.0.30 - 2026-07-11

### Fixed

- Preserved the visible Grimoire conversation when Codex or Gemini must create a replacement native session, while avoiding duplicate history during normal session continuation.
- Restored prior conversation context when OpenCode, MiMoCode, Kimi Code, or Grok retries a turn in a newly created ACP session after a transport failure.

## 1.0.29 - 2026-07-10

### Fixed

- Loaded Codex model options from the signed-in CLI account and kept the last successful catalog, so account-specific GPT-5.6 variants remain available in the picker after restarting Obsidian.
- Added diagnostic logging for Codex model catalog refreshes instead of silently falling back to the static model list when discovery fails.

## 1.0.28 - 2026-07-09

### Fixed

- Restored visible chat history after restarting Obsidian by keeping a Grimoire display fallback when provider-native transcripts are unavailable.
- Passed pinned vault `@` files into provider prompts so instructions selected with `@instructions.md` are available to Codex, OpenCode, Grok, MiMoCode, Kimi Code, Antigravity, and Gemini turns.
- Marked the current note chip as the default edit target when users ask to apply instructions without naming another target file.
- Aligned Codex turn context with Grimoire's shared XML context format and kept appended context out of restored user-message display text.

## 1.0.27 - 2026-07-07

### Fixed

- Fixed model picker search so multi-word queries such as `claude sonnet` match across provider names and model labels.
- Kept Claude Code's `Sonnet 5` alias discoverable when Antigravity also exposes older Claude Sonnet models.

## 1.0.26 - 2026-07-02

### Improved

- Redesigned the Plan complete approval surface with a collapsible card, rendered plan preview, permission summary, and keyboard-friendly approval rows.
- Kept plan approval in the current provider session so Claude Code exits Plan mode cleanly without starting a separate Grimoire session.
- Documented the new Plan complete approval behavior across the README set.

### Fixed

- Removed the unsupported Approve (new session) path from ExitPlanMode and the related pending new-session state.

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
