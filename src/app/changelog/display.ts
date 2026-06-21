interface ShouldShowWhatsNewInput {
  currentVersion: string;
  lastSeenVersion: string;
}

type SemverTuple = [number, number, number];

const STRICT_SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function parseStrictSemver(version: string): SemverTuple | null {
  const match = STRICT_SEMVER_PATTERN.exec(version);
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: SemverTuple, right: SemverTuple): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

export function shouldShowWhatsNew({
  currentVersion,
  lastSeenVersion,
}: ShouldShowWhatsNewInput): boolean {
  const current = parseStrictSemver(currentVersion);
  if (!current) {
    return false;
  }

  if (!lastSeenVersion) {
    return true;
  }

  const lastSeen = parseStrictSemver(lastSeenVersion);
  if (!lastSeen) {
    return true;
  }

  return compareSemver(current, lastSeen) > 0;
}
