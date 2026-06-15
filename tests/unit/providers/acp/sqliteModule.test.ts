import { loadNodeSqliteModule } from '@/providers/acp/history/sqliteModule';

describe('loadNodeSqliteModule', () => {
  it('loads node:sqlite through CommonJS require', () => {
    const sqliteModule = { DatabaseSync: class DatabaseSync {} };
    const moduleRequire = jest.fn().mockReturnValue(sqliteModule);

    expect(loadNodeSqliteModule(moduleRequire)).toBe(sqliteModule);
    expect(moduleRequire).toHaveBeenCalledWith('node:sqlite');
  });

  it('returns null when node:sqlite is unavailable', () => {
    const moduleRequire = jest.fn(() => {
      throw new Error('Cannot find module node:sqlite');
    });

    expect(loadNodeSqliteModule(moduleRequire)).toBeNull();
  });

  it('returns null when CommonJS require is unavailable', () => {
    expect(loadNodeSqliteModule(null)).toBeNull();
  });
});
