# OpenCode Provider Agent Instructions

`src/providers/opencode/` adapts OpenCode through ACP and Grimoire-managed launch artifacts.

## Scope

- OpenCode is opt-in.
- Runtime behavior, model discovery, history parsing, launch artifacts, agent storage, command loading, and settings UI stay provider-owned.
- Shared ACP transport and session normalization belong in `src/providers/acp/`.

## Rules

- Preserve OpenCode-native behavior and file formats where possible.
- Keep Grimoire internal IDs such as `grimoire-*` out of user-facing product copy.
- Do not project OpenCode provider state into generic chat UI code. Use provider helpers and shared contracts.
- When changing launch artifacts or command loading, verify against current OpenCode runtime output rather than inferred schemas.
- Plan indicators are spend-only today. `OpencodePlanUsageStore` aggregates ACP/session cost for the current month; do not invent a cross-vendor quota window unless OpenCode exposes one.
