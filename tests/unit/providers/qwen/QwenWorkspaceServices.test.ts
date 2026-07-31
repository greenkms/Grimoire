import { createQwenWorkspaceServices } from '@/providers/qwen/app/QwenWorkspaceServices';

describe('createQwenWorkspaceServices', () => {
  it('registers a usage provider for ACP cost updates', async () => {
    const services = await createQwenWorkspaceServices({} as any);

    expect(services.usageProvider).toBeDefined();
  });
});
