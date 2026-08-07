import * as fs from 'node:fs';

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
 * In safe/plan mode the result is contained to `cwd`: absolute paths,
 * `../` traversal, and symlink/junction escapes are rejected. Containment
 * resolves each path segment (following directory symlinks) so a
 * workspace-relative link cannot escape. In full-access mode
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

  const realCwd = resolvePathFollowingSymlinks(cwd);
  const realCandidate = resolvePathFollowingSymlinks(resolvedPath);
  if (isContainedPath(realCwd, realCandidate)) {
    return resolvedPath;
  }

  throw new Error(options.containmentMessage ?? DEFAULT_CONTAINMENT_MESSAGE);
}

function isContainedPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === '') {
    return true;
  }
  if (path.isAbsolute(relative)) {
    return false;
  }
  // Reject ".." and any path that walks above root ("../x", "..\\x").
  const segments = relative.split(/[/\\]/);
  return !segments.includes('..');
}

/**
 * Resolve path segments left-to-right, following directory symlinks. Missing
 * trailing segments are appended to the last resolved ancestor so containment
 * still sees escapes through intermediate links.
 */
function resolvePathFollowingSymlinks(target: string): string {
  const absolute = path.resolve(target);
  try {
    return fs.realpathSync(absolute);
  } catch {
    // Continue with a segment walk for missing suffixes / partial paths.
  }

  const root = path.parse(absolute).root;
  const parts = absolute
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);

  let current = root;
  const unresolved: string[] = [];

  for (const part of parts) {
    if (unresolved.length > 0) {
      unresolved.push(part);
      continue;
    }

    const next = path.join(current, part);
    try {
      const stat = fs.lstatSync(next);
      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(next);
        const resolvedLink = path.isAbsolute(linkTarget)
          ? path.resolve(linkTarget)
          : path.resolve(path.dirname(next), linkTarget);
        try {
          current = fs.realpathSync(resolvedLink);
        } catch {
          current = resolvePathFollowingSymlinks(resolvedLink);
        }
        continue;
      }
      try {
        current = fs.realpathSync(next);
      } catch {
        current = next;
      }
    } catch {
      unresolved.push(part);
    }
  }

  return unresolved.length > 0
    ? path.join(current, ...unresolved)
    : current;
}
