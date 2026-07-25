export interface ContextSource {
  id: string;
  path: string;
  title: string;
  kind: 'vault-note' | 'markdown' | 'pdf';
}

export interface ContextSnippet {
  source: ContextSource;
  text: string;
  score: number;
  matchedTerms: string[];
}

export interface VaultSearchQuery {
  raw: string;
  terms: string[];
  maxResults: number;
  maxSnippetChars: number;
  excludedTags: string[];
  excludedFolders: string[];
}

export interface VaultSearchResult {
  query: VaultSearchQuery;
  snippets: ContextSnippet[];
}

export interface RelevantNote {
  path: string;
  title: string;
  score: number;
  reasons: Array<'backlink' | 'outlink' | 'tag' | 'folder' | 'text'>;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  providerId?: string;
  model?: string;
  systemPrompt: string;
  vaultFolders: string[];
  vaultFiles: string[];
  tags: string[];
  externalContextPaths: string[];
}

export interface IngestedDocument {
  source: ContextSource;
  text: string;
  metadata: Record<string, string>;
}

export interface DocumentIngestor {
  readonly id: string;
  canIngest(path: string, mimeType?: string): boolean;
  ingest(path: string, content: ArrayBuffer | string): Promise<IngestedDocument>;
}
