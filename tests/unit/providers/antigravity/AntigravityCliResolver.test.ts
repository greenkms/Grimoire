import * as fs from 'fs';
import * as path from 'path';

import { AntigravityCliResolver } from '@/providers/antigravity/runtime/AntigravityCliResolver';

jest.mock('fs');
jest.mock('@/utils/env', () => ({
  ...jest.requireActual('@/utils/env'),
  getHostnameKey: () => 'current-host',
}));

const mockedExists = fs.existsSync as jest.Mock;
const mockedStat = fs.statSync as jest.Mock;

const MOCK_PATH_DIR = process.platform === 'win32' ? 'C:\\mock\\bin' : '/mock/bin';
const PROVIDER_PATH_DIR = process.platform === 'win32' ? 'C:\\provider\\bin' : '/provider/bin';

function agyPath(directory: string): string {
  return path.join(directory, process.platform === 'win32' ? 'agy.exe' : 'agy');
}

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
    mockedExists.mockImplementation((filePath: string) => filePath === agyPath(MOCK_PATH_DIR));
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', '', [MOCK_PATH_DIR, '/usr/bin'].join(path.delimiter));

    expect(resolved).toBe(agyPath(MOCK_PATH_DIR));
  });

  it('finds a Windows agy.exe binary on PATH before falling back to shell lookup', () => {
    if (process.platform !== 'win32') {
      return;
    }

    mockedExists.mockImplementation((filePath: string) => filePath === 'C:\\mock\\bin\\agy.exe');
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', '', 'C:\\mock\\bin;C:\\Windows');

    expect(resolved).toBe('C:\\mock\\bin\\agy.exe');
  });

  it('falls back to common Antigravity install paths when PATH is missing agy', () => {
    if (process.platform === 'win32') {
      return;
    }

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
    mockedExists.mockImplementation((filePath: string) => filePath === agyPath(PROVIDER_PATH_DIR));
    mockedStat.mockReturnValue({ isFile: () => true });

    const resolver = new AntigravityCliResolver();
    const resolved = resolver.resolve({}, '', `PATH=${PROVIDER_PATH_DIR}`, '/usr/bin');

    expect(resolved).toBe(agyPath(PROVIDER_PATH_DIR));
  });
});
