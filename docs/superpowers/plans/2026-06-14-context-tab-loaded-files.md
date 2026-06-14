# Context Tab Loaded Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show pinned context and runtime-loaded files in the Context tab, while cleaning long attached-file rows.

**Architecture:** Add a small provider-neutral context activity tracker under chat UI. StreamController records file-load events from tool calls; FileContextManager renders pinned file rows; Tab wires a Loaded This Session panel into the existing Context tab.

**Tech Stack:** TypeScript, Obsidian DOM helpers, Jest unit tests, existing Grimoire chat tab architecture.

---

## File Structure

- Create `src/features/chat/ui/context/RuntimeContextActivity.ts`
  - Extracts runtime-loaded file events from `ToolCallInfo`.
  - Deduplicates by normalized path.
  - Renders Loaded This Session rows.
- Modify `src/features/chat/tabs/types.ts`
  - Add DOM handle for runtime context panel.
  - Add UI handle for runtime context activity.
- Modify `src/features/chat/tabs/Tab.ts`
  - Create Context sections.
  - Instantiate runtime context activity.
  - Pass it to StreamController.
- Modify `src/features/chat/controllers/StreamController.ts`
  - Record runtime file-load events on tool use/result updates.
- Modify `src/features/chat/ui/FileContext.ts`
  - Render attached files as clean rows in a Pinned Context section.
- Modify `src/style/features/file-context.css`
  - Add wrapping row styles for pinned and loaded context rows.
- Add tests:
  - `tests/unit/features/chat/ui/context/RuntimeContextActivity.test.ts`
  - Update focused Tab/FileContext tests as needed.

## Task 1: Runtime Context Activity Extractor

- [x] **Step 1: Write failing tests**

Create `tests/unit/features/chat/ui/context/RuntimeContextActivity.test.ts` with cases for:

```ts
import { extractRuntimeContextLoadEvent, RuntimeContextActivityState } from '@/features/chat/ui/context/RuntimeContextActivity';

describe('RuntimeContextActivity', () => {
  it('extracts Claude Read tool calls', () => {
    expect(extractRuntimeContextLoadEvent({
      providerId: 'claude',
      toolCall: {
        id: 'tool-1',
        name: 'Read',
        input: { file_path: 'Книги/Book/CLAUDE.md' },
        status: 'completed',
      },
    })).toMatchObject({
      path: 'Книги/Book/CLAUDE.md',
      method: 'read note',
      status: 'loaded',
    });
  });

  it('extracts conservative Codex shell reads', () => {
    expect(extractRuntimeContextLoadEvent({
      providerId: 'codex',
      toolCall: {
        id: 'tool-2',
        name: 'Bash',
        input: { command: "sed -n '1,120p' 'Книги/Book/Глава 2.md'" },
        status: 'completed',
      },
    })).toMatchObject({
      path: 'Книги/Book/Глава 2.md',
      method: 'shell',
      status: 'loaded',
    });
  });

  it('deduplicates by path and keeps latest status', () => {
    const state = new RuntimeContextActivityState();
    state.record({ id: 'a', path: 'A.md', providerId: 'claude', method: 'read note', status: 'loading' });
    state.record({ id: 'b', path: 'A.md', providerId: 'claude', method: 'read note', status: 'loaded' });
    expect(state.getEntries()).toHaveLength(1);
    expect(state.getEntries()[0].status).toBe('loaded');
  });
});
```

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/ui/context/RuntimeContextActivity.test.ts`
Expected: FAIL because the module does not exist.

- [x] **Step 2: Implement extractor and state**

Create `src/features/chat/ui/context/RuntimeContextActivity.ts` with:

- `RuntimeContextLoadEvent`
- `RuntimeContextActivityState`
- `extractRuntimeContextLoadEvent`
- a minimal `RuntimeContextActivityView` renderer

Keep shell extraction conservative: support direct `cat`, `sed -n`, and `nl -ba` commands with quoted or unquoted `.md` paths.

- [x] **Step 3: Run tests**

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/ui/context/RuntimeContextActivity.test.ts`
Expected: PASS.

## Task 2: Wire Runtime Events Into Chat Streaming

- [x] **Step 1: Add failing Tab/Stream expectations**

Update existing focused tests to verify a runtime activity component can be passed into StreamController and receives tool calls.

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/tabs/Tab.test.ts tests/unit/features/chat/controllers/StreamController.test.ts`
Expected: FAIL until wiring exists.

- [x] **Step 2: Wire the tracker**

Modify:

- `Tab.ts` to create `contextRuntimeEl` and `RuntimeContextActivityView`.
- `tabs/types.ts` to store the handles.
- `StreamController.ts` dependencies to accept `recordRuntimeToolCall?: (toolCall: ToolCallInfo) => void`.

Call the recorder when a tool call is created and when a tool result changes status.

- [x] **Step 3: Run focused tests**

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/tabs/Tab.test.ts tests/unit/features/chat/controllers/StreamController.test.ts`
Expected: PASS.

## Task 3: Clean Pinned Context Rows

- [x] **Step 1: Add rendering expectation**

Update `tests/unit/features/chat/ui/FileContextManager.test.ts` or `Tab.test.ts` to assert attached files render as `.grimoire-context-file-row` with separate title/path text.

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/ui/FileContextManager.test.ts`
Expected: FAIL until row markup changes.

- [x] **Step 2: Update FileContext rendering**

Modify `FileContext.ts` so `renderContextMemory()` renders a `Pinned context` section and file rows with:

- title
- path
- badge

Remove button-like visual dependency from the markup while keeping click-to-open behavior.

- [x] **Step 3: Update CSS**

Modify `src/style/features/file-context.css` to:

- remove heavy button/card appearance for context rows
- allow filename/path wrapping
- clamp long paths with normal wrapping and no horizontal overflow

- [x] **Step 4: Run focused tests**

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/ui/FileContextManager.test.ts tests/unit/features/chat/tabs/Tab.test.ts`
Expected: PASS.

## Task 4: Final Verification

- [x] **Step 1: Run focused unit suite**

Run: `npm run test -- --selectProjects unit tests/unit/features/chat/ui/context/RuntimeContextActivity.test.ts tests/unit/features/chat/ui/FileContextManager.test.ts tests/unit/features/chat/tabs/Tab.test.ts tests/unit/features/chat/controllers/StreamController.test.ts`
Expected: PASS.

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Review git diff**

Run: `git diff --stat`
Expected: only Context tab, chat stream wiring, CSS, tests, and docs changed.
