import { MIMOCODE_PROVIDER_CAPABILITIES } from '@/providers/mimocode/capabilities';

describe('MIMOCODE_PROVIDER_CAPABILITIES', () => {
  it('should have mimocode as providerId', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.providerId).toBe('mimocode');
  });

  it('should support persistent runtime', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsPersistentRuntime).toBe(true);
  });

  it('should support native history', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsNativeHistory).toBe(true);
  });

  it('should support plan mode', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsPlanMode).toBe(true);
  });

  it('should not support rewind', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsRewind).toBe(false);
  });

  it('should not support fork', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsFork).toBe(false);
  });

  it('should support provider commands', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.supportsProviderCommands).toBe(true);
  });

  it('should use effort-based reasoning control', () => {
    expect(MIMOCODE_PROVIDER_CAPABILITIES.reasoningControl).toBe('effort');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(MIMOCODE_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
