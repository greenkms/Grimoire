import {
  classifyProviderError,
  normalizeProviderError,
} from '@/core/runtime/providerError';

describe('providerError', () => {
  it.each([
    ['401 Invalid API Key', 'authentication'],
    ['429 Too Many Requests', 'rate_limit'],
    ['insufficient_quota', 'quota'],
    ['Not supported model mimo-v2.5-pro-ultraspeed', 'model_unavailable'],
    ['JSON-RPC input closed', 'transport'],
    ['Unexpected provider response', 'unknown'],
  ] as const)('classifies %s as %s', (message, category) => {
    expect(classifyProviderError(message)).toBe(category);
  });

  it('turns raw authentication failures into provider-specific recovery copy', () => {
    expect(normalizeProviderError('401 Invalid API Key', 'OpenCode')).toEqual({
      category: 'authentication',
      message: 'OpenCode authentication failed: invalid or expired credentials. Log in to OpenCode again, then retry.',
    });
  });

  it('preserves provider-owned actionable authentication instructions', () => {
    const message = 'MiMo authentication failed: Invalid API Key. Run `mimo auth login` in a terminal, then retry.';
    expect(normalizeProviderError(message, 'MiMo Code')).toEqual({
      category: 'authentication',
      message,
    });
  });
});
