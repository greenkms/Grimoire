import * as os from 'node:os';
import * as path from 'node:path';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getHostnameKey } from '../../../utils/env';
import { resolveCliExecutable } from '../../../utils/resolveCliExecutable';
import { getKimicodeProviderSettings } from '../settings';

const KIMI_CODE_DEFAULT_BIN = path.join(os.homedir(), '.kimi-code', 'bin', 'kimi');

export class KimicodeCliResolver {
  private readonly cachedHostname = getHostnameKey();
  private lastCliPath = '';
  private lastHostnamePath = '';
  private lastEnvText = '';
  private resolvedPath: string | null = null;

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const kimicodeSettings = getKimicodeProviderSettings(settings);
    const cliPath = kimicodeSettings.cliPath.trim();
    const hostnamePath = (kimicodeSettings.cliPathsByHost[this.cachedHostname] ?? '').trim();
    const envText = getRuntimeEnvironmentText(settings, 'kimicode');

    if (
      this.resolvedPath !== null
      && cliPath === this.lastCliPath
      && hostnamePath === this.lastHostnamePath
      && envText === this.lastEnvText
    ) {
      return this.resolvedPath;
    }

    this.lastCliPath = cliPath;
    this.lastHostnamePath = hostnamePath;
    this.lastEnvText = envText;
    this.resolvedPath = this.resolve(
      kimicodeSettings.cliPathsByHost,
      cliPath,
      envText,
    );
    return this.resolvedPath;
  }

  resolve(
    hostnamePaths: Record<string, string> | undefined,
    legacyPath: string,
    envText: string,
  ): string | null {
    const hostnamePath = (hostnamePaths?.[this.cachedHostname] ?? '').trim();
    return resolveCliExecutable('kimi', [hostnamePath, legacyPath], envText, {
      fallbackPaths: [KIMI_CODE_DEFAULT_BIN],
    });
  }

  reset(): void {
    this.lastCliPath = '';
    this.lastHostnamePath = '';
    this.lastEnvText = '';
    this.resolvedPath = null;
  }
}
