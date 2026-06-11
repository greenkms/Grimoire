import * as path from 'path';

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
 * In safe/plan mode the result is contained to `cwd`: absolute paths and
 * `../` traversal that escape the workspace are rejected. In full-access mode
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

  const relative = path.relative(cwd, resolvedPath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolvedPath;
  }

  throw new Error(options.containmentMessage ?? DEFAULT_CONTAINMENT_MESSAGE);
}
