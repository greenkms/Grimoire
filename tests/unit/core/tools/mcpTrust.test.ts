import { isTrustedReadOnlyMcpTool } from '@/core/tools/mcpTrust';

describe('mcpTrust', () => {
  it('trusts read-only Obsidian MCP tools by normalized server name', () => {
    expect(isTrustedReadOnlyMcpTool('mcp__obsidian__obsidian_simple_search')).toBe(true);
    expect(isTrustedReadOnlyMcpTool('mcp__mcp_obsidian__obsidian_get_file_contents')).toBe(true);
    expect(isTrustedReadOnlyMcpTool('mcp__mcp-obsidian__obsidian_list_files_in_dir')).toBe(true);
  });

  it('does not trust Obsidian MCP write tools or unknown MCP servers', () => {
    expect(isTrustedReadOnlyMcpTool('mcp__obsidian__obsidian_append_content')).toBe(false);
    expect(isTrustedReadOnlyMcpTool('mcp__obsidian__obsidian_delete_file')).toBe(false);
    expect(isTrustedReadOnlyMcpTool('mcp__filesystem__read_file')).toBe(false);
  });
});
