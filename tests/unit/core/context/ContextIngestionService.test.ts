import {
  ContextIngestionService,
  MarkdownIngestor,
  PdfIngestor,
} from '@/core/context/ContextIngestionService';

describe('ContextIngestionService', () => {
  it('ingests markdown text with source metadata', async () => {
    const service = new ContextIngestionService([new MarkdownIngestor()]);

    await expect(
      service.ingest('notes/Project Plan.md', '# Project\n\nDetails', 'text/markdown')
    ).resolves.toEqual({
      source: {
        id: 'notes/Project Plan.md',
        kind: 'markdown',
        path: 'notes/Project Plan.md',
        title: 'Project Plan',
      },
      text: '# Project\n\nDetails',
      metadata: {},
    });
  });

  it('rejects non-string markdown content', async () => {
    const ingestor = new MarkdownIngestor();

    await expect(
      ingestor.ingest('notes/Project.md', new ArrayBuffer(2))
    ).rejects.toThrow('Markdown ingestion requires text content');
  });

  it('rejects PDF ingestion when text extraction is unavailable', async () => {
    const ingestor = new PdfIngestor({ extractText: null });

    await expect(ingestor.ingest('files/Guide.pdf', new ArrayBuffer(2))).rejects.toThrow(
      'PDF text extraction is not available in this runtime'
    );
  });

  it('ingests PDF text with source metadata from an extractor', async () => {
    const buffer = new ArrayBuffer(2);
    const extractText = jest.fn(async (content: ArrayBuffer) => {
      expect(content).toBe(buffer);
      return 'Extracted PDF text';
    });
    const ingestor = new PdfIngestor({ extractText });

    await expect(ingestor.ingest('files/Guide.PDF', buffer)).resolves.toEqual({
      source: {
        id: 'files/Guide.PDF',
        kind: 'pdf',
        path: 'files/Guide.PDF',
        title: 'Guide',
      },
      text: 'Extracted PDF text',
      metadata: {},
    });
    expect(extractText).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported extensions', async () => {
    const service = new ContextIngestionService([new MarkdownIngestor()]);

    await expect(service.ingest('notes/Project.txt', 'plain text')).rejects.toThrow(
      'No ingestor available for notes/Project.txt'
    );
  });

  it('handles uppercase extensions and mime types in canIngest', () => {
    const markdown = new MarkdownIngestor();
    const pdf = new PdfIngestor({ extractText: null });

    expect(markdown.canIngest('notes/README.MD')).toBe(true);
    expect(markdown.canIngest('notes/readme.txt', 'text/markdown')).toBe(true);
    expect(pdf.canIngest('files/PAPER.PDF')).toBe(true);
    expect(pdf.canIngest('files/paper.bin', 'application/pdf')).toBe(true);
  });
});
