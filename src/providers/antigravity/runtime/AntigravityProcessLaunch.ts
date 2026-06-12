export interface AntigravityProcessLaunch {
  args: string[];
  command: string;
  launchMode: 'direct' | 'shellLogin';
  shell: boolean;
}

export function buildAntigravityProcessLaunch(
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
): AntigravityProcessLaunch {
  if (process.platform === 'win32') {
    return {
      args,
      command,
      launchMode: 'direct',
      shell: true,
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

function resolveUserShell(runtimeEnv: NodeJS.ProcessEnv): string | null {
  const shellCommand = (runtimeEnv.SHELL ?? process.env.SHELL ?? '').trim();
  return shellCommand || null;
}
