import {
  extractMimocodeSessionError,
  formatMimocodeSessionError,
} from '@/providers/mimocode/history/MimocodeSessionErrorStore';

describe('MimocodeSessionErrorStore', () => {
  it('turns a stored 401 into an actionable authentication error', () => {
    const error = extractMimocodeSessionError([{
      data: JSON.stringify({
        role: 'assistant',
        parentID: 'msg-user',
        error: {
          name: 'APIError',
          data: {
            message: 'Invalid API Key: Please provide valid API Key',
            statusCode: 401,
          },
        },
      }),
    }], 'msg-user');
    expect(error).toEqual({
      message: 'Invalid API Key: Please provide valid API Key',
      name: 'APIError',
      statusCode: 401,
    });
    expect(formatMimocodeSessionError(error!)).toBe(
      'MiMo authentication failed: Invalid API Key. Run `mimo auth login` in a terminal, then retry.',
    );
  });

  it('returns a bounded provider error without exposing response metadata', () => {
    const error = extractMimocodeSessionError([{
      data: JSON.stringify({
        role: 'assistant',
        error: {
          data: {
            message: 'Rate limit reached',
            responseBody: 'sensitive upstream body',
          },
        },
      }),
    }]);
    expect(error).toEqual({ message: 'Rate limit reached' });
    expect(formatMimocodeSessionError(error!)).toBe('MiMo request failed: Rate limit reached');
  });

  it('ignores successful and malformed stored messages', () => {
    expect(extractMimocodeSessionError([
      { data: '{broken' },
      { data: JSON.stringify({ role: 'user', error: { message: 'ignore me' } }) },
      { data: JSON.stringify({ role: 'assistant' }) },
    ])).toBeNull();
  });

  it('uses the ACP user message id instead of replaying a newer unrelated error', () => {
    expect(extractMimocodeSessionError([
      {
        data: JSON.stringify({
          role: 'assistant',
          parentID: 'msg-newer',
          error: { data: { message: 'Newer unrelated failure' } },
        }),
      },
      {
        data: JSON.stringify({
          role: 'assistant',
          parentID: 'msg-current',
          error: { data: { message: 'Current failure' } },
        }),
      },
    ], 'msg-current')).toEqual({ message: 'Current failure' });
  });
});
