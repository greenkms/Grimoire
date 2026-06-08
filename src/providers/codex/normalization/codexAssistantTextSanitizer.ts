const MEMORY_CITATION_BLOCK_PATTERN = /<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/g;
const MEMORY_CITATION_LINE_PATTERN = /^(?:MEMORY\.md|rollout_summaries\/[^:\s]+|skills\/[^:\s]+):\d+(?:-\d+)?\|note=\[[^\]\r\n]*\](?:\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;

interface SanitizeCodexAssistantTextOptions {
  trimTrailingWhitespace?: boolean;
}

export function sanitizeCodexAssistantText(
  text: string,
  options: SanitizeCodexAssistantTextOptions = {},
): string {
  if (!text) {
    return '';
  }

  const withoutBlocks = text.replace(MEMORY_CITATION_BLOCK_PATTERN, '');
  const lines = withoutBlocks.split('\n');
  const visibleLines = lines.filter(line => !MEMORY_CITATION_LINE_PATTERN.test(line.trim()));
  const sanitized = visibleLines.join('\n');

  const normalized = sanitized.replace(/\n{3,}/g, '\n\n');
  return options.trimTrailingWhitespace ? normalized.trimEnd() : normalized;
}
