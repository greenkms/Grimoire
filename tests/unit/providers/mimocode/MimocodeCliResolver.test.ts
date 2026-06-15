import * as fs from 'fs';

import { MimocodeCliResolver } from '@/providers/mimocode/runtime/MimocodeCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

describe('MimocodeCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/mimocode');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new MimocodeCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/mimocode',
        'current-host': '/current/mimocode',
      },
      '/legacy/mimocode',
      '',
    );

    expect(resolved).toBe('/current/mimocode');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/mimocode');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new MimocodeCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/mimocode',
      },
      '/legacy/mimocode',
      '',
    );

    expect(resolved).toBe('/legacy/mimocode');
  });

  it('returns null when neither the current host nor the legacy path resolve to a file', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new MimocodeCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/mimocode',
      },
      '/legacy/mimocode',
      '',
    );

    expect(resolved).toBeNull();
  });
});
