import * as fs from 'node:fs';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getHostnameKey } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getQwenProviderSettings } from '../settings';

export class QwenCliResolver {
  private readonly cachedHostname = getHostnameKey();
  private lastCliPath = '';
  private lastEnvText = '';
  private lastHostnamePath = '';
  private resolvedPath: string | null = null;

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const qwenSettings = getQwenProviderSettings(settings);
    const cliPath = qwenSettings.cliPath.trim();
    const hostnamePath = (qwenSettings.cliPathsByHost[this.cachedHostname] ?? '').trim();
    const envText = getRuntimeEnvironmentText(settings, 'qwen');

    if (
      this.resolvedPath !== null
      && cliPath === this.lastCliPath
      && envText === this.lastEnvText
      && hostnamePath === this.lastHostnamePath
    ) {
      return this.resolvedPath;
    }

    this.lastCliPath = cliPath;
    this.lastEnvText = envText;
    this.lastHostnamePath = hostnamePath;
    this.resolvedPath = this.resolve(
      qwenSettings.cliPathsByHost,
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
    this.lastEnvText = '';
    this.lastHostnamePath = '';
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
