import type { ChatTurnRequest, PreparedChatTurn } from '../../../core/runtime/types';
import { appendBrowserContext } from '../../../utils/browser';
import { appendCanvasContext } from '../../../utils/canvas';
import { appendContextFiles, appendCurrentNote, appendProjectWorkspaceContext, appendVaultSearchContext } from '../../../utils/context';
import { appendEditorContext } from '../../../utils/editor';

function isCompactCommand(text: string): boolean {
  return /^\/compact(\s|$)/i.test(text);
}

export function encodeCodexTurn(request: ChatTurnRequest): PreparedChatTurn {
  const isCompact = isCompactCommand(request.text);

  if (isCompact) {
    return {
      request,
      persistedContent: request.text,
      prompt: request.text,
      isCompact: true,
      mcpMentions: new Set(),
    };
  }

  const sections: string[] = [];
  sections.push(request.text);

  if (request.currentNotePath) {
    sections.push(`\n${appendCurrentNote('', request.currentNotePath).trim()}`);
  }

  if (request.vaultSearchContext) {
    sections.push(`\n${appendVaultSearchContext('', request.vaultSearchContext).trim()}`);
  }

  if (request.contextFiles && request.contextFiles.length > 0) {
    sections.push(`\n${appendContextFiles('', request.contextFiles).trim()}`);
  }

  if (request.projectWorkspaceContext) {
    sections.push(`\n${appendProjectWorkspaceContext('', request.projectWorkspaceContext).trim()}`);
  }

  if (request.editorSelection?.selectedText) {
    sections.push(`\n${appendEditorContext('', request.editorSelection).trim()}`);
  }

  if (request.browserSelection?.selectedText) {
    sections.push(`\n${appendBrowserContext('', request.browserSelection).trim()}`);
  }

  if (request.canvasSelection) {
    const formatted = appendCanvasContext('', request.canvasSelection).trim();
    if (formatted) {
      sections.push(`\n${formatted}`);
    }
  }

  const prompt = sections.join('');

  return {
    request,
    persistedContent: request.text,
    prompt,
    isCompact: false,
    mcpMentions: new Set(),
  };
}
