import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { HomeFileAdapter } from '@/core/storage/HomeFileAdapter';

describe('HomeFileAdapter', () => {
  let root: string;
  let adapter: HomeFileAdapter;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'grimoire-home-adapter-'));
    adapter = new HomeFileAdapter(root);
  });

  afterEach(async () => {
    await fs.rm(root, { force: true, recursive: true });
  });

  it('reads and writes paths under the home root', async () => {
    await adapter.write('notes/hello.md', 'hi');
    await expect(adapter.read('notes/hello.md')).resolves.toBe('hi');
    await expect(adapter.exists('notes/hello.md')).resolves.toBe(true);
  });

  it('rejects path traversal outside the home root', async () => {
    await expect(adapter.read('../outside.txt')).rejects.toThrow(
      'Path escapes home adapter root',
    );
    await expect(adapter.write('../../etc/passwd', 'nope')).rejects.toThrow(
      'Path escapes home adapter root',
    );
  });
});
