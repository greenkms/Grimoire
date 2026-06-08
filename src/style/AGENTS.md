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
- Avoid `!important` unless overriding unavoidable Obsidian host styles.
- Use Obsidian tokens such as `--background-*`, `--text-*`, and `--interactive-*` where appropriate.
- Use `var(--font-monospace)` for code, command, and machine-readable text.

## UI Gotchas

- Keep chat tables and tool outputs contained with local scrolling/truncation instead of widening the chat pane.
- Do not put cards inside cards.
- Keep fixed-format controls dimensionally stable so hover states, counters, labels, and loading text do not shift layout.
- Obsidian uses `body.theme-dark` and `body.theme-light` for theme detection.
- Modal z-index must be high enough to overlay Obsidian UI.
