## Problem

<!-- What user-visible behavior or engineering problem does this PR address? -->

Fixes #

## Root Cause

<!-- Explain why the problem occurs. Link relevant protocol evidence or runtime traces. -->

## Approach

<!-- Summarize the implementation and important alternatives considered. -->

## Architecture

- [ ] Provider-native behavior remains inside `src/providers/<provider>/`.
- [ ] Shared code is provider-neutral and used by at least two providers, or the PR explains why it belongs there.
- [ ] I checked sibling providers when changing a shared ACP or provider contract.

Architecture notes:

<!-- Identify the owning layer and any new or changed shared contract. -->

## Security And Privacy

- [ ] Provider/session/model data is treated as untrusted input.
- [ ] Permission changes cannot silently widen persistent authorization.
- [ ] Filesystem, process, credential, MCP, and external-path boundaries are unchanged or explained below.
- [ ] Logs and fixtures contain no secrets, prompts, note contents, local paths, or unsanitized provider payloads.

Security notes:

<!-- Describe trust boundaries, authorization changes, failure behavior, and mitigations. Write “No security boundary change” only when accurate. -->

## Verification

Automated commands run:

```text
<!-- Example: npm run test -- --selectProjects unit -->
```

Manual verification:

<!-- Provider, OS, Obsidian workflow, exact steps, and observed result. Use “Not run” when applicable. -->

## Generated Artifacts

- [ ] `main.js`, `styles.css`, and `dist/grimoire` match `npm run build:release` when source changes require them.
- [ ] `package-lock.json` matches `package.json` when dependencies change.
- [ ] No unrelated or local-only artifacts are included.

## Review Checklist

- [ ] The PR is focused on one coherent problem.
- [ ] Behavior changes have focused regression tests.
- [ ] Protocol tests use real structured payloads and error codes.
- [ ] Documentation and user-facing copy are in English.
- [ ] The PR description accurately distinguishes automated tests from manual verification.
