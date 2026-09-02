/**
 * Image attachments for `agy`.
 *
 * agy exposes no image flag and its stream-json `user` event carries `content`
 * as a plain string, so an attachment cannot travel with the turn the way it
 * does for providers with content blocks. What agy does have is file access:
 * measured on 2026-09-03 against agy on Windows, the agent opens an absolute
 * path handed to it in the prompt, including a path outside the workspace and
 * without `--add-dir`. Attachments are therefore materialized as temp files
 * and referenced by path.
 *
 * The files hold user data, so the caller must run `cleanup()` for every turn
 * that created a bundle - including cancelled and failed ones, unlike the agy
 * log, which is deliberately preserved on failure for diagnosis.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ImageAttachment } from '../../../core/types';

export interface AntigravityImageAttachmentBundle {
  /** Removes the temp directory. Safe to call more than once. */
  cleanup: () => void;
  /** Temp directory holding the attachments, or null when none were written. */
  directory: string | null;
  /** Absolute paths of the attachments handed to agy, in prompt order. */
  paths: string[];
  /** The prompt with the attachment paths appended. */
  prompt: string;
}

/**
 * A file name safe to join onto the temp directory. A pasted attachment name
 * is user input: separators and `..` in it would otherwise write outside the
 * directory that `cleanup()` deletes.
 */
export function toAntigravityAttachmentFilename(image: ImageAttachment, index: number): string {
  const base = (image.name ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '_') || `image-${index + 1}`;
  if (base.includes('.')) {
    return base;
  }
  const subtype = image.mediaType.split('/')[1] ?? 'img';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype;
  return `${base}.${extension}`;
}

function buildAttachmentPromptSection(prompt: string, paths: string[]): string {
  if (paths.length === 0) {
    return prompt;
  }
  const list = paths.map((filePath) => `- ${filePath}`).join('\n');
  const header = paths.length === 1
    ? 'The user attached an image. Open this file to view it:'
    : 'The user attached images. Open these files to view them:';
  return `${prompt}\n\n${header}\n${list}`;
}

/**
 * Writes `images` to a fresh temp directory and returns the prompt with their
 * absolute paths appended.
 *
 * A single attachment that cannot be written is reported through `onError` and
 * skipped: losing one image must not cost the user the answer to the rest of
 * the turn.
 */
export function attachAntigravityImages(
  prompt: string,
  images?: ImageAttachment[],
  onError?: (image: ImageAttachment, error: unknown) => void,
): AntigravityImageAttachmentBundle {
  const noop: AntigravityImageAttachmentBundle = {
    cleanup: () => {},
    directory: null,
    paths: [],
    prompt,
  };

  if (!images || images.length === 0) {
    return noop;
  }

  const usable = images.filter((image) => image.mediaType.startsWith('image/'));
  if (usable.length === 0) {
    return noop;
  }

  let directory: string;
  try {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grimoire-antigravity-images-'));
  } catch (error) {
    for (const image of usable) {
      onError?.(image, error);
    }
    return noop;
  }

  const cleanup = (): void => {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch {
      // Best-effort: the OS reclaims its temp directory, and a failure here
      // must never surface as a turn error.
    }
  };

  const paths: string[] = [];
  for (let index = 0; index < usable.length; index += 1) {
    const image = usable[index];
    // The positional prefix keeps two attachments sharing one name apart.
    const filePath = path.join(directory, `${index + 1}-${toAntigravityAttachmentFilename(image, index)}`);
    try {
      fs.writeFileSync(filePath, Buffer.from(image.data, 'base64'));
      paths.push(filePath);
    } catch (error) {
      onError?.(image, error);
    }
  }

  if (paths.length === 0) {
    cleanup();
    return noop;
  }

  return {
    cleanup,
    directory,
    paths,
    prompt: buildAttachmentPromptSection(prompt, paths),
  };
}
