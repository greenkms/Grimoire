import type { DocumentIngestor, IngestedDocument } from './types';

type PdfTextExtractor = (content: ArrayBuffer) => Promise<string>;

export class ContextIngestionService {
  constructor(private readonly ingestors: DocumentIngestor[]) {}

  async ingest(
    path: string,
    content: ArrayBuffer | string,
    mimeType?: string
  ): Promise<IngestedDocument> {
    const ingestor = this.ingestors.find((candidate) =>
      candidate.canIngest(path, mimeType)
    );

    if (!ingestor) {
      throw new Error(`No ingestor available for ${path}`);
    }

    return ingestor.ingest(path, content);
  }
}

export class MarkdownIngestor implements DocumentIngestor {
  readonly id = 'markdown';

  canIngest(path: string, mimeType?: string): boolean {
    return hasExtension(path, '.md') || normalizeMimeType(mimeType) === 'text/markdown';
  }

  async ingest(path: string, content: ArrayBuffer | string): Promise<IngestedDocument> {
    if (typeof content !== 'string') {
      throw new Error('Markdown ingestion requires text content');
    }

    return {
      source: {
        id: path,
        kind: 'markdown',
        path,
        title: titleFromPath(path),
      },
      text: content,
      metadata: {},
    };
  }
}

export class PdfIngestor implements DocumentIngestor {
  readonly id = 'pdf';

  constructor(private readonly options: { extractText: PdfTextExtractor | null }) {}

  canIngest(path: string, mimeType?: string): boolean {
    return hasExtension(path, '.pdf') || normalizeMimeType(mimeType) === 'application/pdf';
  }

  async ingest(path: string, content: ArrayBuffer | string): Promise<IngestedDocument> {
    if (!(content instanceof ArrayBuffer)) {
      throw new Error('PDF ingestion requires binary content');
    }

    if (this.options.extractText === null) {
      throw new Error('PDF text extraction is not available in this runtime');
    }

    return {
      source: {
        id: path,
        kind: 'pdf',
        path,
        title: titleFromPath(path),
      },
      text: await this.options.extractText(content),
      metadata: {},
    };
  }
}

function hasExtension(path: string, extension: string): boolean {
  return path.toLowerCase().endsWith(extension);
}

function normalizeMimeType(mimeType: string | undefined): string | undefined {
  return mimeType?.toLowerCase();
}

function titleFromPath(path: string): string {
  const fileName = path.split(/[\\/]/u).pop() ?? path;

  return fileName.replace(/\.[^.\\/]*$/u, '');
}
