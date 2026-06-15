import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { resolveGrokNativeAuthPath } from './GrokPaths';

export function buildGrokRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
  grokHomePath?: string | null,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'grok');
  const envVars = parseEnvironmentVariables(envText);
  const usesManagedGrokHome = Boolean(grokHomePath?.trim());
  const hasExplicitGrokAuth = Boolean(
    envVars.GROK_AUTH?.trim()
    || envVars.GROK_AUTH_PATH?.trim(),
  );

  return {
    ...process.env,
    ...envVars,
    ...(usesManagedGrokHome ? { GROK_HOME: grokHomePath!.trim() } : {}),
    ...(usesManagedGrokHome && !hasExplicitGrokAuth
      ? { GROK_AUTH_PATH: resolveGrokNativeAuthPath() }
      : {}),
    PATH: getEnhancedPath(envVars.PATH, cliPath || undefined),
  };
}