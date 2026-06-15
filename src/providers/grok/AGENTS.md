# Grok Build Provider Agent Instructions

`src/providers/grok/` adapts xAI Grok Build CLI through ACP and Grimoire-managed launch artifacts.

## Scope

- Grok Build is opt-in.
- Runtime behavior, model discovery, history parsing, launch artifacts, agent storage, command loading, and settings UI stay provider-owned.
- Shared ACP transport and session normalization belong in `src/providers/acp/`.

## Rules

- Preserve Grok Build-native behavior and file formats where possible.
- Launch Grok with `grok agent stdio`, not the `acp` subcommand used by other providers.
- Use `GROK_HOME` for Grimoire-managed launch artifacts under `.grimoire/grok/`.
- Grok sessions persist as JSONL under `~/.grok/sessions/`; history hydration still needs runtime discovery before it can replace the scaffold store.
- Do not project Grok provider state into generic chat UI code. Use provider helpers and shared contracts.
- When changing launch artifacts or command loading, verify against current Grok Build runtime output rather than inferred schemas.
- Plan indicators are spend-only today. `GrokPlanUsageStore` aggregates ACP/session cost for the current month; do not invent a cross-vendor quota window unless Grok Build exposes one.