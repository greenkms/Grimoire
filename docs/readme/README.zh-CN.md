# Grimoire · 魔导书

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Grimoire 标志" width="240">
</p>

<p align="center">
  <strong>面向 Obsidian vault 的本地优先 AI 代理。</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="许可证：MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="最新版本">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="仅桌面端">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Grimoire 侧边栏与 Obsidian 笔记并排运行" width="100%">
</p>

<p align="center">
  <sub>在笔记所在的同一个 Obsidian workspace 中，与本地 CLI 代理对话。</sub>
</p>

Grimoire 将 agentic CLI 助手带入 Obsidian。Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code、Grok Build 都在同一个侧边栏中运行：读取笔记、编辑文件、执行命令、调用工具，并把会话历史保存在真实的 vault 上下文中。Grimoire 不经过自家服务器：没有 telemetry、没有 hosted backend，也没有夹在你和 provider 之间的 proxy。

它面向已经在 Obsidian 中工作的人：你可以使用本地上下文、本地文件、明确选择的 provider，并在界面里直接看到 usage 和 cost。

> 英文 [README](../../README.md) 是项目的 canonical 文档。此简体中文版本与 `1.0.11` 文档保持同步。

## 为什么选择 Grimoire

- 在笔记里直接使用你已经信任的 CLI 代理。
- 从 composer 切换 provider。Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code、Grok Build 共用一个 model picker。
- 让每一次 turn 都基于 vault 上下文。可以 mention 笔记、文件夹和 MCP tools，不需要手动复制路径。
- 在选择模型的位置直接看到 cost 和 limits。
- 保持 local-first。Grimoire 不收集 telemetry，不 proxy prompts，也不运行 backend。

## 各 provider 能做什么

| 能力 | Claude Code | Codex | OpenCode | Grok Build | MiMoCode | Kimi Code | Antigravity CLI | Gemini CLI (Legacy) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 本地 persistent runtime | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| 原生 history hydration | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| Plan mode | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| Image attachments | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| Instruction mode | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| Reasoning effort controls | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 是 |
| Rewind | 是 | 否 | 否 | 是 | 否 | 否 | 否 | 否 |
| Fork | 是 | 是 | 否 | 是 | 否 | 否 | 否 | 否 |
| Provider slash commands | 是 | 否 | 是 | 是 | 是 | 是 | 否 | 否 |
| Grimoire-managed MCP UI | 是 | 否 | 否 | 否 | 否 | 否 | 否 | 否 |

## 安装

Grimoire 是桌面端插件。它会在本地驱动你的 provider CLIs，因此没有 mobile build。

### 使用 Community plugins（推荐）

请从 Obsidian community plugin directory 安装 Grimoire：

1. 打开 Settings，进入 Community plugins，如有需要先关闭 Restricted mode。
2. 点击 Browse，搜索 Grimoire 并安装。
3. 启用 Grimoire，然后通过 ribbon 或 command palette 打开面板。

### 使用 GitHub Releases

如果无法使用 Community plugins，可以手动安装当前 release：

1. 从最新的 [Grimoire release](https://github.com/sandsaber/Grimoire/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `/path/to/your/vault/.obsidian/plugins/grimoire`。
3. 将三个文件都放入该文件夹。
4. 在 Settings, Community plugins 中启用 Grimoire。

### 使用 BRAT

如果你想在 community directory 之外跟踪 tagged builds，BRAT 可以从 GitHub Releases 安装 Grimoire：

1. 安装 "Obsidian42 - BRAT" 插件。
2. 在 BRAT 中添加来自 `sandsaber/Grimoire` 的 beta plugin。
3. 启用 Grimoire。

### 从源代码安装

构建 release bundle，并放入你的 vault：

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

然后在 Settings, Community plugins 中启用 Grimoire。

无论使用哪种安装方式，请先安装至少一个 CLI provider。Grimoire 包装 provider CLIs，但不会替代它们的 account setup、model access、quotas 或 terms。

## 设置 provider

在 Settings, Grimoire, Providers 中启用你需要的 providers，它们会出现在 model selector 中。Codex 在首次启动时默认启用；其他 providers 是 opt-in。

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Grimoire 设置中的 provider toggles、provider tabs 和 appearance themes" width="100%">
</p>

### 推荐 providers

为了获得最好的 Grimoire 体验，建议先从 Claude Code、Codex、OpenCode、MiMoCode、Kimi Code 或 Grok Build 开始。这些 providers 目前为 vault-native 工作提供最强的 runtime surface：persistent sessions、history hydration、plan-oriented workflows、tool activity，以及更丰富的 model controls。

Antigravity CLI 和 Gemini CLI (Legacy) 仍然可用，尤其适合 Google accounts 和 compatibility 场景，但它们现在在 Grimoire 中更受限制，因为当前 CLI surfaces 暴露的 session、tool、approval 和 streaming metadata 更少。

### Claude Code

如果你需要 Claude 的 native project memory、slash commands、MCP configuration、plans、rewind/fork，并希望通过 Claude subscription 或 API key 工作，可以选择 Claude Code。

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude
```

先通过 Claude Code 完成认证，然后在 Grimoire 中启用它。旧的 npm package 已 deprecated；请使用上面的 native installer、Homebrew (`brew install --cask claude-code`)、WinGet，或 official quickstart 中的其他选项。

- [Claude Code quickstart](https://code.claude.com/docs/en/quickstart)

在 Grimoire 中，Claude Code 会读取并保留你的 `.claude/` 文件，运行在 Claude Code SDK 上，并支持 slash commands、MCP settings、agents、skills、plans、rewind 和 fork。当 Claude 同时报告 quota 和 cost 时，你会并排看到 quota windows 和 API spend。

**Respect Claude Code settings** is enabled by default. Grimoire reads Claude Code user settings (`~/.claude/settings.json`) and vault settings (`.claude/settings.json`) for `model` and `env`, then uses those values in the Claude model selector and runtime environment. This lets Claude Code custom models work in Grimoire too, including Anthropic-compatible gateways such as MiniMax, Z.ai, and others. Project settings override user settings, and explicit Grimoire environment settings override both.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_MODEL": "glm-5.2[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.7-flash"
  }
}
```

### Codex

Codex 是首次启动时的默认 provider。选择它可以在本地 CLI 中使用 OpenAI Codex，并通过 ChatGPT plan 或 API key 登录。

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex
```

先运行一次 Codex 并登录，然后在 Grimoire 中启用。Standalone installer 现在是 primary install path；Windows、Homebrew 和 fallback package-manager options 请参考官方 Codex CLI 文档。

- [Codex CLI setup](https://developers.openai.com/codex/cli)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

在 Grimoire 中，Codex 通过 app-server protocol 运行，支持 native history、fork、plan mode、image input 和 reasoning effort controls。当 Codex 报告 rate-limit metadata 时，plan usage 会显示出来。

### Antigravity CLI

Antigravity CLI 是 Google 推荐用于 consumer Gemini CLI 场景的替代工具。选择它即可使用 Google 的 multi-model agent CLI，包括 Gemini、Claude、GPT-OSS，以及你的 Antigravity account 可访问的其他模型系列。

```bash
agy
```

从 Google 安装官方 Antigravity CLI，在本机完成认证，然后在 Grimoire 中启用 Antigravity。Grimoire 会从 PATH 自动检测 `agy`，你也可以在 provider settings 中设置 custom CLI path。

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

在 Grimoire 中，Antigravity 是推荐的 Google provider。它通过 `agy --print` 运行，并可从 `agy models` 选择模型。在 Antigravity 暴露兼容的 runtime surface 之前，persistent sessions、native history、images、plan mode 和 auxiliary workflows 都保持关闭。

### Gemini CLI (Legacy)

Gemini CLI 作为 legacy provider 保留给 Gemini Code Assist Standard、Enterprise、Google Cloud 和 paid API-key users，前提是 Google 仍继续服务 Gemini CLI requests。Consumer Google AI Pro、Ultra 和 free-tier accounts 在 June 18, 2026 之后应使用 Antigravity。

```bash
gemini
```

只有当你的 account tier 仍受支持时才启用 Gemini CLI。Grimoire 通过 `gemini --acp` 运行它，将 active note、editor/browser/canvas selection、vault search 和 project workspace context 加入 ACP prompt，并标记为 legacy，避免和推荐的 Google provider 混淆。

### OpenCode

如果你想使用自带 provider configuration 的 model-agnostic agent，可以选择 OpenCode。

```bash
curl -fsSL https://opencode.ai/install | bash
opencode
```

Homebrew、npm、bun 和 package-manager installs 也可以。先在 OpenCode 中配置 provider credentials，然后在 Grimoire 中启用。

- [OpenCode download](https://opencode.ai/download)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

在 Grimoire 中，OpenCode 通过 ACP 运行，使用 Grimoire-managed launch artifacts，并支持 persistent runtime、native history、plan mode、image input、provider commands 和 reasoning effort。当 cost metadata 可用时，它会显示 monthly spend。

### MiMoCode

MiMoCode（小米）是 OpenCode 的分支，具有持久记忆、智能上下文管理和子代理编排功能。

```bash
curl -fsSL https://mimo.xiaomi.com/install | bash
mimo
```

- [MiMoCode GitHub](https://github.com/XiaomiMiMo/MiMo-Code)

### Kimi Code

Kimi Code CLI（月之暗面）是一个多模型终端代理，支持 Kimi、OpenAI、Anthropic、Gemini 和 Vertex AI 模型。

```bash
curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash
kimi
```

- [Kimi Code GitHub](https://github.com/MoonshotAI/kimi-code)

### Grok Build

若要在 Obsidian 中使用 xAI 的 agentic CLI，可选择 Grok Build，支持 SuperGrok credits 或 API keys。

```bash
grok
```

安装 xAI 的 Grok CLI，通过 grok.com OAuth 认证或配置 API keys，然后在 Grimoire 中启用 Grok Build。

- [Grok Build](https://grok.com/build)

在 Grimoire 中，Grok Build 通过 `grok agent stdio` 以 ACP 运行，使用 `.grimoire/grok/` 下的 Grimoire-managed launch artifacts，并支持 persistent runtime、native JSONL history hydration、plan mode、image input、provider commands、native models 上的 reasoning effort、rewind 和 fork。OAuth auth 可用时，SuperGrok credit usage 会显示在 model selector 旁；API spend 会在 session cost metadata 上报时聚合显示。

## 第一次聊天

1. 在 composer 中选择 provider 和 model。
2. 设置 reasoning effort 和 permission mode。
3. Mention 你希望纳入 scope 的笔记、文件夹或 context。
4. 发送 turn。
5. 在面板里查看 tool calls、usage 和输出。

## 功能

### Chat workspace

一个专注的侧边栏，支持多个 tabs。每个 tab 都保留自己的 draft、provider、model、context 和 runtime。关闭再打开 Obsidian 后，会话会恢复，并且每个 response 都保留 provider、model 和 reasoning effort。Rewind 和 fork 会在当前 provider 支持时出现。你一旦手动滚动去阅读历史，auto-scroll 会自动让位。

### Model selector

一个 picker，按 provider 分组，并按 label 排序：Antigravity、Claude Code、Codex、Gemini CLI (Legacy)、Grok Build、OpenCode。Search 会匹配 labels、descriptions、groups 和 model IDs。Catalogs 会 lazy load，并记住你折叠过的 groups。你可以在 settings 中添加 custom aliases 和 context-window overrides。Claude 的 1M variants 是额外 options，不会替代 base models。

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Grimoire model selector 显示 provider groups、model search 和 plan usage" width="100%">
</p>

### Usage 和 cost

Model selector 旁边的 badge 会持续显示当前 provider 的 usage；model menu 中有更完整的 readouts：如果 provider 暴露 quota windows 就显示 quota，如果只有 cost 可用就显示 spend。Refresh 进行中或失败时，最后一次成功的数值会保留，因此 meter 不会突然清空。如果你想要更安静的 UI，可以在 settings 中关闭整个 usage/cost 显示。

| Provider | Usage 来源 |
| --- | --- |
| Claude Code | SDK rate-limit events、可选的 `.grimoire/claude/statusline-usage.json` 和 SDK result cost metadata |
| Codex | Account rate-limit notifications，以及可用时的 `account/rateLimits/read` |
| Antigravity CLI | `agy --print` 目前还不提供 |
| Gemini CLI (Legacy) | Gemini CLI 返回时的 ACP cost metadata |
| OpenCode | 从 ACP 和 session cost metadata 聚合的 monthly spend |
| MiMoCode | 从 ACP 和 session cost metadata 聚合的 monthly spend |
| Kimi Code | 从 ACP 和 session cost metadata 聚合的 monthly spend |
| Grok Build | OAuth auth 可用时来自 grok.com billing 的 SuperGrok credit windows；来自 session cost metadata 的 monthly API spend |

### Context 和 mentions

可以直接在 composer 中 mention vault notes 和 folders，拉入 current 或 linked note，并在 settings 中添加 persistent external context paths。Provider 支持 image input 时，可以粘贴或拖放图片。支持的 provider integrations 中也可以 mention MCP servers。Context 标签页会显示绑定的笔记、model、permission mode、固定文件、`.grimoire/grok/system.md` 等 launch artifacts，以及 agent 在 session 期间加载的文件。

### Inline editing

对选中文本运行 "Grimoire: Inline edit"。Prompt 会在文本旁打开，edit 会以 diff 返回，你可以 accept 或 reject，并且会通过 provider-backed inline edit service 执行。它既支持替换 selection，也支持插入新文本。

### Commands

Built-in commands 覆盖 Grimoire workflows，例如 image generation 和 resume。Provider 暴露的自有 commands，例如 Claude Code slash commands、OpenCode runtime commands 和 Grok Build runtime commands，会通过 provider-owned catalogs 展示。你可以在 settings 中隐藏不使用的 commands。

### Image generation

粘贴或拖放图片即可附加到 turn。Built-in `/image [prompt]` command 本身不会调用任何 image API。它会向当前 provider 发送一个普通 turn，指示 provider 使用你已配置的 image generation 能力：provider-native tooling、MCP tools 或 local command。Agent 会把结果保存到 vault，并返回类似 `![[path/to/image.png]]` 的 embed。如果没有配置 image generation，你会得到一条普通回复，说明缺少什么。

### Safety 和 permissions

Permission modes 属于 provider，因此 Grimoire 通过 shared composer controls 展示它们，而不是重新实现一套。Safe mode 和 permission prompts 在工作时保持可见。Bang-bash mode 只会在 enabled provider 提供时显示。Configured MCP servers、shell access 和 API keys 都应该被视为 sensitive，因为它们确实 sensitive。

### Debug logging

默认关闭。启用后，Grimoire 会将 sanitized JSONL 写入 `.grimoire/logs/YYYY-MM-DD.jsonl`，其中 prompts、answers、note contents、paths、environment values 和 secrets 都会被 redact。它用于诊断 provider 和 runtime issues，而不是保存 transcript。

### Settings

General settings 覆盖 auto-scroll、title generation、usage indicators、debug logging、locale、tabs，以及哪个 provider 拥有 settings view。Per-provider tabs 处理 CLI paths、model behavior、commands、agents、skills 和 provider-owned config。你还可以设置 project workspace environment variables，并按 provider scoped。

## Grimoire 将数据存放在哪里

| Path | 内容 |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings 和 provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | 用于 plan meter 的 Claude usage snapshot |
| `.grimoire/grok/` | Grok Build launch artifacts、managed config 和 session pointers |

Provider-native files under `.claude/`, `.codex/`, `.opencode/`, and `.grimoire/grok/` 会被原地读取和写入，因此你的 provider setup 在 Grimoire 之外仍然可移植。

## 隐私

Grimoire 运行在 Obsidian 内部、你的电脑上。它没有 backend，不添加 telemetry，也不会把 prompts、answers、notes、files、tool output、API keys 或 usage logs 上传到任何 Grimoire service。它唯一会写入的 logs 是上面提到的 optional sanitized debug logs，并且这些 logs 留在你的 vault 中。

它无法隐藏的是 provider 本身。你启用的 CLI 会收到 prompt、你选择的 context，以及 request 所需的 files、images、tool output 和 commands。该 CLI 可能会访问 Anthropic、OpenAI、Google、你配置的 OpenCode vendors、MCP servers，或者任何你设置过的其他目标。Terms、retention、billing、rate limits 和 privacy policies 属于 provider，而不是 Grimoire。Grimoire 的职责是在 Obsidian 中让这条边界清晰可见，并由你控制。

如需了解面向 Obsidian 政策的网络使用、账户要求、外部文件访问、日志记录和 telemetry 的摘要，请参阅 [DISCLOSURES.md](../DISCLOSURES.md)。

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

在发布或 push 重要 UI/provider changes 之前，请运行完整 local gate：

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` 会刷新 generated `main.js`、root `styles.css` 和 `dist/grimoire`。

npm 是 development、CI 和 releases 的 canonical package manager。dependencies 变化时，请保持 `package-lock.json` 最新；secondary package-manager lockfiles 有意不提交。

## Releases

Grimoire releases 通过 semver tags 发布，例如 `1.0.0`。Release workflow 会运行 local gate，构建 Obsidian bundle，验证 tag 与 `package.json` 和 `manifest.json` 匹配，然后将 `main.js`、`manifest.json` 和 `styles.css` 附加到 GitHub Release。

Obsidian Community plugins 是推荐的用户安装方式。GitHub Releases 仍然提供用于手动安装和 BRAT 的 bundle assets。使用 `main` 做 releasable development，然后通过与 manifest version 匹配的 tag 发布。

## Roadmap

目前 Grimoire 随 Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code 和 Grok Build 一起发布。

下一步计划：Qwen Code、GitHub Copilot CLI、其他 ACP-compatible providers，以及当 runtime 足够稳定可嵌入 Obsidian 时的 local model CLIs。Implementation notes 位于 [docs/provider-roadmap.md](../provider-roadmap.md)。

## 许可证

MIT。参见 [LICENSE](../../LICENSE)。
