# Agent Instructions

Grimoire is a private, pre-release Obsidian plugin that embeds agentic CLI assistants in a vault-native workspace. It is not a standalone CLI. The plugin shell must stay provider-neutral while provider adapters wrap external tools such as Claude Code, Codex, OpenCode, and Gemini CLI.

Repository documentation and user-facing product copy should be in English unless the task explicitly targets localized UI text.

## Instruction Layout

- `AGENTS.md` is the canonical shared instruction file for coding agents.
- `CLAUDE.md` files exist so Claude Code can load the same instructions. They should import the nearest `AGENTS.md` and contain only Claude-specific additions.
- Keep root instructions durable. Put path-specific details in nested `AGENTS.md` files next to the code they govern.
- If a design handoff directory is named by the user, treat it as the source of truth for that task. Keep temporary handoff/debug artifacts untracked unless the user explicitly asks to commit them.

## Provider Directories

- `src/providers/claude/` - Claude Code SDK adapter and Claude-compatible vault files.
- `src/providers/codex/` - Codex app-server adapter and Codex-owned workspace services.
- `src/providers/opencode/` - OpenCode ACP adapter and launch/workspace artifacts.
- `src/providers/gemini/` - Gemini CLI ACP adapter.
- `src/providers/acp/` - Shared ACP transport and normalization helpers.

Read the nested `AGENTS.md` in a provider directory before changing provider-specific runtime, storage, history, settings, or UI behavior.

## Architecture Rules

- Keep `src/core/` provider-neutral. Shared chat/runtime/settings contracts belong there only when at least two providers need the behavior.
- Keep provider-specific protocol, storage, CLI resolution, history parsing, model discovery, settings UI, and launch artifacts inside `src/providers/<provider>/`.
- Register provider runtime and auxiliary services through `ProviderRegistry`.
- Register provider workspace services through `ProviderWorkspaceRegistry`.
- Feature code must consume provider-neutral contracts. Do not read provider-specific `Conversation.providerState` fields directly from `src/features/`.
- Preserve provider-native behavior first. Prefer adapting official CLI/runtime semantics over reimplementing provider features inside Grimoire.
- Use `.grimoire/` for Grimoire-owned vault data. Do not add legacy storage migration behavior unless a migration milestone explicitly asks for it.

## Key Paths

| Path | Purpose |
|------|---------|
| `src/main.ts` | Obsidian plugin entry point, view registration, commands, lifecycle |
| `src/app/` | Settings defaults and plugin-level storage helpers |
| `src/core/` | Provider-neutral runtime, providers, MCP, security, storage, tools, shared types |
| `src/providers/` | Provider adapters and provider-owned services |
| `src/features/chat/` | Main sidebar chat interface and tab lifecycle |
| `src/features/inline-edit/` | Inline edit modal and provider-backed edit services |
| `src/features/settings/` | Shared settings shell plus provider-owned settings tabs |
| `src/shared/` | Reusable UI components, modals, mention UI, icons |
| `src/style/` | Modular CSS, built into root `styles.css` |
| `tests/` | Unit and integration tests mirroring `src/` |

## Commands

```bash
npm ci
npm run dev
npm run build
npm run build:release
npm run typecheck
npm run lint
npm run lint:fix
npm run test
npm run test -- --selectProjects unit
npm run test -- --selectProjects integration
```

Use this full local gate before publishing or pushing meaningful UI/provider changes:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` refreshes generated `main.js`, root `styles.css`, and `dist/grimoire`. Generated release artifacts must match source output after the build.

## Testing Rules

- Tests mirror `src/` under `tests/unit/` and `tests/integration/`.
- For behavior changes and bug fixes, add the focused failing test first when practical, make it pass, then broaden only when the touched contract is shared.
- In restricted sandboxes, full Jest can fail with local server bind errors or read-only home errors. Treat those as environment restrictions and rerun in an unrestricted environment before changing tests or production code.

## Storage Boundaries

| Path | Owner |
|------|-------|
| `.grimoire/grimoire-settings.json` | Shared Grimoire app settings plus provider-specific configuration |
| `.grimoire/sessions/*.meta.json` | Provider-neutral session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Optional sanitized debug logs, written only when Advanced debug logging is enabled |
| `.grimoire/claude/statusline-usage.json` | Claude Code status-line usage snapshot used to hydrate plan-limit indicators |
| `.claude/settings.json` | Claude Code-compatible project settings and permissions |
| `.claude/mcp.json` | Claude-compatible MCP servers plus Grimoire metadata under `_grimoire.servers` |
| `.claude/commands/**/*.md` | Claude slash commands |
| `.claude/skills/*/SKILL.md` | Claude skills |
| `.claude/agents/*.md` | Claude vault agents |
| `.codex/skills/*/SKILL.md` | Codex vault skills |
| `.codex/agents/*.toml` | Codex vault subagent definitions |
| `.agents/skills/*/SKILL.md` | Alternate Codex vault skill root |
| `.opencode/agent/**/*.md` | OpenCode agent definitions |
| `.opencode/agents/**/*.md` | Legacy OpenCode agent definition root |

The `_grimoire` MCP metadata key and `grimoire-*` internal OpenCode IDs are implementation details, not product copy.

## Development Notes

- No `console.*` in production code.
- Prefer `rg` for searches.
- Use structured parsers/helpers for structured data instead of ad hoc string edits when the codebase already has a suitable API.
- Comments should explain non-obvious intent, not restate code.
- Do not revert unrelated user or generated changes in a dirty worktree.
- Commit only tracked deliverables unless the user explicitly asks to include temporary `.context/` or `design_handoff_*` files.
- For provider integrations, inspect real runtime output before normalizing event shapes. Real transcripts and wire traces beat guessed schemas.
- For future provider work and implementation sequencing, use `docs/provider-roadmap.md` before adding new provider directories.
