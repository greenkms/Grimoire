# Qwen Provider Agent Instructions

`src/providers/qwen/` adapts Qwen CLI through ACP using `qwen --acp` over stdio JSON-RPC.

## Current Scope

- Qwen is opt-in and disabled by default.
- `QwenChatRuntime` supports ACP startup, initialize, new session, load session, prompt streaming, cancel, proxied file read/write requests, Qwen mode/model updates, and structured `AskUserQuestion` permission metadata.
- Per-turn prompts include Grimoire context from the active note, editor selection, browser selection, canvas selection, vault search, and project workspace.
- Model and mode discovery come from ACP session config options and are stored in provider settings for the UI.
- Reasoning effort offers Low, Medium, High, XHigh, and Max (High by default). Apply Qwen's native `/effort <tier>` command before the normal turn and cache the applied tier per session; effective support remains model-dependent.
- Auxiliary workflows such as title generation, instruction refinement, and inline edit are unsupported until a Qwen auxiliary runner exists.
- Plan indicators are spend-only today. `QwenPlanUsageStore` records ACP cost when Qwen CLI reports it; daily quota remains unavailable until a reliable CLI/API source is wired.
- Usage is shown only when Qwen ACP emits token or cost metadata; do not infer account quotas.

## Boundaries

- Keep Qwen-specific runtime behavior in `src/providers/qwen/`.
- Keep protocol-generic JSON-RPC behavior in `src/providers/acp/`.
- Grimoire-owned MCP servers live in `.grimoire/mcp/qwen.json` and are injected into ACP session creation and loading. Do not rewrite Qwen's native MCP configuration.
- Qwen project skills, commands, and agents use `.qwen/skills/`, `.qwen/commands/**/*.md`, and `.qwen/agents/*.md`. Preserve unknown frontmatter when editing managed files.
- Do not claim or add Qwen fork or rewind workflows; Qwen credentials and `~/.qwen/settings.json` remain Qwen-owned.
- Prefer live ACP wire traces over guessed event shapes when expanding support.

## Launch

The runtime launches:

```bash
qwen --acp
```

Custom CLI paths are stored per host under `providerConfigs.qwen.cliPathsByHost`. If no custom path exists, Grimoire launches `qwen` from PATH.
