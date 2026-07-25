import { buildSystemPrompt } from '@/core/prompt/mainAgent';

describe('main agent working communication prompt', () => {
  it('requires concise user-facing updates throughout multi-step work', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('## Working Style');
    expect(prompt).toContain('Before multi-step or tool-heavy work');
    expect(prompt).toContain('meaningful phase changes or when blocked');
    expect(prompt).toContain('Explain evidence, decisions, failures, and recovery');
    expect(prompt).toContain('Finish with the outcome, material changes, verification');
  });

  it('prohibits private reasoning and noisy low-level narration', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('without revealing private reasoning');
    expect(prompt).toContain('narrating every command');
    expect(prompt).toContain('For simple requests, answer directly');
  });
});
