import { buildGrokRuntimeEnv } from '@/providers/grok/runtime/GrokRuntimeEnvironment';

describe('buildGrokRuntimeEnv', () => {
  const originalHome = process.env.HOME;

  beforeEach(() => {
    process.env.HOME = '/home/tester';
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it('bridges managed GROK_HOME to the provider auth path from env resolution', () => {
    const env = buildGrokRuntimeEnv({}, '/usr/local/bin/grok', '/vault/.grimoire/grok');

    expect(env.GROK_HOME).toBe('/vault/.grimoire/grok');
    expect(env.GROK_AUTH_PATH).toBe('/home/tester/.grok/auth.json');
  });

  it('respects an explicit GROK_AUTH_PATH from provider env vars', () => {
    const env = buildGrokRuntimeEnv({
      providerConfigs: {
        grok: {
          environmentVariables: 'GROK_AUTH_PATH=/custom/auth.json',
        },
      },
    }, '/usr/local/bin/grok', '/vault/.grimoire/grok');

    expect(env.GROK_AUTH_PATH).toBe('/custom/auth.json');
  });

  it('does not inject GROK_AUTH_PATH when managed GROK_HOME is not used', () => {
    const env = buildGrokRuntimeEnv({}, '/usr/local/bin/grok');

    expect(env.GROK_HOME).toBeUndefined();
    expect(env.GROK_AUTH_PATH).toBeUndefined();
  });
});