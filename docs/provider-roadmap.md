# Provider Roadmap

This file tracks future provider integrations and the implementation sequence for agents working on Grimoire. It is not a promise that every listed provider is ready to ship; each provider still needs current runtime discovery before code is written.

## Provider Implementation Checklist

1. Capture the current CLI/runtime behavior first.
   - Record the startup command, auth model, model-listing surface, session lifecycle, cancellation behavior, tool events, usage/cost metadata, and transcript/history format.
   - Prefer real wire traces and local runtime output over inferred schemas.
2. Decide the adapter boundary.
   - Use `src/providers/acp/` only for protocol-generic ACP behavior shared by at least two providers.
   - Keep provider-specific launch specs, settings, history parsing, model discovery, and UI config inside `src/providers/<provider>/`.
3. Add the provider-owned contracts together.
   - `registration.ts`
   - `capabilities.ts`
   - `settings.ts`
   - `models.ts` or model discovery state
   - `ui/*ChatUIConfig.ts`
   - runtime and launch environment
   - workspace services
   - plan usage provider, even if the initial implementation only returns `null`
4. Keep storage boundaries explicit.
   - Use provider-native files only when preserving CLI compatibility.
   - Use `.grimoire/<provider>/` for Grimoire-owned data.
   - Do not add legacy migrations unless a migration milestone explicitly asks for them.
5. Add focused tests before broad release work.
   - Provider registration and default enablement
   - Settings projection and normalization
   - Runtime launch spec and cancellation
   - Stream/tool normalization
   - History hydration
   - Usage/cost indicator behavior

## Next Candidate: Qwen Code

Target shape:

- Add `src/providers/qwen/` with its own `AGENTS.md` once the runtime surface is confirmed.
- Keep Qwen opt-in by default.
- Verify whether the current Qwen CLI exposes ACP, JSON-RPC, JSONL transcripts, or only a terminal-style interface before choosing the adapter.
- If ACP is available and stable, reuse `src/providers/acp/` for transport/session normalization while keeping Qwen-specific settings and model discovery in `src/providers/qwen/`.
- If ACP is not available, build a provider-specific runtime boundary rather than forcing Qwen through an incompatible abstraction.
- Capture model catalog, tool event shape, session persistence, and usage/cost metadata before implementing UI readouts.

Open questions:

- What is the stable Qwen launch command and protocol mode?
- Does Qwen expose a model catalog, or should Grimoire use a static model list first?
- Does Qwen expose plan usage, token usage, or spend metadata?
- Does Qwen support MCP or provider-native tools, and where should Grimoire reconcile those settings?
- Can Qwen resume sessions from provider-native history, or does Grimoire need provider-neutral transcript storage only?

## Other Candidates

- GitHub Copilot CLI: validate whether it exposes a stable agentic CLI/runtime surface suitable for non-interactive Obsidian embedding.
- Additional ACP providers: prefer shared ACP helpers only after confirming event compatibility with Gemini and OpenCode.
- Local model CLIs: treat as a separate milestone because tool execution, files, and usage indicators usually differ from hosted provider CLIs.

