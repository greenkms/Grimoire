# Kimi Code Provider Agent Instructions

`src/providers/kimicode/` adapts Kimi Code CLI through ACP and Grimoire-managed launch artifacts.

## Scope

- Kimi Code is opt-in.
- Runtime behavior, model discovery, history parsing, launch artifacts, agent storage, command loading, and settings UI stay provider-owned.
- Shared ACP transport and session normalization belong in `src/providers/acp/`.

## Rules

- Preserve Kimi Code-native behavior and file formats where possible.
- Keep Grimoire internal IDs such as `grimoire-*` out of user-facing product copy.
- Do not project Kimi Code provider state into generic chat UI code. Use provider helpers and shared contracts.
- When changing launch artifacts or command loading, verify against current Kimi Code runtime output rather than inferred schemas.
- Plan indicators are spend-only today. `KimicodePlanUsageStore` aggregates ACP/session cost for the current month; do not invent a cross-vendor quota window unless Kimi Code exposes one.

## Session resume

- Persist both `sessionId` and `providerState.databasePath` after turns.
- Invalidate only when `session/load` explicitly reports a missing session. Preserve `databasePath`; propagate transport, authentication, and configuration errors without clearing the binding.
