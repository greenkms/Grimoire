import { TurnFeedbackMetrics } from '@/features/chat/services/TurnFeedbackMetrics';

describe('TurnFeedbackMetrics', () => {
  it('measures first activity, feedback latency, and silence without content', () => {
    const metrics = new TurnFeedbackMetrics(1_000);

    metrics.observe({ type: 'tool_use', id: 'tool-1', name: 'Read', input: {} }, 1_200);
    metrics.observe({ type: 'progress', id: 'phase-1', content: 'private content' }, 1_500);
    metrics.observe({ type: 'text', content: 'also private', phase: 'commentary' }, 2_000);

    expect(metrics.finish(2_800)).toEqual({
      turnDurationMs: 1_800,
      firstActivityMs: 200,
      firstFeedbackMs: 500,
      longestFeedbackSilenceMs: 800,
      progressUpdates: 1,
      textUpdates: 1,
      toolUses: 1,
    });
  });

  it('reports the full turn as silent when no feedback arrives', () => {
    const metrics = new TurnFeedbackMetrics(100);

    metrics.observe({ type: 'usage', usage: {
      inputTokens: 1,
      contextWindow: 100,
      contextTokens: 1,
      percentage: 1,
    } }, 150);

    expect(metrics.finish(900)).toEqual(expect.objectContaining({
      firstActivityMs: null,
      firstFeedbackMs: null,
      longestFeedbackSilenceMs: 800,
      progressUpdates: 0,
      textUpdates: 0,
      toolUses: 0,
    }));
  });

  it('does not count whitespace text as feedback', () => {
    const metrics = new TurnFeedbackMetrics(0);
    metrics.observe({ type: 'text', content: '   ' }, 100);

    expect(metrics.finish(300).firstFeedbackMs).toBeNull();
  });
});
