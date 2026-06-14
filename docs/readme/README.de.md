# Grimoire

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Grimoire-Logo" width="240">
</p>

<p align="center">
  <strong>Local-first AI-Agents für deinen Obsidian vault.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Lizenz: MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="Aktuelles Release">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="Nur Desktop">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Grimoire-Seitenleiste neben einer Obsidian-Notiz" width="100%">
</p>

<p align="center">
  <sub>Arbeite mit lokalen CLI-Agents im selben Obsidian workspace, in dem deine Notizen leben.</sub>
</p>

Grimoire bringt agentic CLI-Assistenten direkt nach Obsidian. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) und OpenCode laufen in einer gemeinsamen Seitenleiste: Sie lesen Notizen, bearbeiten Dateien, führen Befehle aus, rufen Tools auf und behalten session history im Kontext deines echten vault. Nichts läuft über einen Grimoire-Server. Es gibt keine telemetry, kein hosted backend und keinen proxy zwischen dir und deinem provider.

Grimoire ist für Menschen gebaut, die bereits in Obsidian arbeiten und AI-Hilfe wollen, die sich wie ein Teil des vault anfühlt: lokaler context, lokale files, bewusst gewählte provider und sichtbare usage/cost direkt im UI.

> Das englische [README](../../README.md) ist das canonical document des Projekts. Diese deutsche Version ist mit der Dokumentation fuer `1.0.11` synchronisiert.

## Warum Grimoire

- Nutze die CLI-Agents, denen du bereits vertraust, direkt in deinen Notizen.
- Wechsle provider im composer. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) und OpenCode teilen sich einen model picker.
- Grounde jeden turn in deinem vault. Erwähne Notizen, Ordner und MCP tools, statt paths per Hand zu kopieren.
- Sieh cost und limits direkt neben der model-Auswahl.
- Bleib local-first. Grimoire sammelt keine telemetry, proxyed keine prompts und betreibt kein backend.

## Was die provider können

| Capability | Claude Code | Codex | Antigravity CLI | Gemini CLI (Legacy) | OpenCode |
| --- | --- | --- | --- | --- | --- |
| Local persistent runtime | Ja | Ja | Nein | Ja | Ja |
| Native history hydration | Ja | Ja | Nein | Ja | Ja |
| Plan mode | Ja | Ja | Nein | Ja | Ja |
| Image attachments | Ja | Ja | Nein | Ja | Ja |
| Instruction mode | Ja | Ja | Nein | Ja | Ja |
| Reasoning effort controls | Ja | Ja | Ja | Ja | Ja |
| Rewind | Ja | Nein | Nein | Nein | Nein |
| Fork | Ja | Ja | Nein | Nein | Nein |
| Provider slash commands | Ja | Nein | Nein | Nein | Ja |
| Grimoire-managed MCP UI | Ja | Nein | Nein | Nein | Nein |

## Installation

Grimoire ist ein Desktop-Plugin. Es steuert deine provider CLIs lokal, daher gibt es keinen mobile build.

### Über Community plugins (empfohlen)

Installiere Grimoire aus dem Obsidian community plugin directory:

1. Öffne Settings, gehe zu Community plugins und deaktiviere Restricted mode, falls er aktiv ist.
2. Klicke Browse, suche Grimoire und installiere es.
3. Aktiviere Grimoire und öffne das Panel über ribbon oder command palette.

### Aus GitHub Releases

Wenn du Community plugins nicht nutzen kannst, kannst du das aktuelle Release manuell installieren:

1. Lade `main.js`, `manifest.json` und `styles.css` aus dem neuesten [Grimoire release](https://github.com/sandsaber/Grimoire/releases/latest) herunter.
2. Erstelle `/path/to/your/vault/.obsidian/plugins/grimoire`.
3. Lege alle drei Dateien in diesen Ordner.
4. Aktiviere Grimoire in Settings, Community plugins.

### Mit BRAT

BRAT kann Grimoire aus GitHub Releases installieren, wenn du tagged builds außerhalb des community directory verfolgen möchtest:

1. Installiere das Plugin "Obsidian42 - BRAT".
2. Füge in BRAT ein beta plugin aus `sandsaber/Grimoire` hinzu.
3. Aktiviere Grimoire.

### Aus dem Source

Baue das release bundle und lege es in deinen vault:

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

Aktiviere danach Grimoire in Settings, Community plugins.

Egal welchen Weg du wählst: Installiere zuerst mindestens einen CLI provider. Grimoire umhüllt provider CLIs, ersetzt aber nicht deren account setup, model access, quotas oder terms.

## Provider einrichten

Aktiviere die gewünschten providers unter Settings, Grimoire, Providers. Danach erscheinen sie im model selector. Codex ist beim ersten Start aktiviert; alle anderen providers sind opt-in.

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Grimoire settings mit provider toggles, tabs und appearance themes" width="100%">
</p>

### Claude Code

Wähle Claude Code, wenn du native project memory, slash commands, MCP configuration, plans, rewind/fork und Arbeit über Claude subscription oder API key möchtest.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Authentifiziere dich über Claude Code und aktiviere es danach in Grimoire.

- [Claude Code getting started](https://code.claude.com/docs/en/getting-started)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

In Grimoire liest und bewahrt Claude Code deine `.claude/` files, läuft auf dem Claude Code SDK und unterstützt slash commands, MCP settings, agents, skills, plans, rewind und fork. Wenn Claude beides meldet, siehst du quota windows und API spend nebeneinander.

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

Codex ist beim ersten Start der default provider. Wähle ihn für OpenAI Codex in einem lokalen CLI, angemeldet über deinen ChatGPT plan oder einen API key.

```bash
npm install -g @openai/codex
codex
```

Du kannst Codex auch über den offiziellen installer oder Homebrew installieren. Starte es einmal, melde dich an und aktiviere es dann in Grimoire.

- [Codex CLI README](https://github.com/openai/codex/blob/main/README.md)
- [Codex getting started](https://github.com/openai/codex/blob/main/docs/getting-started.md)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

In Grimoire läuft Codex über sein app-server protocol mit native history, fork, plan mode, image input und reasoning effort controls. Plan usage erscheint, wenn Codex rate-limit metadata meldet.

### Antigravity CLI

Antigravity CLI ist Googles empfohlener Ersatz für Consumer-Nutzung von Gemini CLI. Wähle es als Googles multi-model agent CLI, einschließlich Gemini, Claude, GPT-OSS und weiterer Modellfamilien, auf die dein Antigravity account Zugriff hat.

```bash
agy
```

Installiere die offizielle Antigravity CLI von Google, authentifiziere sie lokal und aktiviere danach Antigravity in Grimoire. Grimoire erkennt `agy` automatisch aus PATH, oder du setzt einen custom CLI path in den provider settings.

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

In Grimoire ist Antigravity der empfohlene Google provider. Es läuft über `agy --print`, mit optionaler model selection aus `agy models`. Persistent sessions, native history, images, plan mode und auxiliary workflows bleiben deaktiviert, bis Antigravity dafür eine kompatible runtime surface bereitstellt.

### Gemini CLI (Legacy)

Gemini CLI bleibt ein legacy provider fuer Gemini Code Assist Standard, Enterprise, Google Cloud und paid API-key users, wenn Google Gemini CLI requests weiter bedient. Consumer Google AI Pro, Ultra und free-tier accounts sollten nach June 18, 2026 Antigravity verwenden.

```bash
gemini
```

Aktiviere Gemini CLI nur, wenn dein account tier weiterhin unterstuetzt wird. Grimoire startet es ueber `gemini --acp`, fuegt active note, editor/browser/canvas selection, vault search und project workspace context in den ACP prompt ein und markiert es als legacy, damit es nicht wie der empfohlene Google provider wirkt.

### OpenCode

Wähle OpenCode, wenn du einen model-agnostic agent mit eigener provider configuration möchtest.

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash
opencode
```

Homebrew und Go installs funktionieren ebenfalls. Konfiguriere deine provider credentials in OpenCode und aktiviere es danach in Grimoire.

- [OpenCode GitHub repository](https://github.com/opencode-ai/opencode)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

In Grimoire läuft OpenCode über ACP mit Grimoire-managed launch artifacts sowie persistent runtime, native history, plan mode, image input, provider commands und reasoning effort. Monthly spend wird angezeigt, wenn cost metadata verfügbar ist.

## Dein erster Chat

1. Wähle provider und model im composer.
2. Setze reasoning effort und permission mode.
3. Erwähne notes, folders oder context, die im scope sein sollen.
4. Sende den turn.
5. Beobachte tool calls, usage und output im panel.

## Features

### Chat workspace

Eine fokussierte Seitenleiste mit mehreren tabs. Jeder tab behält eigenen draft, provider, model, context und runtime. Wenn du Obsidian schließt und wieder öffnest, kommen deine sessions zurück; provider, model und reasoning effort bleiben bei jeder response erhalten. Rewind und fork erscheinen, wenn der aktive provider sie unterstützt. Auto-scroll hält an, sobald du selbst zurückscrollst, um etwas zu lesen.

### Model selector

Ein picker, gruppiert nach provider und nach label sortiert: Antigravity, Claude Code, Codex, Gemini CLI (Legacy), OpenCode. Search läuft über labels, descriptions, groups und model IDs. Catalogs laden lazily und merken sich collapsed groups. In settings kannst du custom aliases und context-window overrides hinzufügen. Claude 1M variants sind zusätzliche options, keine Ersetzungen für base models.

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Grimoire model selector mit provider groups, search und plan usage" width="100%">
</p>

### Usage und cost

Ein badge neben dem model selector hält die usage des aktiven provider sichtbar. Im model menu gibt es ausführlichere readouts: quota windows, wenn der provider sie anbietet, und spend, wenn nur cost verfügbar ist. Während refresh läuft oder fehlschlägt, bleibt der letzte gute Wert stehen, sodass der meter nicht plötzlich verschwindet. Wenn du ein ruhigeres UI willst, kannst du alles in settings abschalten.

| Provider | Woher usage kommt |
| --- | --- |
| Claude Code | SDK rate-limit events, optional `.grimoire/claude/statusline-usage.json` und SDK result cost metadata |
| Codex | Account rate-limit notifications und `account/rateLimits/read`, wenn verfügbar |
| Antigravity CLI | Noch nicht über `agy --print` verfügbar |
| Gemini CLI (Legacy) | ACP cost metadata, wenn Gemini CLI sie meldet |
| OpenCode | Monthly spend aggregiert aus ACP und session cost metadata |

### Context und mentions

Erwähne vault notes und folders direkt aus dem composer, ziehe current oder linked note heran und füge persistent external context paths in settings hinzu. Füge Bilder per paste oder drop hinzu, wenn der provider image input unterstützt. MCP servers lassen sich dort mentionen, wo die provider integration es unterstützt.

### Inline editing

Führe "Grimoire: Inline edit" auf einer Auswahl aus. Neben dem Text öffnet sich ein prompt, die Änderung kommt als diff zurück, den du accept oder reject kannst, und sie läuft über den provider-backed inline edit service. Es unterstützt sowohl das Ersetzen einer selection als auch das Einfügen neuen Texts.

### Commands

Built-in commands decken Grimoire workflows wie image generation und resume ab. Providers, die eigene commands anbieten, etwa Claude Code slash commands und OpenCode runtime commands, zeigen sie über provider-owned catalogs. Nicht genutzte commands kannst du in settings ausblenden.

### Image generation

Füge Bilder per paste oder drop als attachments hinzu. Der built-in command `/image [prompt]` ruft selbst keine image API auf. Er sendet einen normalen turn an den aktiven provider mit der Anweisung, deine konfigurierte image generation zu nutzen: provider-native tooling, MCP tools oder local command. Der agent speichert das Ergebnis in deinem vault und gibt ein embed wie `![[path/to/image.png]]` zurück. Wenn image generation nicht eingerichtet ist, bekommst du eine normale Antwort, die erklärt, was fehlt.

### Safety und permissions

Permission modes gehören zum provider. Grimoire zeigt sie daher über shared composer controls, statt sie neu zu erfinden. Safe mode und permission prompts bleiben während der Arbeit sichtbar. Bang-bash mode erscheint nur, wenn ein enabled provider ihn anbietet. Behandle configured MCP servers, shell access und API keys als sensitive, denn sie sind es.

### Debug logging

Standardmäßig aus. Wenn aktiviert, schreibt Grimoire sanitized JSONL nach `.grimoire/logs/YYYY-MM-DD.jsonl`; prompts, answers, note contents, paths, environment values und secrets werden redacted. Das ist für Diagnose von provider/runtime issues gedacht, nicht als transcript.

### Settings

General settings decken auto-scroll, title generation, usage indicators, debug logging, locale, tabs und den provider ab, der die settings view besitzt. Per-provider tabs kümmern sich um CLI paths, model behavior, commands, agents, skills und provider-owned config, sofern vorhanden. Du kannst auch project workspace environment variables setzen, scoped per provider.

## Wo Grimoire Daten speichert

| Path | Inhalt |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings plus provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Claude usage snapshot für den plan meter |

Provider-native files unter `.claude/`, `.codex/` und `.opencode/` werden direkt gelesen und geschrieben, sodass dein provider setup außerhalb von Grimoire portabel bleibt.

## Privacy

Grimoire läuft in Obsidian, auf deinem Rechner. Es hat kein backend, fügt keine telemetry hinzu und lädt keine prompts, answers, notes, files, tool output, API keys oder usage logs zu einem Grimoire service hoch. Die einzigen logs sind die optionalen sanitized debug logs oben, und sie bleiben in deinem vault.

Was Grimoire nicht verstecken kann, ist der provider selbst. Das CLI, das du aktivierst, erhält prompt, gewählten context und die files, images, tool output und commands, die ein request braucht. Dieses CLI kann mit Anthropic, OpenAI, Google, deinen konfigurierten OpenCode vendors, MCP servers oder anderen eingerichteten Zielen sprechen. Terms, retention, billing, rate limits und privacy policies gehören zum provider, nicht zu Grimoire. Grimoire macht diese Grenze in Obsidian sichtbar und kontrollierbar.

Für eine Obsidian-policy-orientierte Zusammenfassung von Netzwerknutzung, Account-Anforderungen, externem Dateizugriff, Logging und Telemetry siehe [DISCLOSURES.md](../DISCLOSURES.md).

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

Vor dem Veröffentlichen oder Pushen wichtiger UI/provider changes solltest du das vollständige local gate ausführen:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` aktualisiert generated `main.js`, root `styles.css` und `dist/grimoire`.

npm ist der canonical package manager für development, CI und releases. Halte `package-lock.json` aktuell, wenn dependencies geändert werden; secondary package-manager lockfiles werden absichtlich nicht committed.

## Releases

Grimoire releases werden aus semver tags wie `1.0.0` veröffentlicht. Der release workflow führt das local gate aus, baut das Obsidian bundle, prüft, dass der tag zu `package.json` und `manifest.json` passt, und hängt `main.js`, `manifest.json` und `styles.css` an das GitHub Release.

Obsidian Community plugins sind der empfohlene Installationsweg für Nutzer. GitHub Releases enthalten weiterhin die bundle assets für manuelle Installationen und BRAT. Verwende `main` für releasable development und veröffentliche dann per tag, der zur manifest version passt.

## Roadmap

Aktuell wird Grimoire mit Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) und OpenCode ausgeliefert.

Als Nächstes: Qwen Code, GitHub Copilot CLI, weitere ACP-compatible providers und local model CLIs, sobald deren runtime stabil genug ist, um in Obsidian eingebettet zu werden. Implementation notes stehen in [docs/provider-roadmap.md](../provider-roadmap.md).

## Lizenz

MIT. Siehe [LICENSE](../../LICENSE).
