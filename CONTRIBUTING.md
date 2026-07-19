# Contributing to Grimoire

Thanks for helping improve Grimoire. This guide describes the architecture,
security, testing, and review expectations that apply to contributions.

## Before You Start

- Search existing issues and pull requests before opening a new change.
- Open or reference an issue for behavior changes, bug fixes, and provider work.
- Discuss broad architecture changes before implementing them, especially changes
  that affect multiple providers, permission handling, storage, or release behavior.
- Keep each pull request focused on one coherent problem. Separate follow-up work
  when it has a different root cause or acceptance criteria.

## Development Setup

Grimoire is an Obsidian desktop plugin. Node.js 22 and npm are used in CI.

```bash
npm ci
npm run dev
```

Useful verification commands:

```bash
npm run test
npm run typecheck
npm run lint
npm run build:release
```

Set `OBSIDIAN_VAULT` in `.env.local` if you want builds copied into a local test
vault. Do not commit local vault paths, credentials, transcripts, or debug artifacts.

## Architecture

The plugin shell is provider-neutral. Provider adapters wrap external tools such as
Claude Code, Codex, OpenCode, MiMoCode, Kimi Code, Antigravity CLI, and Grok Build.

- Put shared runtime, provider, security, storage, and tool contracts in `src/core/`
  only when at least two providers use the behavior.
- Keep protocol handling, CLI resolution, launch artifacts, mode and model
  normalization, storage, history parsing, and provider settings in
  `src/providers/<provider>/`.
- Register provider runtimes and services through `ProviderRegistry` and
  `ProviderWorkspaceRegistry`.
- Feature code under `src/features/` must consume provider-neutral contracts. It
  must not interpret provider-native identifiers or read provider-specific
  `Conversation.providerState` fields.
- Preserve native provider behavior when possible. Adapt documented or observed
  runtime semantics instead of reimplementing provider features in shared UI code.
- OpenCode and MiMoCode intentionally mirror each other closely. Check both when
  changing their shared launch, ACP, storage, history, settings, or UI behavior.

Read the nearest `AGENTS.md` before changing provider-specific or path-specific
code. These files contain durable implementation constraints for their directories.

## Security And Permission Modes

Provider responses, model output, session notifications, tool arguments, paths, and
external configuration are untrusted inputs.

- Never turn provider-observed state into a broader persistent permission without
  an explicit, attributable user action.
- Keep effective session state separate from the user's saved authorization when
  the values can diverge.
- Safe and Plan modes must not silently gain Auto-approve authority.
- Validate paths at the final filesystem boundary. Do not weaken workspace
  containment based on untrusted session state.
- Fall back between protocol methods only for the documented unsupported-method
  error. Re-throw transport, validation, authentication, and policy failures.
- Do not log secrets, environment values, prompts, note contents, or unsanitized
  provider payloads. Production code must not use `console.*`.
- Add regression coverage for both directions of every permission transition and
  for delayed, stale, mismatched-session, create, load, and reconnect events.

If a change affects authorization, filesystem scope, commands, credentials, MCP,
provider process launch, or external paths, explain the trust boundary and failure
mode in the pull request.

## Tests

Tests mirror `src/` under `tests/unit/` and `tests/integration/`.

- Add a focused regression test for every behavior change or bug fix.
- Test the real protocol shape, including structured error classes and codes. Avoid
  replacing protocol evidence with a generic `Error` carrying similar text.
- Inspect real provider runtime output before adding or changing normalization.
- Run the narrowest relevant tests while iterating, then run the complete gate before
  requesting review for meaningful provider or UI changes:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

State which commands were run and report any environment limitation. Do not claim
manual verification unless the behavior was exercised in Obsidian with the relevant
provider.

## Generated Artifacts And Dependencies

`npm run build:release` refreshes generated `main.js`, root `styles.css`, and
`dist/grimoire`. Commit generated release artifacts when their source changes and
verify that they match the build output.

npm is the canonical package manager. Keep `package-lock.json` synchronized with
`package.json`, and do not add another lockfile unless the repository intentionally
changes its package-management and CI workflow.

Do not commit temporary handoff material, local transcripts, provider credentials,
test vault contents, `.env.local`, or unrelated generated files.

## Pull Requests

A reviewable pull request should:

- explain the user-visible problem and the root cause;
- describe why the change belongs in the chosen shared or provider-owned layer;
- link the relevant issue with `Fixes #<issue>` when appropriate;
- list automated tests and truthful manual verification;
- call out permission, filesystem, process, credential, storage, and compatibility
  effects;
- include source and generated artifacts from the same build;
- avoid unrelated cleanup or refactoring;
- preserve attribution when incorporating another contributor's work, using a
  `Co-authored-by` trailer when appropriate.

Use the repository pull request template and keep its architecture and security
sections substantive. A passing test suite does not replace reasoning about trust
boundaries or provider-native behavior.

## Releases

Version changes must update `package.json`, `package-lock.json`, `manifest.json`,
`versions.json`, and `CHANGELOG.md` together. Release tags must exactly match the
manifest version and must not have a leading `v`.

Maintainers run the release workflow and final production dependency audit. Regular
bug-fix pull requests should not bump the plugin version unless requested.
