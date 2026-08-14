import { createUtf8ChunkDecoder } from '@/utils/utf8Stream';

describe('createUtf8ChunkDecoder', () => {
  it('joins a multibyte character split across two chunks', () => {
    const bytes = Buffer.from('修改文件', 'utf8');
    const decoder = createUtf8ChunkDecoder();

    const first = decoder.write(bytes.subarray(0, 4));
    const second = decoder.write(bytes.subarray(4));

    expect(`${first}${second}`).toBe('修改文件');
    expect(`${first}${second}`).not.toContain('�');
  });

  it('decodes byte-by-byte streams without replacement characters', () => {
    const bytes = Buffer.from('输入 @ для快速', 'utf8');
    const decoder = createUtf8ChunkDecoder();

    let text = '';
    for (const byte of bytes) {
      text += decoder.write(Buffer.from([byte]));
    }
    text += decoder.end();

    expect(text).toBe('输入 @ для快速');
  });

  it('passes string chunks through unchanged', () => {
    const decoder = createUtf8ChunkDecoder();

    expect(decoder.write('already decoded')).toBe('already decoded');
  });

  it('accepts plain Uint8Array views', () => {
    const bytes = Buffer.from('引擎', 'utf8');
    const decoder = createUtf8ChunkDecoder();

    const first = decoder.write(new Uint8Array(bytes.subarray(0, 5)));
    const second = decoder.write(new Uint8Array(bytes.subarray(5)));

    expect(`${first}${second}`).toBe('引擎');
  });

  it('flushes an incomplete trailing sequence on end', () => {
    const bytes = Buffer.from('引', 'utf8');
    const decoder = createUtf8ChunkDecoder();

    decoder.write(bytes.subarray(0, 2));

    expect(decoder.end()).toBe('�');
  });
});
