import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';

export function buildGrokRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
  grokHomePath?: string | null,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'grok');
  const envVars = parseEnvironmentVariables(envText);
  return {
    ...process.env,
    ...envVars,
    ...(grokHomePath ? { GROK_HOME: grokHomePath } : {}),
    PATH: getEnhancedPath(envVars.PATH, cliPath || undefined),
  };
}