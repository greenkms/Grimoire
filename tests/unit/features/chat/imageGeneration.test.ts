import { buildImageGenerationPrompt } from '@/features/chat/imageGeneration';

describe('imageGeneration prompt builder', () => {
  it('builds a provider-neutral image generation instruction with the media folder', () => {
    const prompt = buildImageGenerationPrompt({
      prompt: 'A moonlit library made of glass',
      mediaFolder: 'attachments/images',
    });

    expect(prompt).toContain('A moonlit library made of glass');
    expect(prompt).toContain('attachments/images');
    expect(prompt).toContain('Use any image-generation capability available to the active CLI/provider');
    expect(prompt).toContain('Do not assume Grimoire has a direct image API integration.');
    expect(prompt).toContain('![[attachments/images/');
  });

  it('handles missing media folder without naming a specific provider API', () => {
    const prompt = buildImageGenerationPrompt({
      prompt: 'Quiet red cabin in snow',
      mediaFolder: '',
    });

    expect(prompt).toContain('Quiet red cabin in snow');
    expect(prompt).toContain('inside the current vault');
    expect(prompt).not.toContain('OpenAI');
    expect(prompt).not.toContain('Gemini API');
  });
});
