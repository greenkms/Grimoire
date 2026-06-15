import * as rendererSafeUnrefHelpers from '../../../scripts/rendererSafeUnref.js';

const {
  findUnsafeTimerUnrefSites,
  patchRendererUnsafeUnrefSites,
} = rendererSafeUnrefHelpers;

describe('rendererSafeUnref helpers', () => {
  it('patches the known unsafe timer .unref() bundle sites', () => {
    const input = [
      'if ($ && !$.killed && $.exitCode === null) setTimeout((X) => {',
      '  if (X.killed || X.exitCode !== null) return;',
      '  X.kill("SIGTERM"), setTimeout((J) => {',
      '    if (J.exitCode === null) J.kill("SIGKILL");',
      '  }, 5e3, X).unref();',
      '}, M2, $).unref(), $.once("exit", () => mJ.delete($));',
      'await Promise.race([closePromise, new Promise((resolve5) => setTimeout(resolve5, 2e3).unref())]);',
    ].join('\n');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close', count: 1 },
      { name: 'mcp-sdk-stdio-close-wait', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('closeTimeout.unref?.();');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches the current claude-sdk shape with a block-bodied exit handler', () => {
    const input = [
      'if ($ && !$.killed && $.exitCode === null) setTimeout((X) => {',
      '  if (X.killed || X.exitCode !== null) return;',
      '  X.kill("SIGTERM"), setTimeout((J) => {',
      '    if (J.exitCode === null) J.kill("SIGKILL");',
      '  }, 5e3, X).unref();',
      '}, LM, $).unref(), $.once("exit", () => {',
      '  if (this.processExitHandler) process.off("exit", this.processExitHandler), this.processExitHandler = void 0;',
      '});',
      'else if (this.processExitHandler) process.off("exit", this.processExitHandler), this.processExitHandler = void 0;',
    ].join('\n');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('this.processExitHandler');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches claude-sdk process close when minified identifiers change', () => {
    const input = [
      'if ($ && !$.killed && $.exitCode === null) setTimeout((Q) => {',
      '  if (Q.killed || Q.exitCode !== null) return;',
      '  Q.kill("SIGTERM"), setTimeout((J) => {',
      '    if (J.exitCode === null) J.kill("SIGKILL");',
      '  }, 5e3, Q).unref();',
      '}, wx, $).unref(), $.once("exit", () => D5.delete($));',
    ].join('\n');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('D5.delete($)');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches the claude-sdk win32-aware process close timeout shape', () => {
    const input = [
      'if (t3 && !t3.killed && t3.exitCode === null) setTimeout((r, o) => {',
      '  if (r.exitCode !== null) {',
      '    o();',
      '    return;',
      '  }',
      '  if (process.platform === "win32") {',
      '    setTimeout((n, i) => {',
      '      if (n.exitCode === null) n.kill("SIGKILL");',
      '      i();',
      '    }, 5e3, r, o).unref();',
      '    return;',
      '  }',
      '  r.kill("SIGTERM"), setTimeout((n) => {',
      '    if (n.exitCode === null) n.kill("SIGKILL");',
      '  }, 5e3, r).unref(), o();',
      '}, tH, t3, e).unref(), t3.once("exit", () => bd.delete(t3));',
    ].join('\n');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close-win32', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('windowsForceKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('t3.once("exit", () => bd.delete(t3));');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches the minified claude-sdk win32-aware process close timeout shape', () => {
    const input = [
      'if(n&&!n.killed&&n.exitCode===null)setTimeout((i,o)=>{if(i.exitCode!==null){o();return}',
      'if(process.platform==="win32"){setTimeout((s,a)=>{s.exitCode===null&&s.kill("SIGKILL"),a()},5e3,i,o).unref();return}',
      'i.kill("SIGTERM"),setTimeout(s=>{s.exitCode===null&&s.kill("SIGKILL")},5e3,i).unref(),o()},$xe,n,e).unref(),n.once("exit",()=>bd.delete(n));',
    ].join('');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close-win32-minified', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('windowsForceKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('n.once("exit",()=>bd.delete(n));');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches the minified claude-sdk win32-aware process close timeout expression shape', () => {
    const input = [
      'n&&!n.killed&&n.exitCode===null?(setTimeout((i,o)=>{if(i.exitCode!==null){o();return}',
      'if(process.platform==="win32"){setTimeout((s,a)=>{s.exitCode===null&&s.kill("SIGKILL"),a()},5e3,i,o).unref();return}',
      'i.kill("SIGTERM"),setTimeout(s=>{s.exitCode===null&&s.kill("SIGKILL")},5e3,i).unref(),o()},$xe,n,e).unref(),n.once("exit",()=>L_.delete(n))):n&&(L_.delete(n),e())',
    ].join('');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'claude-sdk-process-transport-close-win32-minified-expression', count: 1 },
    ]);
    expect(result.contents).toContain('processKillTimer.unref?.();');
    expect(result.contents).toContain('windowsForceKillTimer.unref?.();');
    expect(result.contents).toContain('forceKillTimer.unref?.();');
    expect(result.contents).toContain('n.once("exit",()=>L_.delete(n));');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('patches minified MCP stdio close waits', () => {
    const input = [
      'await Promise.race([r,new Promise(i=>setTimeout(i,2e3).unref())]);',
      'await Promise.race([r,new Promise(i=>setTimeout(i,2e3).unref())]);',
    ].join('');

    const result = patchRendererUnsafeUnrefSites(input);

    expect(result.appliedPatches).toEqual([
      { name: 'mcp-sdk-stdio-close-wait-minified', count: 2 },
    ]);
    expect(result.contents).toContain('closeTimeout.unref?.();');
    expect(findUnsafeTimerUnrefSites(result.contents)).toEqual([]);
  });

  it('reports remaining direct timer .unref() calls but ignores guarded usage', () => {
    const input = [
      'const timer = setTimeout(run, 1000);',
      'timer.unref?.();',
      'if (timer.unref) timer.unref();',
      'setTimeout(run, 1000).unref();',
      'setInterval(run, 1000).unref();',
    ].join('\n');

    expect(findUnsafeTimerUnrefSites(input)).toEqual([
      { line: 4, snippet: 'setTimeout(run, 1000).unref()' },
      { line: 5, snippet: 'setInterval(run, 1000).unref()' },
    ]);
  });
});
