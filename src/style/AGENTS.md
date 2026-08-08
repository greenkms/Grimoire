# Style Agent Instructions

`src/style/` is modular CSS built into root `styles.css`.

## Structure

- `base/` - container, variables, animations
- `components/` - header, history, messages, code, thinking, tool calls, status panel, subagents, input, context footer, tabs, navigation
- `toolbar/` - model, thinking, permission, service tier, external context, MCP selectors
- `features/` - feature surfaces such as file context, images, inline edit, diff, slash commands, file links, plan mode, ask-user, resume session
- `modals/` - instruction, MCP, fork target
- `settings/` - settings shell and provider/settings panels
- `index.css` - import order for the CSS build

## Build Rules

- Register new CSS modules in `src/style/index.css`.
- `npm run build:css` is invoked by `npm run dev`, `npm run build`, and `npm run build:release`.
- Generated root `styles.css` must match source output after release build.

## Conventions

- Use `.grimoire-` for Grimoire-owned classes.
- Prefer BEM-lite names: `.grimoire-block`, `.grimoire-block-element`, `.grimoire-block--modifier`.
- Avoid `!important` unless overriding unavoidable Obsidian host styles. The release CSS gate fails on `!important`.
- Use Obsidian tokens such as `--background-*`, `--text-*`, and `--interactive-*` where appropriate.
- Use `var(--font-monospace)` for code, command, and machine-readable text.

## Obsidian community CSS review

Obsidian community plugin review scores CSS against a **compatibility baseline** (historically Electron / app **1.11.4**), not only against Grimoire's `manifest.json` `minAppVersion` (currently 1.13.0). Features that work fine in modern Obsidian can still lower the review score if the baseline lists them as partial or unsupported.

Local gate (runs in `npm run review:css` and `prebuild:release`):

- `scripts/reviewCss.js` — `OBSIDIAN_PARTIAL_CSS_FEATURES` denylist (regex + message matching Obsidian's wording).
- `scripts/check-review-css.mjs` — fails on `!important` **and** any denylisted feature in `src/style/**` and root `styles.css`.

**Known denylisted feature today**

| Feature | Do not use | Prefer |
|---------|------------|--------|
| `css-display-contents` | `display: contents` | Normal flow (`display: block` / `flex` / `grid` on a real box). For marker wrappers (e.g. `.grimoire-workspace-provider-section`), keep a real box and style children with `> .wrapper > …` selectors when needed. |

When Obsidian's CSS lint reports a new partial/unsupported feature:

1. Prefer a layout rewrite that avoids the feature (do not silence the warning with host-only assumptions).
2. Add a denylist entry to `OBSIDIAN_PARTIAL_CSS_FEATURES` with the same feature id/message Obsidian used.
3. Add or extend a unit test in `tests/unit/scripts/reviewGate.test.ts` (and a focused style assertion under `tests/unit/style/` when the fix is specific to one surface).
4. Mention the constraint in this file if it is a recurring pattern, not a one-off.

Do not assume “we require Obsidian 1.13+ so the 1.11.4 warning is irrelevant” — community review still rates against their baseline.

## UI Gotchas

- Keep chat tables and tool outputs contained with local scrolling/truncation instead of widening the chat pane.
- Do not put cards inside cards.
- Keep fixed-format controls dimensionally stable so hover states, counters, labels, and loading text do not shift layout.
- Obsidian uses `body.theme-dark` and `body.theme-light` for theme detection.
- Modal z-index must be high enough to overlay Obsidian UI.
