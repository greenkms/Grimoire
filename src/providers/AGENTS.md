# Providers Agent Instructions

`src/providers/` contains provider adapters and provider-owned workspace services. Shared provider contracts belong in `src/core/providers/`; concrete runtime behavior belongs in a provider subdirectory.

## Rules

- Register runtimes, capabilities, auxiliary services, and workspace services through the provider registry modules.
- Keep provider-specific launch specs, CLI resolution, history parsing, storage, settings tabs, and UI config in the concrete provider directory.
- Keep cross-provider protocol helpers only when at least two providers use them. ACP helpers belong in `src/providers/acp/`.
- Do not leak provider-specific `providerState` fields into `src/features/`; expose typed provider helpers or neutral runtime/session updates instead.
- Provider defaults and enablement should stay explicit. Do not silently turn opt-in providers into default providers.
- Provider plan usage belongs to provider-owned stores registered through `ProviderWorkspaceRegistry`. UI code consumes only the shared `ProviderPlanUsageProvider` contract.

## When Adding or Changing a Provider

- Add or update the provider's `registration.ts`, `capabilities.ts`, settings projection, chat UI config, runtime, plan-usage provider, and workspace services together.
- Add focused tests for provider routing, settings projection, launch/config changes, and any stream normalization behavior.
- Capture current wire/runtime output before normalizing new event shapes.
