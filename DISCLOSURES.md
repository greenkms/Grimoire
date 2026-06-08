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
