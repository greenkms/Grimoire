import type { McpServerManager } from '../../../core/mcp/McpServerManager';
import type { ChatTurnRequest, PreparedChatTurn } from '../../../core/runtime/types';
import { appendBrowserContext } from '../../../utils/browser';
import { appendCanvasContext } from '../../../utils/canvas';
import {
  appendContextFiles,
  appendCurrentNote,
  appendExcludedFoldersContext,
  appendProjectWorkspaceContext,
  appendVaultSearchContext,
} from '../../../utils/context';
import { appendEditorContext } from '../../../utils/editor';

function isCompactCommand(text: string): boolean {
  return /^\/compact(\s|$)/i.test(text);
}

export function encodeClaudeTurn(
  request: ChatTurnRequest,
  mcpManager: Pick<McpServerManager, 'extractMentions' | 'transformMentions'>,
): PreparedChatTurn {
  const isCompact = isCompactCommand(request.text);

  let persistedContent = request.text;
  if (!isCompact) {
    if (request.excludedFolders && request.excludedFolders.length > 0) {
      persistedContent = appendExcludedFoldersContext(persistedContent, request.excludedFolders);
    }

    if (request.currentNotePath) {
      persistedContent = appendCurrentNote(persistedContent, request.currentNotePath);
    }

    if (request.vaultSearchContext) {
      persistedContent = appendVaultSearchContext(persistedContent, request.vaultSearchContext);
    }

    if (request.contextFiles && request.contextFiles.length > 0) {
      persistedContent = appendContextFiles(persistedContent, request.contextFiles);
    }

    if (request.projectWorkspaceContext) {
      persistedContent = appendProjectWorkspaceContext(persistedContent, request.projectWorkspaceContext);
    }

    if (request.editorSelection) {
      persistedContent = appendEditorContext(persistedContent, request.editorSelection);
    }

    if (request.browserSelection) {
      persistedContent = appendBrowserContext(persistedContent, request.browserSelection);
    }

    if (request.canvasSelection) {
      persistedContent = appendCanvasContext(persistedContent, request.canvasSelection);
    }
  }

  const mcpMentions = mcpManager.extractMentions(persistedContent);

  return {
    request,
    persistedContent,
    prompt: mcpManager.transformMentions(persistedContent),
    isCompact,
    mcpMentions,
  };
}
