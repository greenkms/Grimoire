import { KIMICODE_PROVIDER_CAPABILITIES } from '@/providers/kimicode/capabilities';

describe('KIMICODE_PROVIDER_CAPABILITIES', () => {
  it('should have kimicode as providerId', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.providerId).toBe('kimicode');
  });

  it('should support persistent runtime', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsPersistentRuntime).toBe(true);
  });

  it('should support native history', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsNativeHistory).toBe(true);
  });

  it('should support plan mode', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsPlanMode).toBe(true);
  });

  it('should not support rewind', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsRewind).toBe(false);
  });

  it('should not support fork', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsFork).toBe(false);
  });

  it('should support provider commands', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.supportsProviderCommands).toBe(true);
  });

  it('should use effort-based reasoning control', () => {
    expect(KIMICODE_PROVIDER_CAPABILITIES.reasoningControl).toBe('effort');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(KIMICODE_PROVIDER_CAPABILITIES)).toBe(true);
  });
});
