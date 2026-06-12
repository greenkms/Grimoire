# Grimoire

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Логотип Grimoire" width="240">
</p>

<p align="center">
  <strong>Локальные AI-агенты для вашего Obsidian vault.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Лицензия: MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="Последний релиз">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="Только desktop">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Панель Grimoire рядом с заметкой Obsidian" width="100%">
</p>

<p align="center">
  <sub>Общайтесь с локальными CLI-агентами прямо в том же Obsidian workspace, где живут ваши заметки.</sub>
</p>

Grimoire встраивает agentic CLI-ассистентов в Obsidian. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) и OpenCode живут в одной боковой панели: читают заметки, редактируют файлы, запускают команды, вызывают инструменты и сохраняют историю сессий рядом с вашим настоящим vault. Всё работает без сервера Grimoire: нет telemetry, hosted backend и proxy между вами и провайдером.

Grimoire сделан для тех, кто уже работает в Obsidian и хочет, чтобы AI-помощник ощущался частью vault: локальный контекст, локальные файлы, осознанный выбор провайдера и usage/cost прямо в интерфейсе.

> Английский [README](../../README.md) остаётся canonical-документом проекта. Эта русская версия синхронизирована с документацией `1.0.10`.

## Зачем Grimoire

- Используйте CLI-агентов, которым уже доверяете, прямо внутри заметок.
- Переключайте провайдеров из composer. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) и OpenCode используют один model picker.
- Привязывайте каждый turn к vault-контексту. Упоминайте заметки, папки и MCP tools без ручного копирования путей.
- Видьте cost и limits рядом с выбором модели, именно там, где принимается решение.
- Оставайтесь local-first. Grimoire не собирает telemetry, не проксирует prompts и не запускает backend.

## Что умеют провайдеры

| Возможность | Claude Code | Codex | Antigravity CLI | Gemini CLI (Legacy) | OpenCode |
| --- | --- | --- | --- | --- | --- |
| Локальный persistent runtime | Да | Да | Нет | Да | Да |
| Нативное восстановление истории | Да | Да | Нет | Да | Да |
| Plan mode | Да | Да | Нет | Да | Да |
| Image attachments | Да | Да | Нет | Да | Да |
| Instruction mode | Да | Да | Нет | Да | Да |
| Reasoning effort controls | Да | Да | Да | Да | Да |
| Rewind | Да | Нет | Нет | Нет | Нет |
| Fork | Да | Да | Нет | Нет | Нет |
| Provider slash commands | Да | Нет | Нет | Нет | Да |
| Grimoire-managed MCP UI | Да | Нет | Нет | Нет | Нет |

## Установка

Grimoire — desktop plugin. Он запускает provider CLIs локально, поэтому mobile build нет.

### Через BRAT

BRAT может установить Grimoire из GitHub Releases и обновлять его по tagged builds:

1. Установите плагин "Obsidian42 - BRAT".
2. В BRAT добавьте beta plugin из `sandsaber/Grimoire`.
3. Включите Grimoire.

### Через GitHub Releases

Если вы не используете BRAT, установите текущий релиз вручную:

1. Скачайте `main.js`, `manifest.json` и `styles.css` из последнего [релиза Grimoire](https://github.com/sandsaber/Grimoire/releases/latest).
2. Создайте папку `/path/to/your/vault/.obsidian/plugins/grimoire`.
3. Положите все три файла в эту папку.
4. Включите Grimoire в Settings, Community plugins.

### Через Community plugins (в процессе)

Когда Grimoire появится в каталоге community plugins Obsidian:

1. Откройте Settings, перейдите в Community plugins и выключите Restricted mode, если он включён.
2. Нажмите Browse, найдите Grimoire и установите его.
3. Включите Grimoire, затем откройте панель через ribbon или command palette.

### Из исходников

Соберите release bundle и положите его в ваш vault:

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

После этого включите Grimoire в Settings, Community plugins.

Какой бы способ установки вы ни выбрали, сначала установите хотя бы один CLI provider. Grimoire оборачивает provider CLIs, но не заменяет их account setup, model access, quotas или terms.

## Настройка провайдера

Включите нужных провайдеров в Settings, Grimoire, Providers, и они появятся в model selector. Codex включён при первом запуске; остальные провайдеры opt-in.

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Настройки Grimoire с provider toggles, tabs и appearance themes" width="100%">
</p>

### Claude Code

Выбирайте Claude Code, если вам нужны native project memory, slash commands, MCP configuration, plans, rewind/fork и работа через Claude subscription или API key.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Авторизуйтесь через Claude Code, затем включите его в Grimoire.

- [Claude Code getting started](https://code.claude.com/docs/en/getting-started)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

Внутри Grimoire Claude Code читает и сохраняет ваши `.claude/` файлы, работает на Claude Code SDK и поддерживает slash commands, MCP settings, agents, skills, plans, rewind и fork. Если Claude отдаёт оба типа данных, вы увидите quota windows и API spend рядом.

### Codex

Codex — provider по умолчанию при первом запуске. Выбирайте его для OpenAI Codex в локальном CLI, авторизованном через ChatGPT plan или API key.

```bash
npm install -g @openai/codex
codex
```

Также можно установить Codex через официальный installer или Homebrew. Запустите его один раз, войдите в аккаунт, затем включите в Grimoire.

- [Codex CLI README](https://github.com/openai/codex/blob/main/README.md)
- [Codex getting started](https://github.com/openai/codex/blob/main/docs/getting-started.md)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

Внутри Grimoire Codex работает по app-server protocol с native history, fork, plan mode, image input и reasoning effort controls. Plan usage появляется, когда Codex сообщает rate-limit metadata.

### Antigravity CLI

Antigravity CLI — рекомендуемая Google замена для consumer-сценариев Gemini CLI. Выбирайте его как новый Google provider для multi-model agent CLI: Gemini, Claude, GPT-OSS и других семейств моделей, доступных вашему Antigravity account.

```bash
agy
```

Установите официальный Antigravity CLI от Google, авторизуйтесь локально, затем включите Antigravity в Grimoire. Grimoire автоматически находит `agy` в PATH, но в provider settings можно указать custom CLI path.

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

Внутри Grimoire Antigravity — рекомендуемый Google provider. Он работает через `agy --print`, с optional model selection из `agy models`. Persistent sessions, native history, images, plan mode и auxiliary workflows остаются выключенными, пока Antigravity не предоставит совместимый runtime surface.

### Gemini CLI (Legacy)

Gemini CLI остается legacy provider для Gemini Code Assist Standard, Enterprise, Google Cloud и paid API-key users, где Google продолжает обслуживать Gemini CLI requests. Consumer Google AI Pro, Ultra и free-tier accounts после June 18, 2026 должны использовать Antigravity.

```bash
gemini
```

Включайте Gemini CLI только если ваш account tier еще поддерживается. Grimoire запускает его через `gemini --acp` и помечает как legacy, чтобы не путать с рекомендуемым Google provider.

### OpenCode

Выбирайте OpenCode, если нужен model-agnostic agent со своей provider configuration.

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash
opencode
```

Homebrew и Go installs тоже подходят. Настройте provider credentials в OpenCode, затем включите его в Grimoire.

- [OpenCode GitHub repository](https://github.com/opencode-ai/opencode)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

Внутри Grimoire OpenCode работает через ACP с Grimoire-managed launch artifacts, persistent runtime, native history, plan mode, image input, provider commands и reasoning effort. Он показывает monthly spend, когда cost metadata доступна.

## Первый чат

1. Выберите provider и model в composer.
2. Настройте reasoning effort и permission mode.
3. Упомяните заметки, папки или другой context, который должен быть в scope.
4. Отправьте turn.
5. Следите за tool calls, usage и ответом прямо в панели.

## Возможности

### Chat workspace

Фокусная боковая панель с несколькими tabs. У каждой tab свой draft, provider, model, context и runtime. Закройте и снова откройте Obsidian — сессии восстановятся, а provider, model и reasoning effort сохранятся на каждом ответе. Rewind и fork появляются, когда активный provider их поддерживает. Auto-scroll останавливается, когда вы прокручиваете историю вручную.

### Model selector

Один picker, сгруппированный по провайдерам и отсортированный по label: Antigravity, Claude Code, Codex, Gemini CLI (Legacy), OpenCode. Search работает по labels, descriptions, groups и model IDs. Catalogs загружаются lazily и запоминают, какие groups вы свернули. В settings можно добавить custom aliases и context-window overrides. Claude 1M variants — дополнительные options, а не замена базовых моделей.

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Model selector Grimoire с provider groups, search и plan usage" width="100%">
</p>

### Usage и cost

Badge рядом с model selector показывает usage активного provider; подробный readout находится внутри model menu: quota windows, если provider их отдаёт, и spend, если доступна только стоимость. Последние хорошие значения остаются на месте, пока refresh идёт или падает, поэтому meter не исчезает внезапно. Всё это можно выключить в settings, если хочется более тихий UI.

| Provider | Откуда берётся usage |
| --- | --- |
| Claude Code | SDK rate-limit events, optional `.grimoire/claude/statusline-usage.json` и SDK result cost metadata |
| Codex | Account rate-limit notifications и `account/rateLimits/read`, когда доступно |
| Antigravity CLI | Пока недоступно из `agy --print` |
| Gemini CLI (Legacy) | ACP cost metadata, если Gemini CLI её отдаёт |
| OpenCode | Monthly spend, агрегированный из ACP и session cost metadata |

### Context и mentions

Упоминайте vault notes и folders прямо из composer, подтягивайте current или linked note, добавляйте persistent external context paths в settings. Вставляйте или перетаскивайте изображения, если provider поддерживает image input. Упоминайте MCP servers там, где provider integration это поддерживает.

### Inline editing

Запустите "Grimoire: Inline edit" на выделенном тексте. Рядом с текстом откроется prompt, edit вернётся как diff, который можно accept или reject, а сама операция пойдёт через provider-backed inline edit service. Работает и для замены выделения, и для вставки нового текста.

### Commands

Built-in commands покрывают workflows Grimoire, включая image generation и resume. Providers, которые отдают свои commands, например Claude Code slash commands и OpenCode runtime commands, показывают их через provider-owned catalogs. Ненужные команды можно скрыть в settings.

### Image generation

Вставляйте или перетаскивайте изображения, чтобы прикрепить их к turn. Built-in command `/image [prompt]` сам не вызывает image API. Он отправляет обычный turn активному provider с инструкцией использовать то, что вы настроили для image generation: provider-native tooling, MCP tools или local command. Agent сохраняет результат в vault и возвращает embed вроде `![[path/to/image.png]]`. Если image generation не настроена, вы получите обычный ответ с объяснением, чего не хватает.

### Safety и permissions

Permission modes принадлежат provider, поэтому Grimoire показывает их через shared composer controls, а не переизобретает. Safe mode и permission prompts остаются видимыми во время работы. Bang-bash mode появляется только если enabled provider его поддерживает. Относитесь к configured MCP servers, shell access и API keys как к sensitive данным, потому что они sensitive.

### Debug logging

По умолчанию выключен. Если включить, Grimoire пишет sanitized JSONL в `.grimoire/logs/YYYY-MM-DD.jsonl`: prompts, answers, note contents, paths, environment values и secrets редактируются. Это инструмент диагностики provider/runtime issues, а не transcript.

### Settings

General settings покрывают auto-scroll, title generation, usage indicators, debug logging, locale, tabs и то, какой provider владеет settings view. Per-provider tabs отвечают за CLI paths, model behavior, commands, agents, skills и provider-owned config, если она есть. Также можно задавать project workspace environment variables, scoped per provider.

## Где Grimoire хранит данные

| Path | Что там |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings и provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Claude usage snapshot для plan meter |

Provider-native файлы под `.claude/`, `.codex/` и `.opencode/` читаются и записываются на месте, поэтому ваша provider setup остаётся переносимой за пределы Grimoire.

## Privacy

Grimoire работает внутри Obsidian, на вашем компьютере. У него нет backend, telemetry и механизма загрузки prompts, answers, notes, files, tool output, API keys или usage logs в сервис Grimoire. Единственные logs, которые он пишет, — optional sanitized debug logs выше, и они остаются в вашем vault.

Что Grimoire не может скрыть — это сам provider. CLI, который вы включаете, получает prompt, выбранный context и files, images, tool output и commands, нужные для request. Этот CLI может обращаться к Anthropic, OpenAI, Google, configured OpenCode vendors, MCP servers или чему-то ещё, что вы настроили. Terms, retention, billing, rate limits и privacy policies принадлежат provider, а не Grimoire. Задача Grimoire — сделать эту границу видимой и управляемой внутри Obsidian.

Для ориентированного на политику Obsidian summary по использованию сети, требованиям к аккаунту, доступу к внешним файлам, логированию и telemetry см. [DISCLOSURES.md](../DISCLOSURES.md).

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

Перед публикацией или push значимых UI/provider изменений запускайте полный local gate:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` обновляет generated `main.js`, root `styles.css` и `dist/grimoire`.

npm — canonical package manager для development, CI и releases. При изменении dependencies поддерживайте `package-lock.json` в актуальном состоянии; secondary package-manager lockfiles намеренно не коммитятся.

## Releases

Релизы Grimoire публикуются из semver tags вроде `1.0.0`. Release workflow запускает local gate, собирает Obsidian bundle, проверяет, что tag совпадает с `package.json` и `manifest.json`, затем прикрепляет `main.js`, `manifest.json` и `styles.css` к GitHub Release.

Obsidian и BRAT используют эти release assets напрямую. Используйте `main` для releasable development, затем публикуйте релиз тегом, совпадающим с версией manifest.

## Roadmap

Сейчас Grimoire поставляется с Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) и OpenCode.

Следующие в списке: Qwen Code, GitHub Copilot CLI, другие ACP-compatible providers и local model CLIs, когда их runtime станет достаточно стабильным для embedding в Obsidian. Implementation notes находятся в [docs/provider-roadmap.md](../provider-roadmap.md).

## Лицензия

MIT. См. [LICENSE](../../LICENSE).
