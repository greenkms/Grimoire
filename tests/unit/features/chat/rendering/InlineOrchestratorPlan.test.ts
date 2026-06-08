import { createMockEl, type MockElement } from '@test/helpers/mockElement';

import { InlineOrchestratorPlan } from '@/features/chat/rendering/InlineOrchestratorPlan';
import type { OrchestratorPlan } from '@/features/chat/rendering/orchestratorPlanParser';
import { setLocale } from '@/i18n/i18n';

const plan: OrchestratorPlan = {
  type: 'orchestrator_plan' as const,
  tasks: [
    {
      id: 'parser',
      description: 'Add provider-neutral parser',
      prompt: 'Implement parser tests and code',
    },
    {
      id: 'renderer',
      description: 'Render inline approval controls',
      prompt: 'Implement renderer tests and code',
    },
  ],
};

function collectText(el: MockElement): string {
  return [
    el.textContent,
    ...el.children.map(child => collectText(child)),
  ].filter(Boolean).join(' ');
}

function collectClasses(el: MockElement): string[] {
  return [
    ...el.getClasses(),
    ...el.children.flatMap(child => collectClasses(child)),
  ];
}

function renderPlan() {
  const container = createMockEl();
  const resolve = jest.fn<void, [unknown]>();
  const widget = new InlineOrchestratorPlan(container as HTMLElement, plan, resolve);

  widget.render();

  const root = container.querySelector('.grimoire-orchestrator-plan-inline');
  expect(root).toBeTruthy();

  return { container, resolve, root: root!, widget };
}

describe('InlineOrchestratorPlan', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders task descriptions and approval buttons with Grimoire classes', () => {
    const { container, root } = renderPlan();
    const text = collectText(root);

    expect(text).toContain('Add provider-neutral parser');
    expect(text).toContain('Render inline approval controls');
    expect(text).toContain('Spawn workers');
    expect(text).toContain('Cancel');
    expect(root.querySelectorAll('.grimoire-orchestrator-plan-task')).toHaveLength(2);

    const classes = collectClasses(container);
    expect(classes.some(cls => cls.startsWith('grimoire-'))).toBe(true);
  });

  it('renders orchestrator controls in the active locale', () => {
    setLocale('ru');

    const { root } = renderPlan();
    const text = collectText(root);

    expect(text).toContain('План оркестратора');
    expect(text).toContain('Исполнителей: 2');
    expect(text).toContain('Запустить исполнителей');
    expect(text).toContain('Отмена');
  });

  it('resolves with spawn_workers and disables both buttons after spawning', () => {
    const { resolve, root } = renderPlan();

    const spawnButton = root.querySelector('.grimoire-orchestrator-plan-spawn-button')!;
    const cancelButton = root.querySelector('.grimoire-orchestrator-plan-cancel-button')!;

    spawnButton.click();
    cancelButton.click();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ type: 'spawn_workers', plan });
    expect(spawnButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
  });

  it('resolves with cancel and disables both buttons after cancelling', () => {
    const { resolve, root } = renderPlan();

    const spawnButton = root.querySelector('.grimoire-orchestrator-plan-spawn-button')!;
    const cancelButton = root.querySelector('.grimoire-orchestrator-plan-cancel-button')!;

    cancelButton.click();
    spawnButton.click();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ type: 'cancel' });
    expect(spawnButton.disabled).toBe(true);
    expect(cancelButton.disabled).toBe(true);
  });
});
