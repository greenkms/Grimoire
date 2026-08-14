import { StringDecoder } from 'node:string_decoder';

/**
 * Decodes a byte stream as UTF-8 without corrupting characters that straddle chunk
 * boundaries. Decoding each chunk on its own turns a split multibyte character into
 * replacement characters, which is visible in CJK and other non-ASCII CLI output.
 */
export interface Utf8ChunkDecoder {
  /** Decodes a chunk, holding back a trailing partial character until the next chunk. */
  write(chunk: Uint8Array | string): string;
  /** Flushes any incomplete trailing sequence once the stream ends. */
  end(): string;
}

export function createUtf8ChunkDecoder(): Utf8ChunkDecoder {
  const decoder = new StringDecoder('utf8');
  return {
    write: (chunk) => (typeof chunk === 'string' ? chunk : decoder.write(toBuffer(chunk))),
    end: () => decoder.end(),
  };
}

function toBuffer(chunk: Uint8Array): Buffer {
  return Buffer.isBuffer(chunk)
    ? chunk
    : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
}
