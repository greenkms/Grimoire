# Grimoire

<p align="center">
  <img src="assets/readme/grimoire-logo.png" alt="Grimoire logo" width="240">
</p>

<p align="center">
  <strong>Local-first AI agents for your Obsidian vault.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="docs/readme/README.zh-CN.md">简体中文</a> · <a href="docs/readme/README.zh-TW.md">繁體中文</a> · <a href="docs/readme/README.ja.md">日本語</a> · <a href="docs/readme/README.de.md">Deutsch</a> · <a href="docs/readme/README.fr.md">Français</a> · <a href="docs/readme/README.es.md">Español</a> · <a href="docs/readme/README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="Latest release">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="Desktop only">
</p>

<p align="center">
  <img src="assets/readme/chat-workspace.png" alt="Grimoire side panel running beside an Obsidian vault note" width="100%">
</p>

<p align="center">
  <sub>Chat with local CLI agents from the same Obsidian workspace where your notes live.</sub>
</p>

Grimoire brings agentic CLI assistants into Obsidian. Claude Code, Codex, Gemini CLI, and OpenCode all live in one side panel, where they read your notes, edit files, run commands, call tools, and keep session history against your real vault. Nothing routes through a Grimoire server. There's no telemetry, no hosted backend, and no proxy sitting in the middle.

It's built for people who already work in Obsidian and want AI help that behaves like part of the vault: local context, local files, a provider you pick on purpose, and usage you can actually see.

## Why Grimoire

- Use the CLI agents you already trust, right inside your notes.
- Switch providers from the composer. Claude Code, Codex, Gemini CLI, and OpenCode share one model picker.
- Ground every turn in your vault. Mention notes, folders, and MCP tools instead of pasting paths by hand.
- See cost and limits next to the model selector, where you're making the decision anyway.
- Stay local-first. Grimoire doesn't collect telemetry, proxy prompts, or run a backend.

## What each provider can do

| Capability | Claude Code | Codex | Gemini CLI | OpenCode |
| --- | --- | --- | --- | --- |
| Local persistent runtime | Yes | Yes | Yes | Yes |
| Native history hydration | Yes | Yes | Yes | Yes |
| Plan mode | Yes | Yes | Yes | Yes |
| Image attachments | Yes | Yes | Yes | Yes |
| Instruction mode | Yes | Yes | Yes | Yes |
| Reasoning effort controls | Yes | Yes | Yes | Yes |
| Rewind | Yes | No | No | No |
| Fork | Yes | Yes | No | No |
| Provider slash commands | Yes | No | No | Yes |
| Grimoire-managed MCP UI | Yes | No | No | No |

## Installation

Grimoire is a desktop plugin. It drives your provider CLIs locally, so there's no mobile build.

### With BRAT

BRAT can install Grimoire from GitHub Releases and keep it updated from tagged builds:

1. Install the "Obsidian42 - BRAT" plugin.
2. In BRAT, add a beta plugin from `sandsaber/Grimoire`.
3. Enable Grimoire.

### From GitHub Releases

Install the current release manually if you don't use BRAT:

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [Grimoire release](https://github.com/sandsaber/Grimoire/releases/latest).
2. Create `/path/to/your/vault/.obsidian/plugins/grimoire`.
3. Put all three files in that folder.
4. Enable Grimoire from Settings, Community plugins.

### From Community plugins

Once Grimoire is listed in the Obsidian community plugin directory:

1. Open Settings, go to Community plugins, and turn off Restricted mode if it's on.
2. Click Browse, search for Grimoire, and install it.
3. Enable Grimoire, then open its panel from the ribbon or the command palette.

### From source (developers)

Build the release bundle and drop it into your vault:

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

Then enable Grimoire from Settings, Community plugins.

Whichever path you pick, install at least one CLI provider before you start. Grimoire wraps the provider CLIs. It doesn't replace their account setup, model access, quotas, or terms.

## Set up a provider

Enable the providers you want under Settings, Grimoire, Providers, and they'll appear in the model selector. Codex is enabled on first launch; the rest are opt-in.

<p align="center">
  <img src="assets/readme/settings-providers.png" alt="Grimoire settings showing provider toggles, provider tabs, and appearance themes" width="100%">
</p>

### Claude Code

Pick Claude Code when you want its native project memory, slash commands, MCP configuration, plans, and rewind/fork, backed by your Claude subscription or API key.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Authenticate through Claude Code, then enable it in Grimoire.

- [Claude Code getting started](https://code.claude.com/docs/en/getting-started)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

Inside Grimoire, Claude Code reads and preserves your `.claude/` files, runs on the Claude Code SDK, and supports slash commands, MCP settings, agents, skills, plans, rewind, and fork. When Claude reports both, you'll see quota windows and API spend side by side.

### Codex

Codex is the default provider on first launch. Pick it for OpenAI Codex in a local CLI, signed in with your ChatGPT plan or an API key.

```bash
npm install -g @openai/codex
codex
```

You can also install it through the official Codex installer or Homebrew. Run it once, sign in, then enable it in Grimoire.

- [Codex CLI README](https://github.com/openai/codex/blob/main/README.md)
- [Codex getting started](https://github.com/openai/codex/blob/main/docs/getting-started.md)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

Inside Grimoire, Codex runs on its app-server protocol with native history, fork, plan mode, image input, and reasoning effort controls. Plan usage shows up when Codex reports rate-limit metadata.

### Gemini CLI

Pick Gemini CLI for Google's Gemini models over its ACP runtime.

```bash
npm install -g @google/gemini-cli
gemini
```

Gemini CLI supports Google login, Gemini API keys, and Vertex AI depending on your setup. Authenticate first, then enable it in Grimoire.

- [Gemini CLI documentation](https://google-gemini.github.io/gemini-cli/docs/)
- [Gemini CLI deployment](https://google-gemini.github.io/gemini-cli/docs/get-started/deployment.html)
- [Gemini CLI authentication](https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html)

Inside Grimoire, Gemini runs over ACP on stdio with a persistent runtime, native history, plan mode, images, and reasoning controls. Auxiliary workflows stay minimal for now. Daily quota isn't wired up yet, so Grimoire shows cost only when Gemini reports it.

### OpenCode

Pick OpenCode for a model-agnostic agent that brings its own provider configuration.

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash
opencode
```

Homebrew and Go installs work too. Configure your provider credentials in OpenCode, then enable it in Grimoire.

- [OpenCode GitHub repository](https://github.com/opencode-ai/opencode)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

Inside Grimoire, OpenCode runs over ACP with Grimoire-managed launch artifacts, plus persistent runtime, native history, plan mode, image input, provider commands, and reasoning effort. It reports monthly spend when cost metadata is available.

## Your first chat

1. Pick a provider and model in the composer.
2. Set reasoning effort and a permission mode.
3. Mention any notes, folders, or context you want in scope.
4. Send the turn.
5. Watch tool calls, usage, and output land in the panel.

## Features

### Chat workspace

A focused side panel with multiple tabs. Each tab keeps its own draft, provider, model, context, and runtime. Close and reopen Obsidian and your sessions come back, with the provider, model, and reasoning effort preserved on every response. Rewind and fork appear when the active provider supports them. Auto-scroll backs off the moment you scroll away to read something.

### Model selector

One picker, grouped by provider and sorted by label: Claude Code, Codex, Gemini, OpenCode. Search runs across labels, descriptions, groups, and model IDs. Catalogs load lazily and remember which groups you collapsed. Add custom aliases and context-window overrides in settings. Claude's 1M variants are extra options, not replacements for the base models.

<p align="center">
  <img src="assets/readme/model-selector-usage.png" alt="Grimoire model selector showing provider groups, model search, and plan usage" width="100%">
</p>

### Usage and cost

A badge next to the model selector keeps the active provider's usage in view, with fuller readouts inside the model menu: quota windows where a provider exposes them, spend where only cost is available. Stale numbers stay put while a refresh is in flight or fails, so the meter never blanks out. Turn the whole thing off in settings if you want a quieter UI.

| Provider | Where usage comes from |
| --- | --- |
| Claude Code | SDK rate-limit events, optional `.grimoire/claude/statusline-usage.json`, and SDK result cost metadata |
| Codex | Account rate-limit notifications and `account/rateLimits/read` when available |
| Gemini CLI | ACP cost metadata when Gemini reports it; daily quota isn't wired up yet |
| OpenCode | Monthly spend aggregated from ACP and session cost metadata |

### Context and mentions

Mention vault notes and folders straight from the composer, pull in the current or linked note, and add persistent external context paths in settings. Paste or drop images when the provider takes image input. Mention MCP servers where the provider integration supports it.

### Inline editing

Run "Grimoire: Inline edit" on a selection. A prompt opens next to the text, the edit comes back as a diff you accept or reject, and it routes through the provider-backed inline edit service. It handles both replacing a selection and inserting new text.

### Commands

Built-in commands cover Grimoire workflows like image generation and resume. Providers that expose their own commands, such as Claude Code slash commands and OpenCode runtime commands, surface them through provider-owned catalogs. Hide the ones you don't use from the dropdown in settings.

### Image generation

Paste or drop images to attach them. The built-in `/image [prompt]` command doesn't call any image API itself. It hands a normal turn to the active provider with instructions to use whatever image generation you've configured: provider-native tooling, MCP tools, or a local command. The agent saves the result in your vault and returns an embed like `![[path/to/image.png]]`. If nothing is set up for image generation, you get a plain answer explaining what's missing.

### Safety and permissions

Permission modes belong to the provider, so Grimoire surfaces them through shared composer controls instead of reinventing them. Safe mode and permission prompts stay visible while you work. Bang-bash mode only shows up when an enabled provider offers it. Treat configured MCP servers, shell access, and API keys as sensitive, because they are.

### Debug logging

Off by default. Turn it on and Grimoire writes sanitized JSONL to `.grimoire/logs/YYYY-MM-DD.jsonl`, with prompts, answers, note contents, paths, environment values, and secrets redacted. It's for diagnosing provider and runtime issues, not for keeping a transcript.

### Settings

General settings cover auto-scroll, title generation, usage indicators, debug logging, locale, tabs, and which provider owns the settings view. Per-provider tabs handle CLI paths, model behavior, commands, agents, skills, and provider-owned config where it exists. You can also set project workspace environment variables, scoped per provider when needed.

## Where Grimoire keeps your data

| Path | What's there |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings plus provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Claude usage snapshot for the plan meter |

Provider-native files under `.claude/`, `.codex/`, and `.opencode/` are read and written in place, so your provider setup stays portable outside Grimoire.

## Privacy

Grimoire runs inside Obsidian, on your machine. It has no backend, adds no telemetry, and never uploads your prompts, answers, notes, files, tool output, API keys, or usage logs to any Grimoire service. The only logs it writes are the optional, sanitized debug logs above, and those stay in your vault.

What it can't hide is the provider itself. Whichever CLI you enable receives the prompt, the context you selected, and the files, images, tool output, and commands a request needs. That CLI may then talk to Anthropic, OpenAI, Google, your configured OpenCode vendors, MCP servers, or anything else it's set up to reach. Terms, retention, billing, rate limits, and privacy policies are the provider's, not Grimoire's. Grimoire's job is to make that boundary visible and keep it under your control inside Obsidian.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:release
```

Before publishing or pushing meaningful UI or provider changes, run the full local gate:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` refreshes the generated `main.js`, the root `styles.css`, and `dist/grimoire`.

## Releases

Grimoire releases are published from semver tags such as `1.0.0`. The release workflow runs the local gate, builds the Obsidian bundle, verifies that the tag matches `package.json` and `manifest.json`, then attaches `main.js`, `manifest.json`, and `styles.css` to the GitHub Release.

Obsidian and BRAT consume those release assets directly. Use `main` for releasable development, then publish by tagging the version that matches the manifest.

## Roadmap

Today Grimoire ships with Claude Code, Codex, Gemini CLI, and OpenCode.

Next on the list: Qwen Code, GitHub Copilot CLI, other ACP-compatible providers, and local model CLIs once their runtime is stable enough to embed in Obsidian. Implementation notes live in [docs/provider-roadmap.md](docs/provider-roadmap.md).

## License

MIT. See [LICENSE](LICENSE).
