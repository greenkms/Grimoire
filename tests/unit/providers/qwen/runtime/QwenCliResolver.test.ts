import * as fs from 'fs';

import { QwenCliResolver } from '@/providers/qwen/runtime/QwenCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

describe('QwenCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current host path instead of another synced host path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/current/qwen');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new QwenCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': '/current/qwen',
        'other-host': '/other/qwen',
      },
      '/legacy/qwen',
      '',
    );

    expect(resolved).toBe('/current/qwen');
  });

  it('falls back to the legacy path when the current host has no custom path', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/legacy/qwen');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new QwenCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/qwen',
      },
      '/legacy/qwen',
      '',
    );

    expect(resolved).toBe('/legacy/qwen');
  });

  it('returns null when neither the current host nor the legacy path resolve to a file', () => {
    mockedExists.mockReturnValue(false);

    const resolver = new QwenCliResolver();
    const resolved = resolver.resolve(
      {
        'other-host': '/other/qwen',
      },
      '/legacy/qwen',
      '',
    );

    expect(resolved).toBeNull();
  });
});
