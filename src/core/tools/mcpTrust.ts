const TRUSTED_READ_MCP_TOOLS: Record<string, Set<string>> = {
  obsidian: new Set([
    'obsidian_batch_get_file_contents',
    'obsidian_complex_search',
    'obsidian_get_file_contents',
    'obsidian_get_periodic_note',
    'obsidian_get_recent_changes',
    'obsidian_get_recent_periodic_notes',
    'obsidian_list_files_in_dir',
    'obsidian_list_files_in_vault',
    'obsidian_simple_search',
  ]),
};

export function isTrustedReadOnlyMcpTool(toolName: string): boolean {
  const parts = toolName.split('__');
  if (parts.length < 3 || parts[0] !== 'mcp') {
    return false;
  }

  const serverName = normalizeMcpServerName(parts[1] ?? '');
  const operationName = parts.slice(2).join('__');
  return TRUSTED_READ_MCP_TOOLS[serverName]?.has(operationName) === true;
}

function normalizeMcpServerName(serverName: string): string {
  return serverName
    .toLowerCase()
    .replace(/[-\s]+/g, '_')
    .replace(/^mcp_+/, '');
}
