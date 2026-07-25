export function normalizeExcludedFolder(folder: string): string {
  return folder
    .trim()
    .replace(/\\/gu, '/')
    .replace(/\/+/gu, '/')
    .replace(/^\/+|\/+$/gu, '');
}

export function normalizeExcludedFolders(folders: string[]): string[] {
  return Array.from(new Set(
    folders
      .map(normalizeExcludedFolder)
      .filter((folder) => folder.length > 0),
  ));
}

export function isPathInExcludedFolder(path: string, excludedFolders: string[]): boolean {
  const normalizedPath = normalizeExcludedFolder(path);

  return normalizeExcludedFolders(excludedFolders).some((folder) =>
    normalizedPath === folder || normalizedPath.startsWith(`${folder}/`)
  );
}
