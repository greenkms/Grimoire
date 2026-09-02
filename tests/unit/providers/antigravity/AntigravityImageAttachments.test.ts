import fs from 'node:fs';
import path from 'node:path';

import type { ImageAttachment } from '@/core/types';
import {
  attachAntigravityImages,
  toAntigravityAttachmentFilename,
} from '@/providers/antigravity/runtime/AntigravityImageAttachments';

// A 1x1 PNG: small enough to inline, real enough that the decoded bytes carry
// a signature a truncated or double-encoded write would not reproduce.
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function createImage(overrides: Partial<ImageAttachment> = {}): ImageAttachment {
  return {
    data: PNG_BASE64,
    id: 'img-1',
    mediaType: 'image/png',
    name: 'diagram.png',
    size: 70,
    source: 'paste',
    ...overrides,
  };
}

describe('attachAntigravityImages', () => {
  it('leaves the prompt untouched and writes nothing when there are no images', () => {
    const bundle = attachAntigravityImages('Describe the defect', []);

    expect(bundle.prompt).toBe('Describe the defect');
    expect(bundle.paths).toEqual([]);
    expect(bundle.directory).toBeNull();
    // A no-op cleanup must stay callable so the caller needs no null check.
    expect(() => bundle.cleanup()).not.toThrow();
  });

  it('writes the decoded image to a temp file and puts its absolute path in the prompt', () => {
    const bundle = attachAntigravityImages('Describe the defect', [createImage()]);

    try {
      expect(bundle.paths).toHaveLength(1);
      const filePath = bundle.paths[0];
      expect(path.isAbsolute(filePath)).toBe(true);
      expect(fs.readFileSync(filePath).subarray(0, 4)).toEqual(PNG_SIGNATURE);
      // agy has no image flag, so the path is the whole channel: the prompt
      // must carry it verbatim or the attachment is invisible to the agent.
      expect(bundle.prompt).toContain(filePath);
      expect(bundle.prompt.startsWith('Describe the defect')).toBe(true);
    } finally {
      bundle.cleanup();
    }
  });

  it('numbers every attachment so two files with one name cannot collide', () => {
    const bundle = attachAntigravityImages('Compare these', [
      createImage({ id: 'a' }),
      createImage({ id: 'b' }),
    ]);

    try {
      expect(bundle.paths).toHaveLength(2);
      expect(new Set(bundle.paths).size).toBe(2);
      expect(bundle.paths.every((filePath) => fs.existsSync(filePath))).toBe(true);
    } finally {
      bundle.cleanup();
    }
  });

  it('skips an attachment whose media type is not an image', () => {
    const bundle = attachAntigravityImages('Read this', [
      createImage({ mediaType: 'application/pdf' as ImageAttachment['mediaType'], name: 'manual.pdf' }),
      createImage({ id: 'img-2', name: 'photo.png' }),
    ]);

    try {
      expect(bundle.paths).toHaveLength(1);
      expect(bundle.paths[0]).toContain('photo.png');
    } finally {
      bundle.cleanup();
    }
  });

  it('keeps the turn alive when one attachment cannot be written', () => {
    const failing = jest
      .spyOn(fs, 'writeFileSync')
      .mockImplementationOnce(() => {
        throw new Error('EACCES');
      });

    const bundle = attachAntigravityImages('Describe these', [
      createImage({ id: 'a', name: 'broken.png' }),
      createImage({ id: 'b', name: 'good.png' }),
    ]);

    try {
      // Losing one attachment must not cost the user the whole answer.
      expect(bundle.paths).toHaveLength(1);
      expect(bundle.paths[0]).toContain('good.png');
      expect(bundle.prompt).toContain(bundle.paths[0]);
    } finally {
      bundle.cleanup();
      failing.mockRestore();
    }
  });

  it('reports a failed attachment to the caller instead of dropping it silently', () => {
    const failing = jest
      .spyOn(fs, 'writeFileSync')
      .mockImplementationOnce(() => {
        throw new Error('EACCES');
      });
    const onError = jest.fn();

    const bundle = attachAntigravityImages('Describe this', [createImage({ name: 'broken.png' })], onError);

    try {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'broken.png' }));
    } finally {
      bundle.cleanup();
      failing.mockRestore();
    }
  });

  it('removes the whole temp directory on cleanup', () => {
    const bundle = attachAntigravityImages('Describe the defect', [createImage()]);
    const directory = bundle.directory as string;
    expect(fs.existsSync(directory)).toBe(true);

    bundle.cleanup();

    expect(fs.existsSync(directory)).toBe(false);
  });

  it('survives a second cleanup call', () => {
    const bundle = attachAntigravityImages('Describe the defect', [createImage()]);

    bundle.cleanup();

    expect(() => bundle.cleanup()).not.toThrow();
  });
});

describe('toAntigravityAttachmentFilename', () => {
  it('keeps a safe name as is', () => {
    expect(toAntigravityAttachmentFilename(createImage({ name: 'defect-01.png' }), 0)).toBe('defect-01.png');
  });

  it('replaces characters that are unsafe in a file name', () => {
    // A pasted name can carry separators; joining it raw would escape the
    // temp directory the cleanup deletes.
    expect(toAntigravityAttachmentFilename(createImage({ name: '../../etc/passwd.png' }), 0))
      .toBe('.._.._etc_passwd.png');
  });

  it('derives an extension from the media type when the name has none', () => {
    expect(toAntigravityAttachmentFilename(createImage({ name: 'scan' }), 0)).toBe('scan.png');
    expect(toAntigravityAttachmentFilename(
      createImage({ mediaType: 'image/jpeg', name: 'scan' }),
      0,
    )).toBe('scan.jpg');
  });

  it('falls back to a positional name when the attachment has none', () => {
    expect(toAntigravityAttachmentFilename(createImage({ name: '' }), 2)).toBe('image-3.png');
  });
});
