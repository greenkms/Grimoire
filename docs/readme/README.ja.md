# Grimoire · 魔導書

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Grimoire ロゴ" width="240">
</p>

<p align="center">
  <strong>Obsidian vault のための local-first AI エージェント。</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="ライセンス: MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="最新リリース">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="デスクトップのみ">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Obsidian のノート横で動作する Grimoire サイドパネル" width="100%">
</p>

<p align="center">
  <sub>ノートがある同じ Obsidian workspace で、ローカル CLI エージェントと会話できます。</sub>
</p>

Grimoire は agentic CLI アシスタントを Obsidian に組み込みます。Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code、Grok Build がひとつのサイドパネルに入り、ノートを読み、ファイルを編集し、コマンドを実行し、ツールを呼び出し、実際の vault に紐づいた session history を保持します。Grimoire のサーバーは介在しません。Telemetry も hosted backend も、あなたと provider の間に入る proxy もありません。

Grimoire は、すでに Obsidian で作業している人のために作られています。ローカル context、ローカル files、意図して選ぶ provider、そして UI 上で確認できる usage と cost を重視しています。

> 英語版 [README](../../README.md) がプロジェクトの canonical document です。この日本語版は `1.0.11` のドキュメントに同期しています。

## Grimoire を使う理由

- すでに信頼している CLI エージェントを、ノートの中で直接使えます。
- Composer から provider を切り替えられます。Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code、Grok Build は同じ model picker を共有します。
- すべての turn を vault context に grounded できます。ノート、フォルダ、MCP tools を mention でき、手で path を貼る必要がありません。
- Model selector のすぐ横で cost と limits を確認できます。
- Local-first のまま使えます。Grimoire は telemetry を集めず、prompts を proxy せず、backend を実行しません。

## 各 provider ができること

| Capability | Claude Code | Codex | OpenCode | Grok Build | MiMoCode | Kimi Code | Antigravity CLI | Gemini CLI (Legacy) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local persistent runtime | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Native history hydration | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Plan mode | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Image attachments | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Instruction mode | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Reasoning effort controls | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Rewind | Yes | No | No | Yes | No | No | No | No |
| Fork | Yes | Yes | No | Yes | No | No | No | No |
| Provider slash commands | Yes | No | Yes | Yes | Yes | Yes | No | No |
| Grimoire-managed MCP UI | Yes | No | No | No | No | No | No | No |

## インストール

Grimoire は desktop plugin です。Provider CLIs をローカルで実行するため、mobile build はありません。

### Community plugins からインストール（推奨）

Obsidian community plugin directory から Grimoire をインストールしてください。

1. Settings を開き、Community plugins に移動し、必要なら Restricted mode をオフにします。
2. Browse をクリックし、Grimoire を検索してインストールします。
3. Grimoire を有効化し、ribbon または command palette からパネルを開きます。

### GitHub Releases からインストール

Community plugins を使えない場合は、現在の release を手動でインストールできます。

1. 最新の [Grimoire release](https://github.com/sandsaber/Grimoire/releases/latest) から `main.js`、`manifest.json`、`styles.css` をダウンロードします。
2. `/path/to/your/vault/.obsidian/plugins/grimoire` を作成します。
3. 3 つのファイルをそのフォルダに入れます。
4. Settings, Community plugins から Grimoire を有効化します。

### BRAT でインストール

Community directory の外で tagged builds を追跡したい場合、BRAT は GitHub Releases から Grimoire をインストールできます。

1. "Obsidian42 - BRAT" plugin をインストールします。
2. BRAT で `sandsaber/Grimoire` から beta plugin を追加します。
3. Grimoire を有効化します。

### ソースからインストール

Release bundle を build して vault に配置します。

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

その後、Settings, Community plugins から Grimoire を有効化します。

どの方法を選んでも、開始前に少なくとも 1 つの CLI provider をインストールしてください。Grimoire は provider CLIs を包みますが、account setup、model access、quotas、terms を置き換えるものではありません。

## Provider の設定

Settings, Grimoire, Providers で使いたい providers を有効化すると、model selector に表示されます。Codex は初回起動時に有効です。他の providers は opt-in です。

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Provider toggles、provider tabs、appearance themes を表示する Grimoire settings" width="100%">
</p>

### 推奨 providers

Grimoire で最高の体験を得るには、まず Claude Code、Codex、OpenCode、MiMoCode、Kimi Code、Grok Build から始めるのがおすすめです。これらの providers は現在、vault-native な作業に必要な runtime surface が最も強く、persistent sessions、history hydration、plan-oriented workflows、tool activity、豊富な model controls を扱えます。

Antigravity CLI と Gemini CLI (Legacy) も Google accounts や compatibility cases 向けに引き続き利用できますが、現時点では Grimoire の primary provider としては推奨していません。Grimoire は best-effort でこれらをサポートし、現在の CLI が許す fallback は実装していますが、ACP と runtime surfaces には技術的な制限があります。sessions、approvals、streaming、tool/edit metadata、model discovery、usage reporting は、推奨 providers と比べて不完全または不安定です。

### Claude Code

Native project memory、slash commands、MCP configuration、plans、rewind/fork を使いたい場合や、Claude subscription または API key で作業したい場合は Claude Code を選びます。

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude
```

Claude Code で認証してから、Grimoire で有効化します。古い npm package は deprecated です。上記の native installer、Homebrew (`brew install --cask claude-code`)、WinGet、または official quickstart の他の options を使ってください。

- [Claude Code quickstart](https://code.claude.com/docs/en/quickstart)

Grimoire 内では、Claude Code は `.claude/` files を読み取り、保持し、Claude Code SDK 上で動作します。Slash commands、MCP settings、agents、skills、plans、rewind、fork をサポートします。Claude が quota と cost の両方を報告する場合、quota windows と API spend が並んで表示されます。

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

Codex は初回起動時の default provider です。ChatGPT plan または API key で認証した local CLI 上の OpenAI Codex を使う場合に選びます。

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
codex
```

Codex を一度実行して sign in し、その後 Grimoire で有効化します。Standalone installer が現在の primary install path です。Windows、Homebrew、fallback package-manager options は公式 Codex CLI docs を参照してください。

- [Codex CLI setup](https://developers.openai.com/codex/cli)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

Grimoire 内では、Codex は app-server protocol で動作し、native history、fork、plan mode、image input、reasoning effort controls をサポートします。Codex が rate-limit metadata を報告すると、plan usage が表示されます。

### Antigravity CLI

Antigravity CLI は consumer Gemini CLI 向けの Google の後継で、あなたの Antigravity account で利用できる Gemini、Claude、GPT-OSS、その他の model families を扱えます。Grimoire 内では、推奨 default ではなく compatibility provider として扱ってください。

```bash
agy
```

Google 公式の Antigravity CLI をインストールし、ローカルで認証してから Grimoire で Antigravity を有効化します。Grimoire は PATH から `agy` を自動検出しますが、provider settings で custom CLI path を指定することもできます。

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

Grimoire 内では、Antigravity は `agy --print` で実行され、`agy models` から model selection もできます。これは best-effort integration です。`agy` は現時点で Grimoire に十分強い ACP-compatible runtime を公開していません。Antigravity が安定した runtime surfaces を公開するまで、persistent sessions、native history、images、plan mode、streaming、approval-safe file edits、reliable usage reporting、auxiliary workflows は無効または制限されたままです。

Windows note: current Windows `agy` builds can finish successfully while returning empty stdout for `agy models` and `agy --print`. Grimoire uses best-effort recovery from Antigravity logs, transcripts, settings, and a seeded Pro AI model list, but Windows Antigravity support may be less reliable than macOS or Linux. If your account shows additional models in Antigravity, add their exact labels under Antigravity settings > Custom models.

### Gemini CLI (Legacy)

Gemini CLI は、Google が Gemini CLI requests を継続提供する Gemini Code Assist Standard、Enterprise、Google Cloud、paid API-key users 向けの legacy compatibility provider として残ります。ACP support が弱く、いくつかの Grimoire workflows をその上で信頼性高く実装できないため、新しい Grimoire setup では推奨しません。Consumer Google AI Pro、Ultra、free-tier accounts は June 18, 2026 以降、上記の Antigravity 制限を理解したうえで Antigravity を使ってください。

```bash
gemini
```

Gemini CLI は、account tier がまだサポートされていて、その legacy Google path が必要な場合だけ有効化してください。Grimoire は `gemini --acp` で起動し、active note、editor/browser/canvas selection、vault search、project workspace context を ACP prompt に追加し、推奨 provider に見えないよう legacy と表示します。可能なら Codex、Claude Code、OpenCode、MiMoCode、Kimi Code、Grok Build を優先してください。

### OpenCode

独自の provider configuration を持つ model-agnostic agent を使いたい場合は OpenCode を選びます。

```bash
curl -fsSL https://opencode.ai/install | bash
opencode
```

Homebrew、npm、bun、package-manager installs も使えます。OpenCode 側で provider credentials を設定し、その後 Grimoire で有効化します。

- [OpenCode download](https://opencode.ai/download)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

Grimoire 内では、OpenCode は ACP で動作し、Grimoire-managed launch artifacts、persistent runtime、native history、plan mode、image input、provider commands、reasoning effort をサポートします。Cost metadata が利用できる場合は monthly spend を表示します。

### MiMoCode

MiMoCode（小米）はOpenCodeのフォークで、永続メモリ、インテリジェントなコンテキスト管理、サブエージェントオーケストレーションを備えています。

```bash
curl -fsSL https://mimo.xiaomi.com/install | bash
mimo
```

Homebrew、npm、bun、package-manager installs も使えます。MiMoCode 側で provider credentials を設定し、その後 Grimoire で有効化します。

- [MiMoCode GitHub](https://github.com/XiaomiMiMo/MiMo-Code)

Grimoire 内では、MiMoCode は ACP で動作し、persistent runtime、native history、plan mode、image input、provider commands、reasoning effort をサポートします。

### Kimi Code

Kimi Code CLI（MoonshotAI）は、Kimi、OpenAI、Anthropic、Gemini、Vertex AIモデルをサポートするマルチプロバイダー端末エージェントです。

```bash
curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash
kimi
```

Kimi Code 側で provider credentials を設定し、その後 Grimoire で有効化します。

- [Kimi Code GitHub](https://github.com/MoonshotAI/kimi-code)

Grimoire 内では、Kimi Code は ACP で動作し、persistent runtime、native history、plan mode、image input、provider commands、reasoning effort をサポートします。

### Grok Build

Obsidian で xAI の agentic CLI を使う場合は Grok Build を選びます。SuperGrok credits または API keys で利用できます。

```bash
grok
```

xAI の Grok CLI をインストールし、grok.com OAuth で認証するか API keys を設定してから、Grimoire で Grok Build を有効化します。

- [Grok Build](https://grok.com/build)

Grimoire 内では、Grok Build は `grok agent stdio` 経由の ACP で動作し、`.grimoire/grok/` 配下の Grimoire-managed launch artifacts、persistent runtime、native JSONL history hydration、plan mode、image input、provider commands、native models 向け reasoning effort、rewind、fork をサポートします。OAuth auth が利用できる場合、SuperGrok credit usage は model selector の横に表示されます。API spend は session cost metadata が報告されたときに集計されます。

## 最初のチャット

1. Composer で provider と model を選びます。
2. Reasoning effort を設定し、permission control で Safe、Auto-approve、Plan のいずれかを選びます。
3. Scope に入れたい notes、folders、context を mention します。
4. Turn を送信します。
5. Panel に表示される tool calls、usage、output を確認します。

## 機能

### Chat workspace

複数 tabs を持つ集中型サイドパネルです。各 tab は独自の draft、provider、model、context、runtime を保持します。Obsidian を閉じて再度開いても sessions は復元され、各 response に provider、model、reasoning effort が保持されます。Rewind と fork は、active provider がサポートする場合に表示されます。履歴を読むために手動で scroll すると、auto-scroll は自動的に控えます。

### Model selector

ひとつの picker が provider ごとに grouped され、label 順に並びます：Antigravity、Claude Code、Codex、Gemini CLI (Legacy)、Grok Build、OpenCode、MiMoCode、Kimi Code。Search は labels、descriptions、groups、model IDs を横断します。Catalogs は lazily に load され、collapse した groups を記憶します。Settings で custom aliases と context-window overrides を追加できます。Claude の 1M variants は base models の置き換えではなく、追加 options です。

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Provider groups、model search、plan usage を表示する Grimoire model selector" width="100%">
</p>

### Usage と cost

Model selector の横の badge が active provider の usage を表示します。Model menu にはより詳しい readouts があり、provider が quota windows を公開する場合は quota を、cost だけが利用できる場合は spend を表示します。Refresh 中や失敗時も最後に取得できた値を保つため、meter が急に消えることはありません。静かな UI が好みなら settings で全体をオフにできます。

| Provider | Usage の取得元 |
| --- | --- |
| Claude Code | SDK rate-limit events、任意の `.grimoire/claude/statusline-usage.json`、SDK result cost metadata |
| Codex | Account rate-limit notifications、利用可能な場合は `account/rateLimits/read` |
| Antigravity CLI | `agy --print` からはまだ信頼性高く取得不可 |
| Gemini CLI (Legacy) | Gemini CLI が返す場合の ACP cost metadata。legacy provider のみ |
| OpenCode | ACP と session cost metadata から集計した monthly spend |
| MiMoCode | ACP と session cost metadata から集計した monthly spend |
| Kimi Code | ACP と session cost metadata から集計した monthly spend |
| Grok Build | OAuth auth が利用できる場合の grok.com billing からの SuperGrok credit windows；session cost metadata からの monthly API spend |

### Context と mentions

Composer から vault notes と folders を直接 mention できます。Current note や linked note を取り込み、settings で persistent external context paths を追加できます。Provider が image input を受け付ける場合は、画像を貼り付けたり drop したりできます。Provider integration が対応する場合は MCP servers も mention できます。Context tab には、bound note、model、permission mode、pinned files、`.grimoire/grok/system.md` のような launch artifacts、および session 中に agent が読み込んだ files が表示されます。

### Inline editing

選択範囲に対して "Grimoire: Inline edit" を実行します。Prompt がテキストの横に開き、edit は accept/reject できる diff として返り、provider-backed inline edit service を通じて実行されます。Selection の置換と新しい text の挿入の両方に対応しています。

### Clarifying questions

Provider が structured user input を求めると、Grimoire は turn を一時停止し、composer の上に質問を表示します。Claude Code ではこれを `AskUserQuestion` として公開し、Codex app-server では experimental な `request_user_input` / `requestUserInput` surface として公開します。Grimoire はこれらの provider-specific mechanisms を同じ inline question UI に normalize します。Single-select、multi-select、freeform answers は provider run に戻されるため、agent は別の chat message なしで続行できます。

### Commands

Built-in commands は image generation や resume などの Grimoire workflows をカバーします。Claude Code slash commands、OpenCode runtime commands、Grok Build runtime commands のように provider が独自 commands を公開する場合は、provider-owned catalogs 経由で表示されます。使わない commands は settings で隠せます。

### Image generation

画像を貼り付けるか drop すると attachment として追加できます。Built-in `/image [prompt]` command は image API を直接呼びません。Active provider に通常の turn を送り、あなたが設定した image generation 手段を使うよう指示します：provider-native tooling、MCP tools、または local command。Agent は結果を vault に保存し、`![[path/to/image.png]]` のような embed を返します。Image generation が設定されていない場合は、何が不足しているかを説明する通常の回答が返ります。

### Safety と permissions

Permission modes は provider に属するため、Grimoire はそれらを再実装せず、shared composer controls として表示します。Active provider が plan mode をサポートする場合、permission control は Safe、Auto-approve、Plan を順に切り替えます。`Shift+Tab` は Plan に入る、または Plan から戻るための quick shortcut のままです。Safe mode と permission prompts は作業中も見える状態を保ちます。Bang-bash mode は、enabled provider が提供する場合にのみ表示されます。Configured MCP servers、shell access、API keys は sensitive data として扱ってください。実際に sensitive だからです。

### Debug logging

Default ではオフです。有効にすると、Grimoire は sanitized JSONL を `.grimoire/logs/YYYY-MM-DD.jsonl` に書き込みます。Prompts、answers、note contents、paths、environment values、secrets は redact されます。これは provider と runtime issues を診断するためのもので、transcript を保存するためのものではありません。

### Settings

General settings は auto-scroll、title generation、usage indicators、debug logging、locale、tabs、どの provider が settings view を所有するかを扱います。Per-provider tabs は CLI paths、model behavior、commands、agents、skills、provider-owned config を扱います。Project workspace environment variables も provider ごとに scoped して設定できます。

## Grimoire がデータを置く場所

| Path | 内容 |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings と provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Plan meter 用の Claude usage snapshot |
| `.grimoire/grok/` | Grok Build launch artifacts、managed config、session pointers |

Provider-native files under `.claude/`, `.codex/`, `.opencode/`, and `.grimoire/grok/` はその場で読み書きされるため、provider setup は Grimoire の外でも portable なままです。

## Privacy

Grimoire は Obsidian の中で、あなたのマシン上で動作します。Backend はなく、telemetry を追加せず、prompts、answers、notes、files、tool output、API keys、usage logs を Grimoire service にアップロードしません。書き込む logs は上記の optional sanitized debug logs だけで、それも vault 内に残ります。

Grimoire が隠せないものは provider 自体です。有効化した CLI は prompt、選択した context、request に必要な files、images、tool output、commands を受け取ります。その CLI は Anthropic、OpenAI、Google、設定済みの OpenCode vendors、MCP servers、またはあなたが設定した他の接続先と通信する可能性があります。Terms、retention、billing、rate limits、privacy policies は provider のものであり、Grimoire のものではありません。Grimoire の役割は、その境界を Obsidian の中で見えるようにし、あなたが制御できるようにすることです。

Obsidian のポリシーに基づいたネットワーク利用、アカウント要件、外部ファイルアクセス、ログ、telemetry の概要については、[DISCLOSURES.md](../DISCLOSURES.md) を参照してください。

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

Meaningful な UI/provider changes を publish または push する前に、full local gate を実行してください。

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` は generated `main.js`、root `styles.css`、`dist/grimoire` を更新します。

npm は development、CI、releases の canonical package manager です。dependencies を変更したら `package-lock.json` を最新に保ってください。secondary package-manager lockfiles は意図的に commit しません。

## Releases

Grimoire releases は `1.0.0` のような semver tags から publish されます。Release workflow は local gate を実行し、Obsidian bundle を build し、tag が `package.json` と `manifest.json` に一致することを検証し、`main.js`、`manifest.json`、`styles.css` を GitHub Release に attach します。

Obsidian Community plugins が推奨されるユーザー向けインストール方法です。GitHub Releases には、manual install と BRAT 向けの bundle assets を引き続き添付します。`main` を releasable development に使い、manifest version と一致する tag で publish します。

## Roadmap

現在 Grimoire は Claude Code、Codex、Antigravity CLI、Gemini CLI (Legacy)、OpenCode、MiMoCode、Kimi Code、Grok Build とともに ship されています。

次の候補は Qwen Code、GitHub Copilot CLI、その他の ACP-compatible providers、そして runtime が Obsidian に embed できるほど安定した local model CLIs です。Implementation notes は [docs/provider-roadmap.md](../provider-roadmap.md) にあります。

## License

MIT。詳しくは [LICENSE](../../LICENSE) を参照してください。
