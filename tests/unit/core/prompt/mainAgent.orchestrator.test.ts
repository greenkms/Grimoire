import {
  buildSystemPrompt,
  computeSystemPromptKey,
} from '@/core/prompt/mainAgent';

describe('main agent orchestrator prompt', () => {
  it('appends orchestrator instructions only when orchestrator mode is active', () => {
    const basePrompt = buildSystemPrompt();
    const orchestratorPrompt = buildSystemPrompt({}, { orchestratorMode: true });

    expect(basePrompt).not.toContain('## Grimoire Orchestrator Mode');
    expect(orchestratorPrompt).toContain('## Grimoire Orchestrator Mode');
    expect(orchestratorPrompt).toContain('exactly one fenced JSON');
    expect(orchestratorPrompt).toContain('"type": "orchestrator_plan"');
    expect(orchestratorPrompt).toContain('"tasks": [');
    expect(orchestratorPrompt).toContain('"id":');
    expect(orchestratorPrompt).toContain('"description":');
    expect(orchestratorPrompt).toContain('Do not use tools');
    expect(orchestratorPrompt).toContain('before the user approves');
    expect(orchestratorPrompt).toContain('After emitting the JSON block, stop.');
    expect(orchestratorPrompt).toContain('2 to 5');
  });

  it('changes the system prompt key when orchestrator mode is active', () => {
    const settings = {
      customPrompt: 'Be concise.',
      mediaFolder: 'media',
      userName: 'Ada',
      vaultPath: '/vault',
    };

    const baseKey = computeSystemPromptKey(settings);
    const orchestratorKey = computeSystemPromptKey(settings, { orchestratorMode: true });

    expect(orchestratorKey).not.toBe(baseKey);
    expect(orchestratorKey).toContain('orchestrator');
  });
});
