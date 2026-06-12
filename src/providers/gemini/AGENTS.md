# Gemini Provider Agent Instructions

`src/providers/gemini/` adapts Gemini CLI through ACP using `gemini --acp` over stdio JSON-RPC.

## Current Scope

- Gemini is opt-in and disabled by default.
- `GeminiChatRuntime` supports ACP startup, initialize, new session, load session, prompt streaming, cancel, and proxied file read/write requests.
- Per-turn prompts include Grimoire context from the active note, editor selection, browser selection, canvas selection, vault search, and project workspace.
- Model and mode discovery come from ACP session config options and are stored in provider settings for the UI.
- Auxiliary workflows such as title generation, instruction refinement, and inline edit are unsupported until a Gemini auxiliary runner exists.
- Plan indicators are spend-only today. `GeminiPlanUsageStore` records ACP cost when Gemini CLI reports it; daily quota remains unavailable until a reliable CLI/API source is wired.

## Boundaries

- Keep Gemini-specific runtime behavior in `src/providers/gemini/`.
- Keep protocol-generic JSON-RPC behavior in `src/providers/acp/`.
- Do not add Gemini MCP management UI until the provider has a clear Grimoire-owned MCP storage and reconciliation design.
- Prefer live ACP wire traces over guessed event shapes when expanding support.

## Launch

The runtime launches:

```bash
gemini --acp
```

Custom CLI paths are stored per host under `providerConfigs.gemini.cliPathsByHost`. If no custom path exists, Grimoire launches `gemini` from PATH.
