import { buildSystemPrompt } from '@/core/prompt/mainAgent';

describe('main agent working communication prompt', () => {
  it('requires concise user-facing updates throughout multi-step work', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('## Working Communication');
    expect(prompt).toContain('Before tool-heavy or multi-step work');
    expect(prompt).toContain('provide concise updates at meaningful phase changes');
    expect(prompt).toContain('what you learned and what comes next');
    expect(prompt).toContain('a tool fails');
    expect(prompt).toContain('the recovery path');
    expect(prompt).toContain('leading with the outcome');
    expect(prompt).toContain('verification performed');
  });

  it('prohibits private reasoning and noisy low-level narration', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Never reveal chain-of-thought');
    expect(prompt).toContain('hidden internal reasoning');
    expect(prompt).toContain('Do not narrate every trivial command');
    expect(prompt).toContain('Bundle low-level actions into meaningful updates');
    expect(prompt).toContain('answer directly without progress ceremony');
  });
});
