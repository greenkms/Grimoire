import * as fs from 'fs';

import { GrokCliResolver } from '@/providers/grok/runtime/GrokCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

describe('GrokCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/grok');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new GrokCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/grok',
        'current-host': '/current/grok',
      },
      '/legacy/grok',
      '',
    );

    expect(resolved).toBe('/current/grok');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/grok');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new GrokCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/grok',
      },
      '/legacy/grok',
      '',
    );

    expect(resolved).toBe('/legacy/grok');
  });

  it('returns null when neither the current host nor the legacy path resolve to a file', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new GrokCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/grok',
      },
      '/legacy/grok',
      '',
    );

    expect(resolved).toBeNull();
  });
});
