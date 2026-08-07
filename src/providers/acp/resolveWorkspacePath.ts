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
 * `../` traversal, and symlink/junction escapes are rejected. Containment uses
 * realpath-aware comparison (see `isPathWithinDirectory`). In full-access mode
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

  // Realpath-aware check so a workspace-relative symlink cannot escape.
  if (isPathWithinDirectory(resolvedPath, cwd, cwd)) {
    return resolvedPath;
  }

  throw new Error(options.containmentMessage ?? DEFAULT_CONTAINMENT_MESSAGE);
}
