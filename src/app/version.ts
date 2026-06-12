export function formatGrimoireVersion(manifest: { version?: string } | null | undefined): string {
  const version = manifest?.version?.trim();
  return `Grimoire v${version || 'unknown'}`;
}
