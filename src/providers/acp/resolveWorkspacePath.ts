import * as fs from 'node:fs';

import * as path from 'path';

import { isPathWithinDirectory } from '../../utils/path';

export interface ResolveWorkspacePathOptions {
  /**
   * When true, paths outside the workspace are allowed. Used for the
   * full-access ("active") permission mode, where the user has opted into
   * unrestricted file access.
   */
  allowOutsideWorkspace?: boolean;
  /** Error thrown when a path escapes the workspace and containment is enforced. */
  containmentMessage?: string;
}

const DEFAULT_CONTAINMENT_MESSAGE = 'File access is limited to the current workspace.';

/**
 * Resolve an ACP-delegated file path against the session workspace.
 *
 * In safe/plan mode the result is contained to `cwd`: absolute paths,
 * `../` traversal, and symlink/junction escapes are rejected. When both the
 * workspace and candidate exist, containment uses `fs.realpathSync` so a
 * workspace-relative symlink cannot escape. Non-existent paths fall back to
 * the shared realpath-aware directory check. In full-access mode
 * (`allowOutsideWorkspace`) the resolved path is returned without containment.
 */
export function resolveWorkspacePath(
  cwd: string,
  rawPath: string,
  options: ResolveWorkspacePathOptions = {},
): string {
  const resolvedPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(cwd, rawPath);

  if (options.allowOutsideWorkspace) {
    return resolvedPath;
  }

  const message = options.containmentMessage ?? DEFAULT_CONTAINMENT_MESSAGE;

  // Prefer direct realpath when both sides exist (covers directory symlinks on
  // Linux/macOS without depending on walk-up heuristics for missing suffixes).
  try {
    const realCwd = fs.realpathSync(cwd);
    const realCandidate = fs.realpathSync(resolvedPath);
    const relative = path.relative(realCwd, realCandidate);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return resolvedPath;
    }
    throw new Error(message);
  } catch (error) {
    if (error instanceof Error && error.message === message) {
      throw error;
    }
  }

  if (isPathWithinDirectory(resolvedPath, cwd, cwd)) {
    return resolvedPath;
  }

  throw new Error(message);
}
