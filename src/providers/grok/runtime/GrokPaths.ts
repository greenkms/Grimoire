import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GRIMOIRE_STORAGE_PATH } from '../../../core/bootstrap/StoragePaths';
import { expandHomePath } from '../../../utils/path';

const GROK_APP_NAME = 'grok';
const GROK_ARTIFACTS_SUBDIR = 'grok';
const GROK_SESSIONS_DIR = 'sessions';
const GROK_CHAT_HISTORY_FILE = 'chat_history.jsonl';
const GROK_UPDATES_FILE = 'updates.jsonl';
const GROK_SIGNALS_FILE = 'signals.json';
const GROK_AUTH_FILE = 'auth.json';

export function resolveGrokDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const grokHome = env.GROK_HOME?.trim();
  if (grokHome) {
    return expandHomePath(grokHome);
  }

  const home = env.HOME || os.homedir();
  if (process.platform === 'win32') {
    const userProfile = env.USERPROFILE || home;
    return path.join(userProfile, `.${GROK_APP_NAME}`);
  }

  return path.join(home, `.${GROK_APP_NAME}`);
}

export function resolveGrokAuthPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicitAuth = env.GROK_AUTH_PATH?.trim() || env.GROK_AUTH?.trim();
  if (explicitAuth) {
    return expandHomePath(explicitAuth);
  }

  return path.join(resolveGrokDataDir(env), GROK_AUTH_FILE);
}

export function encodeGrokWorkspaceKey(workspacePath: string): string {
  return encodeURIComponent(path.resolve(workspacePath));
}

export function resolveManagedGrokHomePath(
  workspaceRoot: string,
  artifactsSubdir = GROK_ARTIFACTS_SUBDIR,
): string {
  return path.join(path.resolve(workspaceRoot), GRIMOIRE_STORAGE_PATH, artifactsSubdir);
}

export function buildManagedGrokProcessEnv(
  workspaceRoot: string,
  artifactsSubdir = GROK_ARTIFACTS_SUBDIR,
): NodeJS.ProcessEnv {
  return {
    GROK_HOME: resolveManagedGrokHomePath(workspaceRoot, artifactsSubdir),
  };
}

export function resolveGrokSessionsRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveGrokDataDir(env), GROK_SESSIONS_DIR);
}

export function resolveGrokSessionDirectory(
  sessionId: string,
  workspacePath?: string | null,
  preferredSessionDirPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const trimmedSessionId = sessionId.trim();
  if (!trimmedSessionId) {
    return null;
  }

  const preferred = preferredSessionDirPath?.trim();
  if (preferred && fs.existsSync(path.join(preferred, GROK_CHAT_HISTORY_FILE))) {
    return preferred;
  }

  const trimmedWorkspace = workspacePath?.trim();
  if (trimmedWorkspace) {
    const workspaceSessionDir = path.join(
      resolveGrokSessionsRoot(env),
      encodeGrokWorkspaceKey(trimmedWorkspace),
      trimmedSessionId,
    );
    if (fs.existsSync(path.join(workspaceSessionDir, GROK_CHAT_HISTORY_FILE))) {
      return workspaceSessionDir;
    }
  }

  return findGrokSessionDirectoryById(trimmedSessionId, env);
}

export function resolveGrokChatHistoryPath(
  sessionId: string,
  workspacePath?: string | null,
  preferredSessionDirPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return resolveGrokSessionFilePath(
    sessionId,
    GROK_CHAT_HISTORY_FILE,
    workspacePath,
    preferredSessionDirPath,
    env,
  );
}

export function resolveGrokUpdatesPath(
  sessionId: string,
  workspacePath?: string | null,
  preferredSessionDirPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return resolveGrokSessionFilePath(
    sessionId,
    GROK_UPDATES_FILE,
    workspacePath,
    preferredSessionDirPath,
    env,
  );
}

export function resolveGrokSignalsPath(
  sessionId: string,
  workspacePath?: string | null,
  preferredSessionDirPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return resolveGrokSessionFilePath(
    sessionId,
    GROK_SIGNALS_FILE,
    workspacePath,
    preferredSessionDirPath,
    env,
  );
}

function resolveGrokSessionFilePath(
  sessionId: string,
  fileName: string,
  workspacePath?: string | null,
  preferredSessionDirPath?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const sessionDir = resolveGrokSessionDirectory(
    sessionId,
    workspacePath,
    preferredSessionDirPath,
    env,
  );
  if (!sessionDir) {
    return null;
  }

  const filePath = path.join(sessionDir, fileName);
  return fs.existsSync(filePath) ? filePath : null;
}

function findGrokSessionDirectoryById(
  sessionId: string,
  env: NodeJS.ProcessEnv,
): string | null {
  const sessionsRoot = resolveGrokSessionsRoot(env);
  let workspaceEntries: string[] = [];
  try {
    workspaceEntries = fs.readdirSync(sessionsRoot);
  } catch {
    return null;
  }

  for (const workspaceEntry of workspaceEntries) {
    const sessionDir = path.join(sessionsRoot, workspaceEntry, sessionId);
    if (fs.existsSync(path.join(sessionDir, GROK_CHAT_HISTORY_FILE))) {
      return sessionDir;
    }
  }

  return null;
}