export interface NodeSqliteModule<Row extends Record<string, unknown> = Record<string, unknown>> {
  DatabaseSync: new (location: string, options?: Record<string, unknown>) => {
    close(): void;
    prepare(sql: string): {
      all(...params: unknown[]): Row[];
    };
  };
}

type ModuleRequire = ((id: string) => unknown) | null | undefined;

function getCommonJsRequire(): ModuleRequire {
  return typeof require === 'function' ? require : undefined;
}

export function loadNodeSqliteModule<Row extends Record<string, unknown> = Record<string, unknown>>(
  moduleRequire: ModuleRequire = getCommonJsRequire(),
): NodeSqliteModule<Row> | null {
  if (!moduleRequire) {
    return null;
  }

  try {
    return moduleRequire('node:sqlite') as NodeSqliteModule<Row>;
  } catch {
    return null;
  }
}
