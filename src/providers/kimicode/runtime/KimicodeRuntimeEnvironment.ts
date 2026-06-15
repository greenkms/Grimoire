import * as os from 'node:os';
import * as path from 'node:path';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';

const KIMI_CODE_BIN_DIR = path.join(os.homedir(), '.kimi-code', 'bin');

export function buildKimicodeRuntimeEnv(
  settings: Record<string, unknown>,
  cliPath: string,
  databasePathOverride?: string | null,
): NodeJS.ProcessEnv {
  const envText = getRuntimeEnvironmentText(settings, 'kimicode');
  const envVars = parseEnvironmentVariables(envText);
  const enhancedPath = getEnhancedPath(envVars.PATH, cliPath || undefined);
  const pathWithKimiBin = `${KIMI_CODE_BIN_DIR}:${enhancedPath}`;
  return {
    ...process.env,
    ...envVars,
    KIMICODE_DISABLE_CLAUDE_CODE_PROMPT: 'true',
    ...(databasePathOverride ? { KIMICODE_DB: databasePathOverride } : {}),
    PATH: pathWithKimiBin,
  };
}
