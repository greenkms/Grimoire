import { createGeminiWorkspaceServices } from '@/providers/gemini/app/GeminiWorkspaceServices';

describe('createGeminiWorkspaceServices', () => {
  it('registers a usage provider for ACP cost updates', async () => {
    const services = await createGeminiWorkspaceServices({} as any);

    expect(services.usageProvider).toBeDefined();
  });
});
