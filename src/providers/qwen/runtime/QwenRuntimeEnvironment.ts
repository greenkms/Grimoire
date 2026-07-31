import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';

export function buildQwenRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'qwen');
  const envVars = parseEnvironmentVariables(envText);
  return {
    ...process.env,
    ...envVars,
    PATH: getEnhancedPath(envVars.PATH, cliPath || undefined),
  };
}
