import * as fs from 'fs';

import { AntigravityCliResolver } from '@/providers/antigravity/runtime/AntigravityCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

describe('AntigravityCliResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the current host custom path before PATH auto-detection', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/custom/agy');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve(
      {
        'current-host': '/custom/agy',
      },
      '',
      '',
      '/mock/bin:/usr/bin',
    );

    expect(resolved).toBe('/custom/agy');
  });

  it('finds agy on PATH when no custom path is configured', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/mock/bin/agy');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', '', '/mock/bin:/usr/bin');

    expect(resolved).toBe('/mock/bin/agy');
  });

  it('falls back to common Antigravity install paths when PATH is missing agy', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/Users/test/.local/bin/agy');
    mockedStat.mockReturnValue({ isFile: () => true });
    const originalHome = process.env.HOME;
    process.env.HOME = '/Users/test';

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', '', '/usr/bin');

    process.env.HOME = originalHome;
    expect(resolved).toBe('/Users/test/.local/bin/agy');
  });

  it('searches provider PATH before GUI process PATH when resolving agy', () => {
    mockedExists.mockImplementation((filePath: string) => filePath === '/provider/bin/agy');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', 'PATH=/provider/bin', '/usr/bin');

    expect(resolved).toBe('/provider/bin/agy');
  });
});
