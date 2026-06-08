import * as fs from 'fs';

import { GeminiCliResolver } from '@/providers/gemini/runtime/GeminiCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

describe('GeminiCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/gemini');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new GeminiCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': '/current/gemini',
        'other-host': '/other/gemini',
      },
      '/legacy/gemini',
      '',
    );

    expect(resolved).toBe('/current/gemini');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/gemini');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new GeminiCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/gemini',
      },
      '/legacy/gemini',
      '',
    );

    expect(resolved).toBe('/legacy/gemini');
  });

  it('returns null when neither the current host nor the legacy path resolve to a file', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new GeminiCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/gemini',
      },
      '/legacy/gemini',
      '',
    );

    expect(resolved).toBeNull();
  });
});
