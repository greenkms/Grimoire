import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';

export function buildMimocodeRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
  databasePathOverride?: string | null,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'mimocode');
  const envVars = parseEnvironmentVariables(envText);
  return {
    ...process.env,
    ...envVars,
    MIMOCODE_DISABLE_CLAUDE_CODE_PROMPT: 'true',
    ...(databasePathOverride ? { MIMOCODE_DB: databasePathOverride } : {}),
    PATH: getEnhancedPath(envVars.PATH, cliPath || undefined),
  };
}
