import { buildAntigravityProcessLaunch } from '@/providers/antigravity/runtime/AntigravityProcessLaunch';

describe('buildAntigravityProcessLaunch', () => {
  it('wraps Antigravity launches in the user shell without shell-escaping arguments', () => {
    const launch = buildAntigravityProcessLaunch('/Users/test/.local/bin/agy', [
      '--model',
      'Gemini 3.5 Flash (Medium)',
      '--print',
      'hello && rm -rf nope',
    ], {
      SHELL: '/bin/zsh',
    });

    if (process.platform === 'win32') {
      // eslint-disable-next-line jest/no-conditional-expect -- launch behavior is platform-specific.
      expect(launch.launchMode).toBe('direct');
      return;
    }

    expect(launch).toEqual({
      args: [
        '-lc',
        'exec "$0" "$@"',
        '/Users/test/.local/bin/agy',
        '--model',
        'Gemini 3.5 Flash (Medium)',
        '--print',
        'hello && rm -rf nope',
      ],
      command: '/bin/zsh',
      launchMode: 'shellLogin',
      shell: false,
    });
  });

  it('launches a resolved Windows agy.exe directly instead of through cmd.exe', () => {
    if (process.platform !== 'win32') {
      return;
    }

    const launch = buildAntigravityProcessLaunch('C:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe', [
      '--print',
      'hello',
    ], {});

    expect(launch).toEqual({
      args: [
        '--print',
        'hello',
      ],
      command: 'C:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe',
      launchMode: 'direct',
      shell: false,
    });
  });
});
