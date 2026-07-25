# Grimoire disclosures

This document summarizes Grimoire's privacy, network, account, payment, and file-access behavior for Obsidian community plugin review.

## Short version

Grimoire is a local-first Obsidian desktop plugin. It has no hosted backend, no client-side telemetry, no ads, and no self-update mechanism. It wraps user-installed CLI agents such as Claude Code, Codex, Gemini CLI, and OpenCode, so enabled providers may send selected prompts, context, files, images, tool output, and commands to their own services according to their own terms and privacy policies.

## Payments and accounts

Grimoire itself does not require payment and does not sell access to any hosted Grimoire service.

Full functionality requires at least one external CLI provider. Those providers may require an account, subscription, API key, or paid usage:

- Claude Code may require a Claude account, subscription, or API key.
- Codex may require an OpenAI or ChatGPT account, plan access, or API key.
- Gemini CLI may require a Google account, Gemini API key, or Vertex AI configuration.
- OpenCode may require provider credentials for the model vendors configured by the user.

Provider billing, quotas, rate limits, retention, and account requirements are controlled by the provider, not by Grimoire.

## Network use

Grimoire does not send data to a Grimoire server and does not proxy provider traffic.

Network use can happen when the user enables or configures external tools:

- Provider CLIs may contact Anthropic, OpenAI, Google, OpenCode-configured vendors, or other services required by that provider.
- User-configured MCP servers may contact remote services depending on the MCP server configuration.
- User-approved shell commands or provider tools may access the network if the command or tool does so.
- Installation and updates happen through Obsidian, BRAT, npm, or GitHub Releases, depending on the user's installation path.

### MCP server connectivity testing

When a user clicks "Test" on a configured HTTP or SSE MCP server, Grimoire verifies the connection using Node's `http`/`https` modules rather than Obsidian's `requestUrl`. This is required, not a stylistic choice: the Model Context Protocol SDK's streamable-HTTP and SSE transports need a streaming `fetch` implementation, and `requestUrl` buffers the entire response and cannot stream. Node's HTTP stack also avoids the renderer's CORS restrictions, which would otherwise block requests to remote MCP servers that do not send Obsidian-origin CORS headers. The request targets only the server URL the user entered, runs solely for the explicit test action, and is unrelated to normal turn traffic (which the provider CLIs handle themselves).

## System, shell, and filesystem access

Grimoire is desktop-only because it launches local CLI agents. To do that, it uses Node.js filesystem and process APIs.

Grimoire may inspect environment variables such as `PATH`, `HOME`, `APPDATA`, and provider-specific configuration variables to locate installed CLIs, Node.js, provider data directories, and user-configured runtime settings. Grimoire does not read `os.hostname()`, `os.userInfo()`, or `os.networkInterfaces()`.

Grimoire uses direct filesystem access for provider-owned files and runtime data that are outside the Obsidian vault API, including external context paths, provider history stores, CLI discovery, provider configuration, and Grimoire-owned `.grimoire/` data.

Grimoire launches subprocesses for provider CLIs, MCP transports, and user-approved shell commands. Shell execution is core to the plugin: provider CLIs and commands run locally with the permissions granted by the user's operating system and the selected provider permission mode.

## Data sent to providers

When a provider is enabled and the user sends a turn, the provider CLI may receive:

- the user's prompt;
- selected vault note content and mentioned files or folders;
- images or attachments included in the turn;
- tool call results and command output;
- provider settings needed to run the request.

Grimoire's role is to make that provider boundary visible inside Obsidian. The provider decides what is transmitted to its own services.

## File access

Grimoire reads and writes files in the user's vault to support chat sessions, settings, provider configuration, and user-requested edits.

Grimoire stores its own data under:

- `.grimoire/grimoire-settings.json`
- `.grimoire/sessions/*.meta.json`
- `.grimoire/logs/YYYY-MM-DD.jsonl` when debug logging is enabled
- `.grimoire/claude/statusline-usage.json` when Claude usage snapshots are configured

Grimoire also reads and preserves provider-native vault files such as `.claude/`, `.codex/`, and `.opencode/` when the corresponding provider integration uses them.

Users can add external context paths outside the vault. When they do, Grimoire may read those paths to surface files as selectable context for provider turns. Provider CLIs and user-approved shell commands may also access files outside the vault according to the provider's runtime and permission settings.

## Vault enumeration and clipboard access

Grimoire enumerates vault files to power note mentions, search, context selection, and vault text indexing. This gives the plugin access to vault file paths and, when selected or indexed, vault file contents.

Grimoire uses clipboard access only for explicit user actions such as copying code or markdown, importing MCP configuration from the clipboard, and accepting pasted images or text in the composer.

## Dynamic code in bundled dependencies

Grimoire's own source code does not call `eval()` or `new Function()`. The bundled release includes official provider and MCP SDK dependencies that contain runtime schema-validation code using generated functions, including AJV-based validators. Grimoire does not use this mechanism to execute user prompts, note contents, or downloaded plugin code.

## Logging

Debug logging is off by default.

When enabled, Grimoire writes sanitized JSONL logs to `.grimoire/logs/YYYY-MM-DD.jsonl`. These logs are intended for diagnosing provider and runtime issues. Grimoire redacts prompts, answers, note contents, paths, environment values, and secrets rather than storing a transcript.

## Telemetry, ads, and updates

Grimoire does not include:

- client-side telemetry;
- dynamic ads loaded over the internet;
- static ads inside or outside the plugin interface;
- a plugin self-update mechanism.

Updates are delivered through the normal Obsidian community plugin flow, BRAT, or GitHub Releases.

## Source, license, and bundled code

Grimoire is published under the MIT license. See [LICENSE](LICENSE).

Grimoire does not include closed-source Grimoire code. External provider CLIs, SDKs, MCP servers, and model vendors are separate projects with their own licenses and policies.

## Dependencies and known advisories

The Obsidian community plugin review may report "Potentially vulnerable dependency" warnings for packages such as `hono`, `@hono/node-server`, `fast-uri`, `ip-address`, `qs`, `@anthropic-ai/sdk`, `ws`, and `brace-expansion`. These are transitive dependencies inherited from the official provider SDKs (`@anthropic-ai/claude-agent-sdk`) and the Model Context Protocol SDK (`@modelcontextprotocol/sdk`), plus development-only tooling (ESLint, Jest, jsdom). None are direct Grimoire dependencies.

Grimoire keeps compatible patched versions selected by the current dependency graph and does not use npm `overrides` for these packages. Most server-side packages are not shipped to users: `hono`, `@hono/node-server`, `ip-address`, and `qs` are tree-shaken out of the release bundle because Grimoire uses the client-side portions of the MCP SDK.

`npm audit --omit=dev` currently reports three moderate entries that all trace to one advisory: [`GHSA-frvp-7c67-39w9`](https://github.com/advisories/GHSA-frvp-7c67-39w9), a Windows path traversal issue in `@hono/node-server`'s `serveStatic` helper.

- The latest MCP SDK release, `1.29.0`, requires `@hono/node-server ^1.19.9`; the advisory is fixed only in `@hono/node-server >=2.0.5`.
- npm's proposed remediation downgrades MCP SDK to `1.24.3` and Claude Agent SDK to `0.2.85`. It is not a compatible security update and would regress current provider/runtime behavior.
- Grimoire does not import the affected static-file server helper, and `@hono/node-server` and `serveStatic` are absent from the built `main.js`.
- `npm run audit:runtime` permits only this exact transitive advisory chain and fails on every other runtime audit finding. The release workflow runs that check before publishing.

| Package | Source | In `main.js` | Locked version | Advisory range | Status |
|---|---|---|---|---|---|
| `hono` | MCP SDK | No (tree-shaken) | 4.12.32 | tracked review advisories below 4.12.25 | Above tracked ranges |
| `@hono/node-server` | MCP SDK | No (tree-shaken) | 1.19.15 | `<2.0.5` | Known upstream advisory; affected helper is not bundled |
| `fast-uri` | MCP SDK (AJV) | Yes | 3.1.4 | tracked review advisories through 3.1.1 | Above tracked ranges |
| `ip-address` | MCP SDK (Express) | No (tree-shaken) | 10.3.1 | tracked review advisories through 10.1.0 | Above tracked ranges |
| `qs` | MCP SDK (Express) | No (tree-shaken) | 6.15.3 | tracked review advisories through 6.15.1 | Above tracked ranges |
| `@anthropic-ai/sdk` | Claude Agent SDK | Yes | 0.115.0 | tracked review advisories below 0.91.1 | Above tracked ranges |
| `ws` | jsdom (dev only) | No | 8.21.1 | tracked review advisories below 8.20.1 | Dev-only, above tracked ranges |
| `brace-expansion` | ESLint/Jest (dev only) | No | 5.0.8 for v5; nested dev-only copies are 1.1.16 and 2.1.2 | tracked v5 review advisory below 5.0.6 | Dev-only, above tracked range |

The `npm run review:deps` check (run automatically by `npm run build:release`) enforces the resolved versions for previously tracked review advisories. The runtime audit allowlist is intentionally separate and narrowly scoped to the single upstream `@hono/node-server` advisory described above.
