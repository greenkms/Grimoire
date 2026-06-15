import * as fs from 'node:fs';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getMimocodeProviderSettings } from '../settings';

export class MimocodeCliResolver {
  private readonly cachedHostname = getHostnameKey();
  private lastCliPath = '';
  private lastHostnamePath = '';
  private lastEnvText = '';
  private resolvedPath: string | null = null;

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const mimocodeSettings = getMimocodeProviderSettings(settings);
    const cliPath = mimocodeSettings.cliPath.trim();
    const hostnamePath = (mimocodeSettings.cliPathsByHost[this.cachedHostname] ?? '').trim();
    const envText = getRuntimeEnvironmentText(settings, 'mimocode');

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
      mimocodeSettings.cliPathsByHost,
      cliPath,
      envText,
    );
    return this.resolvedPath;
  }

  resolve(
    hostnamePaths: Record<string, string> | undefined,
    legacyPath: string,
    _envText: string,
  ): string | null {
    const hostnamePath = (hostnamePaths?.[this.cachedHostname] ?? '').trim();
    return resolveConfiguredCliPath(hostnamePath) ?? resolveConfiguredCliPath(legacyPath.trim());
  }

  reset(): void {
    this.lastCliPath = '';
    this.lastHostnamePath = '';
    this.lastEnvText = '';
    this.resolvedPath = null;
  }
}

function resolveConfiguredCliPath(cliPath: string): string | null {
  if (!cliPath) {
    return null;
  }

  try {
    const expanded = expandHomePath(cliPath);
    if (fs.existsSync(expanded) && fs.statSync(expanded).isFile()) {
      return expanded;
    }
  } catch {
    return null;
  }

  return null;
}
