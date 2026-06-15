import { normalizeGrokAcpSessionModels } from '../../../../src/providers/grok/runtime/normalizeGrokAcpSessionState';

describe('normalizeGrokAcpSessionModels', () => {
  it('maps Grok ACP modelId fields onto the shared ACP id shape', () => {
    expect(normalizeGrokAcpSessionModels({
      availableModels: [
        { modelId: 'grok-build', name: 'Grok Build' },
        { id: 'grok-fast', name: 'Grok Fast', description: 'Fast model' },
      ],
      currentModelId: 'grok-build',
    } as never)).toEqual({
      availableModels: [
        { id: 'grok-build', name: 'Grok Build' },
        { description: 'Fast model', id: 'grok-fast', name: 'Grok Fast' },
      ],
      currentModelId: 'grok-build',
    });
  });

  it('returns null when models are missing', () => {
    expect(normalizeGrokAcpSessionModels(null)).toBeNull();
    expect(normalizeGrokAcpSessionModels(undefined)).toBeNull();
  });
});