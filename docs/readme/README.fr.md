# Grimoire

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Logo Grimoire" width="240">
</p>

<p align="center">
  <strong>Agents IA local-first pour votre vault Obsidian.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licence : MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="Dernière release">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="Desktop uniquement">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Panneau latéral Grimoire à côté d'une note Obsidian" width="100%">
</p>

<p align="center">
  <sub>Discutez avec des agents CLI locaux dans le même workspace Obsidian que vos notes.</sub>
</p>

Grimoire amène les assistants CLI agentiques dans Obsidian. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) et OpenCode vivent dans un même panneau latéral : ils lisent vos notes, modifient des fichiers, lancent des commandes, appellent des tools et gardent l'historique des sessions contre votre vrai vault. Rien ne passe par un serveur Grimoire. Il n'y a pas de telemetry, pas de hosted backend et pas de proxy entre vous et votre provider.

Grimoire est conçu pour les personnes qui travaillent déjà dans Obsidian et veulent une aide IA qui ressemble à une partie du vault : contexte local, fichiers locaux, provider choisi volontairement, et usage/cost visibles dans l'interface.

> Le [README](../../README.md) anglais reste le document canonical du projet. Cette version française est synchronisée avec la documentation de `1.0.10`.

## Pourquoi Grimoire

- Utilisez les CLI agents auxquels vous faites déjà confiance, directement dans vos notes.
- Changez de provider depuis le composer. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) et OpenCode partagent un model picker.
- Ancrez chaque turn dans votre vault. Mentionnez des notes, des dossiers et des MCP tools au lieu de coller des chemins à la main.
- Voyez cost et limits à côté du sélecteur de modèle, là où vous prenez la décision.
- Restez local-first. Grimoire ne collecte pas de telemetry, ne proxy pas vos prompts et ne lance pas de backend.

## Ce que chaque provider peut faire

| Capability | Claude Code | Codex | Antigravity CLI | Gemini CLI (Legacy) | OpenCode |
| --- | --- | --- | --- | --- | --- |
| Local persistent runtime | Oui | Oui | Non | Oui | Oui |
| Native history hydration | Oui | Oui | Non | Oui | Oui |
| Plan mode | Oui | Oui | Non | Oui | Oui |
| Image attachments | Oui | Oui | Non | Oui | Oui |
| Instruction mode | Oui | Oui | Non | Oui | Oui |
| Reasoning effort controls | Oui | Oui | Oui | Oui | Oui |
| Rewind | Oui | Non | Non | Non | Non |
| Fork | Oui | Oui | Non | Non | Non |
| Provider slash commands | Oui | Non | Non | Non | Oui |
| Grimoire-managed MCP UI | Oui | Non | Non | Non | Non |

## Installation

Grimoire est un plugin desktop. Il pilote vos provider CLIs localement, donc il n'y a pas de mobile build.

### Avec BRAT

BRAT peut installer Grimoire depuis GitHub Releases et le maintenir à jour via les tagged builds :

1. Installez le plugin "Obsidian42 - BRAT".
2. Dans BRAT, ajoutez un beta plugin depuis `sandsaber/Grimoire`.
3. Activez Grimoire.

### Depuis GitHub Releases

Si vous n'utilisez pas BRAT, installez la release actuelle manuellement :

1. Téléchargez `main.js`, `manifest.json` et `styles.css` depuis la dernière [release Grimoire](https://github.com/sandsaber/Grimoire/releases/latest).
2. Créez `/path/to/your/vault/.obsidian/plugins/grimoire`.
3. Placez les trois fichiers dans ce dossier.
4. Activez Grimoire dans Settings, Community plugins.

### Depuis Community plugins (en cours)

Quand Grimoire sera listé dans l'annuaire des community plugins Obsidian :

1. Ouvrez Settings, allez dans Community plugins et désactivez Restricted mode s'il est actif.
2. Cliquez Browse, cherchez Grimoire et installez-le.
3. Activez Grimoire, puis ouvrez son panneau depuis le ribbon ou la command palette.

### Depuis les sources

Construisez le release bundle et placez-le dans votre vault :

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

Activez ensuite Grimoire depuis Settings, Community plugins.

Quel que soit le chemin choisi, installez au moins un CLI provider avant de commencer. Grimoire enveloppe les provider CLIs ; il ne remplace pas leur account setup, model access, quotas ou terms.

## Configurer un provider

Activez les providers voulus dans Settings, Grimoire, Providers, et ils apparaîtront dans le model selector. Codex est activé au premier lancement ; les autres providers sont opt-in.

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Settings Grimoire avec provider toggles, tabs et appearance themes" width="100%">
</p>

### Claude Code

Choisissez Claude Code si vous voulez sa native project memory, ses slash commands, sa MCP configuration, ses plans, rewind/fork, avec votre Claude subscription ou API key.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Authentifiez-vous via Claude Code, puis activez-le dans Grimoire.

- [Claude Code getting started](https://code.claude.com/docs/en/getting-started)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

Dans Grimoire, Claude Code lit et préserve vos fichiers `.claude/`, tourne sur le Claude Code SDK et prend en charge slash commands, MCP settings, agents, skills, plans, rewind et fork. Quand Claude rapporte les deux, vous verrez les quota windows et l'API spend côte à côte.

### Codex

Codex est le provider par défaut au premier lancement. Choisissez-le pour OpenAI Codex dans un CLI local, connecté avec votre ChatGPT plan ou une API key.

```bash
npm install -g @openai/codex
codex
```

Vous pouvez aussi l'installer via l'installateur officiel Codex ou Homebrew. Lancez-le une fois, connectez-vous, puis activez-le dans Grimoire.

- [Codex CLI README](https://github.com/openai/codex/blob/main/README.md)
- [Codex getting started](https://github.com/openai/codex/blob/main/docs/getting-started.md)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

Dans Grimoire, Codex tourne sur son app-server protocol avec native history, fork, plan mode, image input et reasoning effort controls. Plan usage apparaît quand Codex rapporte rate-limit metadata.

### Antigravity CLI

Antigravity CLI est le remplacement officiel de Gemini CLI par Google. Choisissez-le comme multi-model agent CLI de Google, avec Gemini, Claude, GPT-OSS et les autres familles de modèles accessibles à votre Antigravity account.

```bash
agy
```

Installez la CLI Antigravity officielle de Google, authentifiez-la localement, puis activez Antigravity dans Grimoire. Grimoire détecte automatiquement `agy` depuis PATH, ou vous pouvez définir un custom CLI path dans les provider settings.

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

Dans Grimoire, Antigravity est le Google provider recommandé. Il fonctionne via `agy --print`, avec une model selection optionnelle depuis `agy models`. Persistent sessions, native history, images, plan mode et auxiliary workflows restent désactivés jusqu'à ce qu'Antigravity expose une runtime surface compatible.

### Gemini CLI (Legacy)

Gemini CLI reste un legacy provider pour Gemini Code Assist Standard, Enterprise, Google Cloud et les paid API-key users lorsque Google continue de servir Gemini CLI requests. Les comptes consumer Google AI Pro, Ultra et free-tier doivent utiliser Antigravity apres le June 18, 2026.

```bash
gemini
```

Activez Gemini CLI uniquement si votre account tier est encore pris en charge. Grimoire le lance via `gemini --acp` et le marque comme legacy pour eviter toute confusion avec le Google provider recommande.

### OpenCode

Choisissez OpenCode pour un agent model-agnostic avec sa propre provider configuration.

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash
opencode
```

Homebrew et Go installs fonctionnent aussi. Configurez vos provider credentials dans OpenCode, puis activez-le dans Grimoire.

- [OpenCode GitHub repository](https://github.com/opencode-ai/opencode)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

Dans Grimoire, OpenCode tourne via ACP avec des Grimoire-managed launch artifacts, plus persistent runtime, native history, plan mode, image input, provider commands et reasoning effort. Il rapporte monthly spend lorsque cost metadata est disponible.

## Votre premier chat

1. Choisissez un provider et un model dans le composer.
2. Réglez reasoning effort et permission mode.
3. Mentionnez les notes, dossiers ou context que vous voulez inclure dans le scope.
4. Envoyez le turn.
5. Regardez les tool calls, usage et output arriver dans le panneau.

## Fonctionnalités

### Chat workspace

Un panneau latéral concentré avec plusieurs tabs. Chaque tab garde son draft, provider, model, context et runtime. Fermez et rouvrez Obsidian : vos sessions reviennent, avec provider, model et reasoning effort préservés sur chaque response. Rewind et fork apparaissent quand le provider actif les prend en charge. Auto-scroll se retire dès que vous scrollez pour lire.

### Model selector

Un picker unique, groupé par provider et trié par label : Antigravity, Claude Code, Codex, Gemini CLI (Legacy), OpenCode. Search traverse labels, descriptions, groups et model IDs. Les catalogs chargent lazily et mémorisent les groups que vous avez repliés. Ajoutez custom aliases et context-window overrides dans settings. Les variants 1M de Claude sont des options supplémentaires, pas des remplacements des base models.

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Model selector Grimoire avec provider groups, search et plan usage" width="100%">
</p>

### Usage et cost

Un badge près du model selector garde l'usage du provider actif visible. Le model menu contient des readouts plus complets : quota windows quand un provider les expose, spend quand seul cost est disponible. Les dernières bonnes valeurs restent affichées pendant un refresh ou un échec, donc le meter ne disparaît pas brusquement. Vous pouvez tout désactiver dans settings si vous voulez une interface plus silencieuse.

| Provider | Source de l'usage |
| --- | --- |
| Claude Code | SDK rate-limit events, `.grimoire/claude/statusline-usage.json` optionnel et SDK result cost metadata |
| Codex | Account rate-limit notifications et `account/rateLimits/read` quand disponible |
| Antigravity CLI | Pas encore disponible depuis `agy --print` |
| Gemini CLI (Legacy) | ACP cost metadata quand Gemini CLI le signale |
| OpenCode | Monthly spend agrégé depuis ACP et session cost metadata |

### Context et mentions

Mentionnez des vault notes et folders directement depuis le composer, ajoutez la current ou linked note, et configurez des persistent external context paths dans settings. Collez ou déposez des images quand le provider accepte image input. Mentionnez des MCP servers là où l'integration provider le permet.

### Inline editing

Lancez "Grimoire: Inline edit" sur une sélection. Un prompt s'ouvre près du texte, l'edit revient sous forme de diff à accept ou reject, et passe par le provider-backed inline edit service. Il gère le remplacement d'une sélection et l'insertion de nouveau texte.

### Commands

Les built-in commands couvrent les workflows Grimoire comme image generation et resume. Les providers qui exposent leurs propres commands, comme Claude Code slash commands et OpenCode runtime commands, les affichent via provider-owned catalogs. Masquez celles que vous n'utilisez pas dans settings.

### Image generation

Collez ou déposez des images pour les attacher. La command built-in `/image [prompt]` n'appelle aucune image API directement. Elle envoie un turn normal au provider actif avec l'instruction d'utiliser ce que vous avez configuré pour image generation : provider-native tooling, MCP tools ou local command. L'agent sauvegarde le résultat dans votre vault et renvoie un embed comme `![[path/to/image.png]]`. Si rien n'est configuré, vous obtenez une réponse simple expliquant ce qui manque.

### Safety et permissions

Permission modes appartiennent au provider, donc Grimoire les expose via shared composer controls au lieu de les réinventer. Safe mode et permission prompts restent visibles pendant le travail. Bang-bash mode n'apparaît que si un provider enabled le propose. Traitez configured MCP servers, shell access et API keys comme sensitive, parce qu'ils le sont.

### Debug logging

Désactivé par défaut. Si vous l'activez, Grimoire écrit du JSONL sanitized dans `.grimoire/logs/YYYY-MM-DD.jsonl`, avec prompts, answers, note contents, paths, environment values et secrets redacted. C'est destiné à diagnostiquer provider/runtime issues, pas à conserver un transcript.

### Settings

General settings couvre auto-scroll, title generation, usage indicators, debug logging, locale, tabs et le provider qui possède la settings view. Les per-provider tabs gèrent CLI paths, model behavior, commands, agents, skills et provider-owned config quand elle existe. Vous pouvez aussi définir des project workspace environment variables, scoped per provider.

## Où Grimoire garde vos données

| Path | Contenu |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings plus provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Claude usage snapshot pour le plan meter |

Les provider-native files sous `.claude/`, `.codex/` et `.opencode/` sont lus et écrits sur place, donc votre provider setup reste portable hors de Grimoire.

## Privacy

Grimoire tourne dans Obsidian, sur votre machine. Il n'a pas de backend, n'ajoute pas de telemetry et n'upload jamais vos prompts, answers, notes, files, tool output, API keys ou usage logs vers un service Grimoire. Les seuls logs qu'il écrit sont les optional sanitized debug logs ci-dessus, et ils restent dans votre vault.

Ce que Grimoire ne peut pas cacher, c'est le provider lui-même. Le CLI que vous activez reçoit le prompt, le context sélectionné, ainsi que les files, images, tool output et commands nécessaires à une request. Ce CLI peut ensuite parler à Anthropic, OpenAI, Google, vos OpenCode vendors configurés, MCP servers ou tout autre endpoint que vous avez configuré. Terms, retention, billing, rate limits et privacy policies sont ceux du provider, pas ceux de Grimoire. Le rôle de Grimoire est de rendre cette frontière visible et contrôlable dans Obsidian.

Pour un résumé orienté politique Obsidian de l'utilisation réseau, des exigences de compte, de l'accès aux fichiers externes, du logging et de la telemetry, consultez [DISCLOSURES.md](../DISCLOSURES.md).

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

Avant de publier ou de push des changements UI/provider significatifs, lancez le full local gate :

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` rafraîchit le generated `main.js`, le root `styles.css` et `dist/grimoire`.

npm est le canonical package manager pour development, CI et releases. Gardez `package-lock.json` à jour lorsque les dependencies changent ; les secondary package-manager lockfiles ne sont volontairement pas commit.

## Releases

Les releases Grimoire sont publiées depuis des semver tags comme `1.0.0`. Le release workflow lance le local gate, build l'Obsidian bundle, vérifie que le tag correspond à `package.json` et `manifest.json`, puis attache `main.js`, `manifest.json` et `styles.css` à la GitHub Release.

Obsidian et BRAT consomment directement ces release assets. Utilisez `main` pour le releasable development, puis publiez avec un tag qui correspond à la version du manifest.

## Roadmap

Aujourd'hui, Grimoire est livré avec Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) et OpenCode.

Prochainement : Qwen Code, GitHub Copilot CLI, d'autres ACP-compatible providers et des local model CLIs dès que leur runtime sera assez stable pour être intégré dans Obsidian. Les implementation notes vivent dans [docs/provider-roadmap.md](../provider-roadmap.md).

## Licence

MIT. Voir [LICENSE](../../LICENSE).
