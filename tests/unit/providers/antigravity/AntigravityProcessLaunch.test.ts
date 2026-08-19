import {
  buildAntigravityProcessLaunch,
  buildWindowsShellCommandLine,
} from '@/providers/antigravity/runtime/AntigravityProcessLaunch';

describe('buildAntigravityProcessLaunch', () => {
  it('wraps Antigravity launches in the user shell without shell-escaping arguments', () => {
    const launch = buildAntigravityProcessLaunch('/Users/test/.local/bin/agy', [
      '--model',
      'Gemini 3.5 Flash (Medium)',
      '--print',
      'hello && rm -rf nope',
    ], {
      SHELL: '/bin/zsh',
    }, 'darwin');

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
    const launch = buildAntigravityProcessLaunch('C:\\Users\\test\\AppData\\Local\\agy\\bin\\agy.exe', [
      '--print',
      'hello',
    ], {}, 'win32');

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

  it('routes Windows .cmd launchers through an explicitly quoted cmd.exe invocation', () => {
    const launch = buildAntigravityProcessLaunch('C:\\Users\\test\\AppData\\agy.cmd', [
      '--print',
      'summarize this & echo injected',
    ], {}, 'win32');

    expect(launch).toEqual({
      args: [
        '/d',
        '/s',
        '/c',
        '"C:\\Users\\test\\AppData\\agy.cmd" "--print" "summarize this & echo injected"',
      ],
      command: 'cmd.exe',
      launchMode: 'cmdShell',
      shell: false,
    });
  });

  it('resolves bare Windows command names through cmd.exe with quoted arguments', () => {
    const launch = buildAntigravityProcessLaunch('agy', [
      '--print',
      'hello',
    ], {}, 'win32');

    expect(launch).toEqual({
      args: ['/d', '/s', '/c', '"agy" "--print" "hello"'],
      command: 'cmd.exe',
      launchMode: 'cmdShell',
      shell: false,
    });
  });
});

describe('buildWindowsShellCommandLine', () => {
  it('keeps cmd.exe metacharacters inert inside quoted arguments', () => {
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'a & b | c < d > e ^ f']))
      .toBe('"agy.cmd" "--print" "a & b | c < d > e ^ f"');
  });

  it('doubles internal quotes so the child receives them as literals', () => {
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'say "hi" now']))
      .toBe('"agy.cmd" "--print" "say ""hi"" now"');
  });

  it('doubles backslashes that precede a quote or the closing quote', () => {
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'path C:\\dir\\ "name"']))
      .toBe('"agy.cmd" "--print" "path C:\\dir\\ ""name"""');
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'before\\"after']))
      .toBe('"agy.cmd" "--print" "before\\\\""after"');
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'trailing\\']))
      .toBe('"agy.cmd" "--print" "trailing\\\\"');
  });

  it('keeps paths with spaces as a single command token', () => {
    expect(buildWindowsShellCommandLine('C:\\Program Files\\agy\\agy.cmd', ['models']))
      .toBe('"C:\\Program Files\\agy\\agy.cmd" "models"');
  });

  it('preserves multibyte prompt content unchanged', () => {
    expect(buildWindowsShellCommandLine('agy.cmd', ['--print', 'привет 世界 🌍']))
      .toBe('"agy.cmd" "--print" "привет 世界 🌍"');
  });
});
