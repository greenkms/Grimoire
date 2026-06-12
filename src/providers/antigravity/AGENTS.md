# Antigravity Provider Agent Instructions

`src/providers/antigravity/` adapts Google Antigravity CLI, Google's official Gemini CLI replacement, through its non-interactive `agy --print` command.

## Current Scope

- Antigravity is opt-in and disabled by default.
- `AntigravityChatRuntime` supports single-turn print-mode requests, cancellation, and model selection through `agy --model`.
- Model discovery comes from `agy models` and is stored in provider settings for the UI.
- Antigravity CLI 1.0.7 does not expose Gemini CLI's `--acp` flag; do not route it through `src/providers/acp/` unless a real ACP-compatible runtime is confirmed.
- Auxiliary workflows such as title generation, instruction refinement, and inline edit are unsupported until an Antigravity auxiliary runner exists.

## Boundaries

- Keep Antigravity-specific runtime behavior in `src/providers/antigravity/`.
- Treat Antigravity as Grimoire's recommended Google provider. `src/providers/gemini/` may coexist only as a legacy Gemini CLI compatibility provider for tiers Google still supports.
- Do not assume Antigravity is Gemini-only. Its model catalog may include Gemini, Claude, GPT-OSS, and other model families.
- Prefer live CLI output over guessed schemas when expanding support.

## Launch

The runtime launches one request at a time:

```bash
agy --print "<prompt>"
```

Custom CLI paths are stored per host under `providerConfigs.antigravity.cliPathsByHost`. If no custom path exists, Grimoire auto-detects `agy` from PATH and falls back to launching `agy`.
