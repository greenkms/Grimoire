# Grimoire

<p align="center">
  <img src="../../assets/readme/grimoire-logo.png" alt="Logotipo de Grimoire" width="240">
</p>

<p align="center">
  <strong>Agentes de IA local-first para tu vault de Obsidian.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licencia: MIT">
  <img src="https://img.shields.io/github/v/release/sandsaber/Grimoire?label=release" alt="Último release">
  <img src="https://img.shields.io/badge/Obsidian-1.7.2%2B-7c3aed" alt="Obsidian 1.7.2+">
  <img src="https://img.shields.io/badge/platform-desktop-lightgrey" alt="Solo desktop">
</p>

<p align="center">
  <img src="../../assets/readme/chat-workspace.png" alt="Panel lateral de Grimoire junto a una nota de Obsidian" width="100%">
</p>

<p align="center">
  <sub>Habla con agentes CLI locales en el mismo workspace de Obsidian donde viven tus notas.</sub>
</p>

Grimoire lleva asistentes CLI agentic a Obsidian. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) y OpenCode viven en un solo panel lateral: leen tus notas, editan archivos, ejecutan comandos, llaman tools y conservan session history contra tu vault real. Nada pasa por un servidor de Grimoire. No hay telemetry, hosted backend ni proxy entre tú y tu provider.

Está diseñado para quienes ya trabajan en Obsidian y quieren ayuda de IA que se sienta como parte del vault: contexto local, archivos locales, un provider elegido a propósito y usage/cost visibles dentro de la interfaz.

> El [README](../../README.md) en inglés es el canonical document del proyecto. Esta versión en español está sincronizada con la documentación de `1.0.11`.

## Por qué Grimoire

- Usa los CLI agents en los que ya confías, directamente dentro de tus notas.
- Cambia de provider desde el composer. Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) y OpenCode comparten un model picker.
- Ancla cada turn en tu vault. Menciona notas, carpetas y MCP tools sin pegar paths a mano.
- Ve cost y limits junto al selector de modelo, justo donde tomas la decisión.
- Mantén un flujo local-first. Grimoire no recopila telemetry, no proxifica prompts y no ejecuta un backend.

## Qué puede hacer cada provider

| Capability | Claude Code | Codex | Antigravity CLI | Gemini CLI (Legacy) | OpenCode |
| --- | --- | --- | --- | --- | --- |
| Local persistent runtime | Sí | Sí | No | Sí | Sí |
| Native history hydration | Sí | Sí | No | Sí | Sí |
| Plan mode | Sí | Sí | No | Sí | Sí |
| Image attachments | Sí | Sí | No | Sí | Sí |
| Instruction mode | Sí | Sí | No | Sí | Sí |
| Reasoning effort controls | Sí | Sí | Sí | Sí | Sí |
| Rewind | Sí | No | No | No | No |
| Fork | Sí | Sí | No | No | No |
| Provider slash commands | Sí | No | No | No | Sí |
| Grimoire-managed MCP UI | Sí | No | No | No | No |

## Instalación

Grimoire es un plugin desktop. Controla tus provider CLIs localmente, así que no hay mobile build.

### Con BRAT

BRAT puede instalar Grimoire desde GitHub Releases y mantenerlo actualizado con tagged builds:

1. Instala el plugin "Obsidian42 - BRAT".
2. En BRAT, añade un beta plugin desde `sandsaber/Grimoire`.
3. Activa Grimoire.

### Desde GitHub Releases

Si no usas BRAT, instala el release actual manualmente:

1. Descarga `main.js`, `manifest.json` y `styles.css` desde el último [Grimoire release](https://github.com/sandsaber/Grimoire/releases/latest).
2. Crea `/path/to/your/vault/.obsidian/plugins/grimoire`.
3. Coloca los tres archivos en esa carpeta.
4. Activa Grimoire desde Settings, Community plugins.

### Desde Community plugins (en progreso)

Cuando Grimoire aparezca en el directorio de community plugins de Obsidian:

1. Abre Settings, ve a Community plugins y desactiva Restricted mode si está activo.
2. Haz clic en Browse, busca Grimoire e instálalo.
3. Activa Grimoire y abre el panel desde el ribbon o la command palette.

### Desde el código fuente

Construye el release bundle y colócalo en tu vault:

```bash
npm install
npm run build:release

mkdir -p /path/to/your/vault/.obsidian/plugins/grimoire
cp dist/grimoire/main.js dist/grimoire/manifest.json dist/grimoire/styles.css \
  /path/to/your/vault/.obsidian/plugins/grimoire/
```

Después activa Grimoire desde Settings, Community plugins.

Elijas el camino que elijas, instala al menos un CLI provider antes de empezar. Grimoire envuelve provider CLIs, pero no reemplaza su account setup, model access, quotas ni terms.

## Configurar un provider

Activa los providers que quieras en Settings, Grimoire, Providers, y aparecerán en el model selector. Codex está activado en el primer inicio; los demás providers son opt-in.

<p align="center">
  <img src="../../assets/readme/settings-providers.png" alt="Settings de Grimoire con provider toggles, tabs y appearance themes" width="100%">
</p>

### Claude Code

Elige Claude Code si quieres su native project memory, slash commands, MCP configuration, plans, rewind/fork y trabajo respaldado por tu Claude subscription o API key.

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Autentícate con Claude Code y luego actívalo en Grimoire.

- [Claude Code getting started](https://code.claude.com/docs/en/getting-started)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)

Dentro de Grimoire, Claude Code lee y conserva tus archivos `.claude/`, corre sobre Claude Code SDK y soporta slash commands, MCP settings, agents, skills, plans, rewind y fork. Cuando Claude reporta ambos datos, verás quota windows y API spend lado a lado.

### Codex

Codex es el provider por defecto en el primer inicio. Elígelo para OpenAI Codex en un CLI local, autenticado con tu ChatGPT plan o una API key.

```bash
npm install -g @openai/codex
codex
```

También puedes instalarlo con el instalador oficial de Codex o Homebrew. Ejecútalo una vez, inicia sesión y luego actívalo en Grimoire.

- [Codex CLI README](https://github.com/openai/codex/blob/main/README.md)
- [Codex getting started](https://github.com/openai/codex/blob/main/docs/getting-started.md)
- [OpenAI code generation guide](https://developers.openai.com/api/docs/guides/code-generation)

Dentro de Grimoire, Codex corre sobre su app-server protocol con native history, fork, plan mode, image input y reasoning effort controls. Plan usage aparece cuando Codex reporta rate-limit metadata.

### Antigravity CLI

Antigravity CLI es el reemplazo recomendado por Google para el uso consumer de Gemini CLI. Elígelo como el multi-model agent CLI de Google, incluyendo Gemini, Claude, GPT-OSS y otras familias de modelos disponibles para tu Antigravity account.

```bash
agy
```

Instala la Antigravity CLI oficial de Google, autentícala localmente y luego activa Antigravity en Grimoire. Grimoire detecta `agy` automáticamente desde PATH, o puedes definir un custom CLI path en provider settings.

- [Antigravity CLI](https://antigravity.google/product/antigravity-cli)
- [Gemini CLI migration guide](https://goo.gle/gemini-cli-migration)

Dentro de Grimoire, Antigravity es el Google provider recomendado. Corre mediante `agy --print`, con model selection opcional desde `agy models`. Persistent sessions, native history, images, plan mode y auxiliary workflows permanecen desactivados hasta que Antigravity exponga una runtime surface compatible.

### Gemini CLI (Legacy)

Gemini CLI queda como legacy provider para Gemini Code Assist Standard, Enterprise, Google Cloud y paid API-key users donde Google sigue sirviendo Gemini CLI requests. Las cuentas consumer Google AI Pro, Ultra y free-tier deben usar Antigravity despues del June 18, 2026.

```bash
gemini
```

Activa Gemini CLI solo si tu account tier sigue soportado. Grimoire lo ejecuta mediante `gemini --acp`, agrega active note, editor/browser/canvas selection, vault search y project workspace context al ACP prompt, y lo etiqueta como legacy para no confundirlo con el Google provider recomendado.

### OpenCode

Elige OpenCode para un agent model-agnostic con su propia provider configuration.

```bash
curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash
opencode
```

Homebrew y Go installs también funcionan. Configura tus provider credentials en OpenCode y luego actívalo en Grimoire.

- [OpenCode GitHub repository](https://github.com/opencode-ai/opencode)
- [OpenCode provider docs](https://opencode.ai/docs/providers)
- [OpenCode config docs](https://opencode.ai/docs/config)

Dentro de Grimoire, OpenCode corre sobre ACP con Grimoire-managed launch artifacts, además de persistent runtime, native history, plan mode, image input, provider commands y reasoning effort. Muestra monthly spend cuando hay cost metadata disponible.

## Tu primer chat

1. Elige un provider y un model en el composer.
2. Configura reasoning effort y permission mode.
3. Menciona las notas, carpetas o context que quieras incluir en scope.
4. Envía el turn.
5. Observa tool calls, usage y output en el panel.

## Features

### Chat workspace

Un panel lateral enfocado con múltiples tabs. Cada tab conserva su propio draft, provider, model, context y runtime. Cierra y vuelve a abrir Obsidian y tus sessions regresan, con provider, model y reasoning effort preservados en cada response. Rewind y fork aparecen cuando el provider activo los soporta. Auto-scroll se aparta en cuanto haces scroll para leer.

### Model selector

Un solo picker, agrupado por provider y ordenado por label: Antigravity, Claude Code, Codex, Gemini CLI (Legacy), OpenCode. Search funciona sobre labels, descriptions, groups y model IDs. Catalogs carga lazily y recuerda qué groups colapsaste. Añade custom aliases y context-window overrides en settings. Los variants 1M de Claude son opciones extra, no reemplazos de los base models.

<p align="center">
  <img src="../../assets/readme/model-selector-usage.png" alt="Model selector de Grimoire con provider groups, search y plan usage" width="100%">
</p>

### Usage y cost

Un badge junto al model selector mantiene visible el usage del provider activo. Dentro del model menu hay readouts completos: quota windows cuando el provider los expone, spend cuando solo hay cost disponible. Los últimos valores buenos se mantienen durante un refresh o un fallo, así que el meter no se borra de golpe. Puedes apagar todo en settings si quieres un UI más silencioso.

| Provider | De dónde viene usage |
| --- | --- |
| Claude Code | SDK rate-limit events, `.grimoire/claude/statusline-usage.json` opcional y SDK result cost metadata |
| Codex | Account rate-limit notifications y `account/rateLimits/read` cuando está disponible |
| Antigravity CLI | Aún no disponible desde `agy --print` |
| Gemini CLI (Legacy) | ACP cost metadata cuando Gemini CLI lo informa |
| OpenCode | Monthly spend agregado desde ACP y session cost metadata |

### Context y mentions

Menciona vault notes y folders directamente desde el composer, trae la current o linked note y añade persistent external context paths en settings. Pega o arrastra imágenes cuando el provider acepta image input. Menciona MCP servers donde la provider integration lo soporte.

### Inline editing

Ejecuta "Grimoire: Inline edit" sobre una selección. Un prompt se abre junto al texto, el edit vuelve como diff para accept o reject, y pasa por el provider-backed inline edit service. Maneja reemplazo de una selection e inserción de nuevo texto.

### Commands

Built-in commands cubren workflows de Grimoire como image generation y resume. Providers que exponen sus propios commands, como Claude Code slash commands y OpenCode runtime commands, los muestran mediante provider-owned catalogs. Oculta los que no uses desde settings.

### Image generation

Pega o arrastra imágenes para adjuntarlas. El command built-in `/image [prompt]` no llama ninguna image API por sí mismo. Envía un turn normal al provider activo con instrucciones para usar lo que hayas configurado para image generation: provider-native tooling, MCP tools o local command. El agent guarda el resultado en tu vault y devuelve un embed como `![[path/to/image.png]]`. Si no hay image generation configurado, recibes una respuesta simple explicando qué falta.

### Safety y permissions

Permission modes pertenecen al provider, así que Grimoire los muestra mediante shared composer controls en vez de reinventarlos. Safe mode y permission prompts permanecen visibles mientras trabajas. Bang-bash mode solo aparece cuando un enabled provider lo ofrece. Trata configured MCP servers, shell access y API keys como sensitive, porque lo son.

### Debug logging

Apagado por defecto. Si lo activas, Grimoire escribe JSONL sanitized en `.grimoire/logs/YYYY-MM-DD.jsonl`, con prompts, answers, note contents, paths, environment values y secrets redacted. Sirve para diagnosticar provider/runtime issues, no para conservar un transcript.

### Settings

General settings cubre auto-scroll, title generation, usage indicators, debug logging, locale, tabs y qué provider controla la settings view. Per-provider tabs gestionan CLI paths, model behavior, commands, agents, skills y provider-owned config cuando existe. También puedes definir project workspace environment variables, scoped per provider.

## Dónde guarda datos Grimoire

| Path | Qué contiene |
| --- | --- |
| `.grimoire/grimoire-settings.json` | App settings plus provider configuration |
| `.grimoire/sessions/*.meta.json` | Session metadata |
| `.grimoire/logs/YYYY-MM-DD.jsonl` | Opt-in sanitized debug logs |
| `.grimoire/claude/statusline-usage.json` | Claude usage snapshot para el plan meter |

Provider-native files bajo `.claude/`, `.codex/` y `.opencode/` se leen y escriben en su lugar, así que tu provider setup sigue siendo portable fuera de Grimoire.

## Privacy

Grimoire corre dentro de Obsidian, en tu máquina. No tiene backend, no añade telemetry y nunca sube tus prompts, answers, notes, files, tool output, API keys o usage logs a ningún Grimoire service. Los únicos logs que escribe son los optional sanitized debug logs de arriba, y se quedan en tu vault.

Lo que Grimoire no puede ocultar es el provider en sí. El CLI que actives recibe el prompt, el context seleccionado y los files, images, tool output y commands que necesita una request. Ese CLI puede hablar con Anthropic, OpenAI, Google, tus OpenCode vendors configurados, MCP servers o cualquier otro destino configurado. Terms, retention, billing, rate limits y privacy policies pertenecen al provider, no a Grimoire. El trabajo de Grimoire es hacer visible ese límite y mantenerlo bajo tu control dentro de Obsidian.

Para un resumen orientado a la política de Obsidian sobre el uso de red, requisitos de cuenta, acceso a archivos externos, registro y telemetry, consulta [DISCLOSURES.md](../DISCLOSURES.md).

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

Antes de publicar o hacer push de cambios UI/provider significativos, ejecuta el full local gate:

```bash
npm run test -- --selectProjects unit
npm run typecheck
npm run lint
npm run build:release
```

`npm run build:release` actualiza generated `main.js`, root `styles.css` y `dist/grimoire`.

npm es el canonical package manager para development, CI y releases. Mantén `package-lock.json` actualizado cuando cambien las dependencies; los secondary package-manager lockfiles no se committean intencionalmente.

## Releases

Grimoire releases se publican desde semver tags como `1.0.0`. El release workflow ejecuta el local gate, construye el Obsidian bundle, verifica que el tag coincida con `package.json` y `manifest.json`, y adjunta `main.js`, `manifest.json` y `styles.css` al GitHub Release.

Obsidian y BRAT consumen esos release assets directamente. Usa `main` para releasable development y publica con un tag que coincida con la manifest version.

## Roadmap

Hoy Grimoire se entrega con Claude Code, Codex, Antigravity CLI, Gemini CLI (Legacy) y OpenCode.

Lo siguiente: Qwen Code, GitHub Copilot CLI, otros ACP-compatible providers y local model CLIs cuando su runtime sea lo bastante estable para integrarse en Obsidian. Las implementation notes viven en [docs/provider-roadmap.md](../provider-roadmap.md).

## Licencia

MIT. Consulta [LICENSE](../../LICENSE).
