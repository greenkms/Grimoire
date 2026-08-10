import * as os from 'node:os';
import * as path from 'node:path';

export interface ClaudeConfigDirContext {
  environment?: NodeJS.ProcessEnv;
  hostPlatform?: NodeJS.Platform;
  vaultPath?: string | null;
}

function resolveEnvironmentHome(
  environment: NodeJS.ProcessEnv,
  hostPlatform: NodeJS.Platform,
): string {
  if (hostPlatform === 'win32') {
    if (environment.USERPROFILE) {
      return environment.USERPROFILE;
    }
    if (environment.HOMEDRIVE && environment.HOMEPATH) {
      return `${environment.HOMEDRIVE}${environment.HOMEPATH}`;
    }
  } else if (environment.HOME) {
    return environment.HOME;
  }

  return os.homedir();
}

export function resolveClaudeConfigDir(context: ClaudeConfigDirContext = {}): string {
  const environment = context.environment ?? process.env;
  const configuredDir = environment.CLAUDE_CONFIG_DIR?.trim();
  const rawPath = configuredDir || path.join(
    context.environment
      ? resolveEnvironmentHome(environment, context.hostPlatform ?? process.platform)
      : os.homedir(),
    '.claude',
  );
  const normalizedPath = rawPath.normalize('NFC');

  return path.isAbsolute(normalizedPath)
    ? path.normalize(normalizedPath)
    : path.resolve(context.vaultPath ?? process.cwd(), normalizedPath);
}
