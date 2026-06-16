import { formatGrokAskUserQuestionResponse } from '@/providers/grok/runtime/formatGrokAskUserQuestionResponse';

describe('formatGrokAskUserQuestionResponse', () => {
  it('maps accepted single-select answers onto the Grok ACP response shape', () => {
    expect(formatGrokAskUserQuestionResponse({
      'What do you want to do?': 'notes',
    })).toEqual({
      annotations: {},
      answers: {
        'What do you want to do?': 'notes',
      },
      outcome: 'accepted',
    });
  });

  it('joins multi-select answers into a single Grok answer string', () => {
    expect(formatGrokAskUserQuestionResponse({
      tests: ['Yes', 'Docs'],
    })).toEqual({
      annotations: {},
      answers: {
        tests: 'Yes, Docs',
      },
      outcome: 'accepted',
    });
  });

  it('returns cancelled when the user dismisses the prompt', () => {
    expect(formatGrokAskUserQuestionResponse(null)).toEqual({
      outcome: 'cancelled',
    });
  });

  it('returns skip_interview when the user submits without answers', () => {
    expect(formatGrokAskUserQuestionResponse({})).toEqual({
      outcome: 'skip_interview',
    });
  });
});