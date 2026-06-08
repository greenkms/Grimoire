export interface ImageGenerationPromptOptions {
  prompt: string;
  mediaFolder?: string | null;
}

function normalizeMediaFolder(mediaFolder: string | null | undefined): string {
  return mediaFolder?.trim().replace(/^\/+|\/+$/g, '') ?? '';
}

function buildExamplePath(mediaFolder: string): string {
  const filename = 'generated-image.png';
  return mediaFolder ? `${mediaFolder}/${filename}` : filename;
}

export function buildImageGenerationPrompt({
  prompt,
  mediaFolder,
}: ImageGenerationPromptOptions): string {
  const normalizedPrompt = prompt.trim();
  const normalizedMediaFolder = normalizeMediaFolder(mediaFolder);
  const targetInstruction = normalizedMediaFolder
    ? `Save the generated image inside the vault media folder: \`${normalizedMediaFolder}\`.`
    : 'Save the generated image inside the current vault, preferably in an existing images or attachments folder.';
  const examplePath = buildExamplePath(normalizedMediaFolder);

  return [
    'Generate an image for the user request below.',
    '',
    '<image_prompt>',
    normalizedPrompt,
    '</image_prompt>',
    '',
    'Use any image-generation capability available to the active CLI/provider, such as configured MCP tools, provider-native commands, or user-installed tools.',
    'Do not assume Grimoire has a direct image API integration.',
    targetInstruction,
    'Write the image file to the vault as a supported image file: png, jpg, jpeg, gif, or webp.',
    'When finished, respond concisely and include an Obsidian image embed on its own line.',
    '',
    `Example final embed: ![[${examplePath}]]`,
    '',
    'If the currently configured tools cannot generate or save an image, explain exactly what capability needs to be configured.',
  ].join('\n');
}
