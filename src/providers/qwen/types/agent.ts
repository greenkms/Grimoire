export interface QwenAgentDefinition {
  name: string;
  description: string;
  prompt: string;
  persistenceKey?: string;
  /** Provider-owned YAML keys which Grimoire does not interpret. */
  extraFrontmatter?: Record<string, unknown>;
}
