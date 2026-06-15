import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const GROK_SESSIONS_DIR = 'sessions';
const GROK_CHAT_HISTORY_FILE = 'chat_history.jsonl';

export function resolveGrokNativeDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const home = env.HOME || os.homedir();
  if (process.platform === 'win32') {
    const userProfile = env.USERPROFILE || home;
    return path.join(userProfile, '.grok');
  }

  return path.join(home, '.grok');
}

export function resolveGrokDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const grokHome = env.GROK_HOME?.trim();
  if (grokHome) {
    return grokHome;
  }

  return resolveGrokNativeDataDir(env);
}

export function encodeGrokWorkspaceKey(workspacePath: string): string {
  return encodeURIComponent(path.resolve(workspacePath));
}

export function resolveGrokSessionsRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveGrokNativeDataDir(env), GROK_SESSIONS_DIR);
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
  const sessionDir = resolveGrokSessionDirectory(
    sessionId,
    workspacePath,
    preferredSessionDirPath,
    env,
  );
  if (!sessionDir) {
    return null;
  }

  const historyPath = path.join(sessionDir, GROK_CHAT_HISTORY_FILE);
  return fs.existsSync(historyPath) ? historyPath : null;
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