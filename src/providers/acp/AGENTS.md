# ACP Provider Agent Instructions

`src/providers/acp/` contains protocol-generic ACP transport, subprocess, session config, session update normalization, usage conversion, and tool stream helpers.

## Rules

- Keep this directory provider-generic. OpenCode and future ACP providers can depend on it; it must not depend on provider-specific settings.
- Normalize ACP events into shared provider-neutral shapes only when the mapping is stable across ACP providers.
- Keep provider-specific model/mode discovery, settings UI, launch paths, and history ownership under the concrete provider directory.
- Prefer current wire traces over guessed method or event shapes when extending ACP support.
