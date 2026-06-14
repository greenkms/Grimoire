# Context Tab Loaded Files Design

## Goal

Make the Context tab show both what the user pinned before a turn and what the provider actually loaded while working. This should make Codex and Claude behavior easier to compare in vault workflows, especially when writing instructions or linked notes cause the agent to read additional files.

## Problem

The current Context tab mostly shows planned tab state:

- current note
- model/provider/permission summary
- attached files from the composer

It does not show files that the agent reads during the turn. Claude can visibly read notes such as `CLAUDE.md`, `TaraTextStyle.md`, or chapter files through `Read note`, while Codex may read files through shell commands such as `cat`, `sed`, or `rg`. Those reads are visible in chat tool calls, but not reflected in Context. As a result, the Context tab can look empty or incomplete even when the agent has used several files.

Attached files also render poorly today: long names and paths are squeezed into a button-like row and can overflow instead of wrapping cleanly.

## Design

The Context tab should separate context into two sections.

### Pinned Context

Pinned Context shows context selected or implied before the provider works:

- the active/current note
- composer attached files
- external context directories
- active project workspace context, when present

Attached file rows should be styled as file rows, not raised buttons. Each row should show:

- a file icon
- filename as the primary label
- vault-relative path as secondary text
- a compact badge such as `attached` or `active`

Long filenames and paths should wrap to two or three lines total without horizontal overflow. Rows should be clickable to open the note, but they should not look like heavy action buttons.

### Loaded This Session

Loaded This Session shows files that were observed from provider runtime activity:

- Claude `Read note` tool calls
- Codex shell reads when the command clearly references vault files
- future provider-normalized file-read tool calls, if added

Each row should show:

- filename
- vault-relative path when it can be resolved
- source label: `Claude`, `Codex`, or provider display name
- how it was loaded: `read note`, `shell`, or `tool`
- latest status: `loading`, `loaded`, or `failed`

This section is observational. It does not claim that every token from the file remains in the model context window; it only says the provider loaded or read the file during the session.

## Data Flow

Add a small provider-neutral runtime context tracker at the chat tab level. It should collect normalized file-load events from already-rendered tool-call data rather than re-reading files.

Initial event sources:

- Claude: tool calls rendered as `Read note` with a note path.
- Codex: tool calls whose command output or command arguments clearly indicate file reads against vault paths. Start conservatively with direct `cat`, `sed -n`, and similar read-only commands that include a path.

The tracker should deduplicate by normalized vault path and keep the most recent status. It should preserve provider/source metadata so the UI can show whether a file was loaded by Claude or Codex.

## Boundaries

This feature should not force Codex to read attached files in the first implementation. It only makes visible what is selected and what was actually loaded.

Changing Codex behavior so attached files become mandatory prompt/context inputs is a separate follow-up. That behavior needs its own provider-specific design because it changes model input, token usage, and provider semantics.

## UI Behavior

- Context summary remains at the top.
- Pinned Context appears below the summary.
- Loaded This Session appears below Pinned Context.
- Empty sections should stay hidden or show a quiet empty state only when it helps explain the tab.
- Rows should use the existing dark Grimoire visual language and avoid nested cards.
- Long labels must wrap cleanly on narrow and wide panes.

## Error Handling

If a loaded file path cannot be resolved to a vault path, show the best available label and mark the detail as an external or unresolved path.

If a tool call fails, keep the row with a failed status when a file path can be identified. This helps explain that the agent tried to load the file but did not receive usable content.

## Testing

Add focused unit tests for:

- extracting loaded vault paths from Claude `Read note` tool-call metadata
- extracting conservative Codex shell-read paths
- deduplicating repeated reads
- rendering attached file rows with long filenames and paths
- rendering Loaded This Session rows with provider/status metadata

Existing Tab tests should be updated to assert that the Context tab still renders summary rows and now mounts the two context sections.

## Follow-Ups

Potential later work:

- make attached files actual planned context for Codex
- add nearest vault instruction discovery for `AGENTS.md` or `CLAUDE.md` relative to the active note
- show estimated token contribution per loaded file when a provider exposes that data
- distinguish loaded files from files merely mentioned in shell output
