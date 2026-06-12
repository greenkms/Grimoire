import * as fs from 'node:fs';
import * as path from 'node:path';

import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { getEnhancedPath, getHostnameKey, parseEnvironmentVariables } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { getAntigravityProviderSettings } from '../settings';

export class AntigravityCliResolver {
  private readonly cachedHostname = getHostnameKey();
  private lastCliPath = '';
  private lastEnvText = '';
  private lastHostnamePath = '';
  private resolvedPath: string | null = null;

  resolveFromSettings(settings: Record<string, unknown>): string | null {
    const antigravitySettings = getAntigravityProviderSettings(settings);
    const cliPath = antigravitySettings.cliPath.trim();
    const hostnamePath = (antigravitySettings.cliPathsByHost[this.cachedHostname] ?? '').trim();
    const envText = getRuntimeEnvironmentText(settings, 'antigravity');

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
      antigravitySettings.cliPathsByHost,
      cliPath,
      envText,
    );
    return this.resolvedPath;
  }

  resolve(
    hostnamePaths: Record<string, string> | undefined,
    legacyPath: string,
    envText: string,
    pathText: string | undefined = process.env.PATH,
  ): string | null {
    const hostnamePath = (hostnamePaths?.[this.cachedHostname] ?? '').trim();
    const configuredPath = resolveConfiguredCliPath(hostnamePath)
      ?? resolveConfiguredCliPath(legacyPath.trim());
    const envVars = parseEnvironmentVariables(envText);
    const enhancedPath = getEnhancedPath(envVars.PATH, configuredPath ?? (legacyPath.trim() || undefined));
    return resolveConfiguredCliPath(hostnamePath)
      ?? resolveConfiguredCliPath(legacyPath.trim())
      ?? resolveExecutableFromPath('agy', pathText)
      ?? resolveExecutableFromPath('agy', enhancedPath)
      ?? resolveCommonAgyPath();
  }

  reset(): void {
    this.lastCliPath = '';
    this.lastEnvText = '';
    this.lastHostnamePath = '';
    this.resolvedPath = null;
  }
}

function resolveCommonAgyPath(): string | null {
  const home = process.env.HOME;
  const candidates = [
    home ? path.join(home, '.local/bin/agy') : '',
    home ? path.join(home, '.antigravity/antigravity/bin/agy') : '',
    '/opt/homebrew/bin/agy',
    '/usr/local/bin/agy',
  ];

  for (const candidate of candidates) {
    const resolved = resolveConfiguredCliPath(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
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

function resolveExecutableFromPath(command: string, pathText: string | undefined): string | null {
  for (const directory of (pathText ?? '').split(path.delimiter)) {
    if (!directory.trim()) {
      continue;
    }

    const candidate = path.join(directory, command);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}
