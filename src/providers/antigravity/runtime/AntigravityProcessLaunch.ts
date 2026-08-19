export interface AntigravityProcessLaunch {
  args: string[];
  command: string;
  launchMode: 'direct' | 'shellLogin' | 'cmdShell';
  shell: boolean;
}

export function buildAntigravityProcessLaunch(
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): AntigravityProcessLaunch {
  if (platform === 'win32') {
    if (canLaunchDirectlyOnWindows(command)) {
      return {
        args,
        command,
        launchMode: 'direct',
        shell: false,
      };
    }

    // .cmd/.bat launchers and bare command names must be interpreted by
    // cmd.exe, but Node's `shell: true` concatenates the command line without
    // per-argument quoting, letting prompt content break out of its argument
    // (#59). Quote everything ourselves and spawn cmd.exe directly instead.
    return {
      args: ['/d', '/s', '/c', buildWindowsShellCommandLine(command, args)],
      command: 'cmd.exe',
      launchMode: 'cmdShell',
      shell: false,
    };
  }

  const shellCommand = resolveUserShell(runtimeEnv);
  if (!shellCommand) {
    return {
      args,
      command,
      launchMode: 'direct',
      shell: false,
    };
  }

  return {
    args: ['-lc', 'exec "$0" "$@"', command, ...args],
    command: shellCommand,
    launchMode: 'shellLogin',
    shell: false,
  };
}

/**
 * Build the command line passed to `cmd.exe /d /s /c` for non-`.exe`
 * launchers. Each element is quoted so cmd.exe treats metacharacters
 * (`& | < > ^`) as literals and never re-parses argument boundaries.
 */
export function buildWindowsShellCommandLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteWindowsArgument).join(' ');
}

function quoteWindowsArgument(value: string): string {
  // Double backslashes that precede a quote or the closing quote so the
  // child's argv parser keeps them, and double internal quotes so cmd.exe's
  // quote state stays balanced while the child receives a literal quote.
  // `%` expansion remains a cmd.exe limitation and cannot be escaped here.
  const prepared = value
    .replace(/(\\*)"/g, '$1$1""')
    .replace(/(\\+)$/, '$1$1');
  return `"${prepared}"`;
}

function canLaunchDirectlyOnWindows(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  return lowerCommand.endsWith('.exe');
}

function resolveUserShell(runtimeEnv: NodeJS.ProcessEnv): string | null {
  const shellCommand = (runtimeEnv.SHELL ?? process.env.SHELL ?? '').trim();
  return shellCommand || null;
}
