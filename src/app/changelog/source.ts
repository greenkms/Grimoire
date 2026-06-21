type ReadableAdapter = {
  read: (path: string) => Promise<string>;
};

type ManifestLike = {
  id?: string;
  dir?: string;
};

export function getBundledChangelogPath(manifest: ManifestLike | null | undefined): string {
  const dir = manifest?.dir?.trim();
  if (dir) {
    return `${dir.replace(/\/+$/, '')}/CHANGELOG.md`;
  }

  const id = manifest?.id?.trim() || 'grimoire';
  return `.obsidian/plugins/${id}/CHANGELOG.md`;
}

export async function readBundledChangelog(
  adapter: ReadableAdapter,
  manifest: ManifestLike | null | undefined,
): Promise<string | null> {
  try {
    return await adapter.read(getBundledChangelogPath(manifest));
  } catch {
    return null;
  }
}
