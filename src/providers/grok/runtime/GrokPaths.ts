import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const DEFAULT_DATABASE_NAME = 'grok.db';
const DATABASE_NAME_PATTERN = /^grok(?:-[a-z0-9._-]+)?\.db$/i;

export function resolveGrokDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const grokHome = env.GROK_HOME?.trim();
  if (grokHome) {
    return grokHome;
  }

  const home = env.HOME || os.homedir();
  if (process.platform === 'win32') {
    const userProfile = env.USERPROFILE || home;
    return path.join(userProfile, '.grok');
  }

  return path.join(home, '.grok');
}

export function resolveGrokDatabasePath(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const override = env.GROK_DB?.trim();
  if (override) {
    if (override === ':memory:' || path.isAbsolute(override)) {
      return override;
    }
    return path.join(resolveGrokDataDir(env), override);
  }

  const candidates = getGrokDatabasePathCandidates(env);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

export function resolveExistingGrokDatabasePath(
  preferredPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const preferred = preferredPath?.trim();
  if (preferred) {
    if (preferred === ':memory:') {
      return preferred;
    }
    if (fs.existsSync(preferred)) {
      return preferred;
    }
  }

  const resolved = resolveGrokDatabasePath(env);
  if (resolved && (resolved === ':memory:' || fs.existsSync(resolved))) {
    return resolved;
  }

  return preferred ?? resolved;
}

function getGrokDatabasePathCandidates(
  env: NodeJS.ProcessEnv,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const dataDirs = [resolveGrokDataDir(env)];

  for (const dataDir of dataDirs) {
    pushCandidate(candidates, seen, path.join(dataDir, DEFAULT_DATABASE_NAME));
    try {
      const matches = fs.readdirSync(dataDir)
        .filter((entry) => DATABASE_NAME_PATTERN.test(entry))
        .sort((left, right) => {
          if (left === DEFAULT_DATABASE_NAME) return -1;
          if (right === DEFAULT_DATABASE_NAME) return 1;
          return left.localeCompare(right);
        });

      for (const entry of matches) {
        pushCandidate(candidates, seen, path.join(dataDir, entry));
      }
    } catch {
      // Ignore missing dirs and unreadable locations.
    }
  }

  return candidates;
}

function pushCandidate(
  candidates: string[],
  seen: Set<string>,
  candidate: string,
): void {
  if (seen.has(candidate)) {
    return;
  }

  seen.add(candidate);
  candidates.push(candidate);
}
