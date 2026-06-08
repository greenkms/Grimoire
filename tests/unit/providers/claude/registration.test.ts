import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { updateClaudeProviderSettings } from '@/providers/claude/settings';

describe('Claude provider registration', () => {
  it('registers Claude as a toggleable provider', () => {
    expect(ProviderRegistry.getRegisteredProviderIds()).toContain('claude');
    expect(ProviderRegistry.getProviderDisplayName('claude')).toBe('Claude');
    expect(ProviderRegistry.isEnabled('claude', {})).toBe(false);

    const settings: Record<string, unknown> = {};
    updateClaudeProviderSettings(settings, { enabled: true });

    expect(ProviderRegistry.isEnabled('claude', settings)).toBe(true);
  });
});
