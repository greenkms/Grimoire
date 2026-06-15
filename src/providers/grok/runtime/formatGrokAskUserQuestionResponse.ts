import type { AcpAskUserQuestionResponse } from '../../acp';

export function formatGrokAskUserQuestionResponse(
  userAnswers: Record<string, string | string[]> | null,
): AcpAskUserQuestionResponse {
  if (userAnswers === null) {
    return { outcome: 'cancelled' };
  }

  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(userAnswers)) {
    if (Array.isArray(value)) {
      const normalized = value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim());
      if (normalized.length > 0) {
        answers[key] = normalized.join(', ');
      }
      continue;
    }

    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) {
      answers[key] = trimmed;
    }
  }

  if (Object.keys(answers).length === 0) {
    return { outcome: 'skip_interview' };
  }

  return {
    annotations: {},
    answers,
    outcome: 'accepted',
  };
}