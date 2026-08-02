import { readFileSync } from 'fs';

function readCss(): string {
  return readFileSync('src/style/features/orchestrator-plan.css', 'utf8');
}

describe('orchestrator-plan.css', () => {
  it('uses the workbench card hierarchy from the orchestration design', () => {
    const css = readCss();

    expect(css).toContain('.grimoire-orchestrator-plan-card');
    expect(css).toContain('.grimoire-orchestrator-plan-task-toggle.is-selected');
    expect(css).toContain('.grimoire-orchestrator-plan-model');
    expect(css).toContain('.grimoire-orchestrator-plan-spawn-count');
    expect(css).toContain('background: var(--grimoire-sink)');
  });

  it('stacks task model badges and actions in narrow panes', () => {
    const css = readCss();

    expect(css).toContain('@container grimoire-orchestrator-plan (max-width: 470px)');
    expect(css).toContain('grid-column: 2');
    expect(css).toContain('flex-direction: column');
  });
});
