# MiMoCode Provider Agent Instructions

`src/providers/mimocode/` adapts MiMoCode through ACP and Grimoire-managed launch artifacts.

## Scope

- MiMoCode is opt-in.
- Runtime behavior, model discovery, history parsing, launch artifacts, agent storage, command loading, and settings UI stay provider-owned.
- Shared ACP transport and session normalization belong in `src/providers/acp/`.

## Rules

- Preserve MiMoCode-native behavior and file formats where possible.
- Keep Grimoire internal IDs such as `grimoire-*` out of user-facing product copy.
- Do not project MiMoCode provider state into generic chat UI code. Use provider helpers and shared contracts.
- When changing launch artifacts or command loading, verify against current MiMoCode runtime output rather than inferred schemas.
- Plan indicators are spend-only today. `MimocodePlanUsageStore` aggregates ACP/session cost for the current month; do not invent a cross-vendor quota window unless MiMoCode exposes one.
