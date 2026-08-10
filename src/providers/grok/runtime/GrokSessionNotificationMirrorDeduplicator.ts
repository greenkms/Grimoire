import type { GrokSessionNotificationSource } from './GrokSessionNotifications';

interface MirrorCandidate {
  fingerprint: string;
  sources: Set<GrokSessionNotificationSource>;
}

/** Suppresses adjacent copies of the same update mirrored across Grok notification methods. */
export class GrokSessionNotificationMirrorDeduplicator {
  private candidate: MirrorCandidate | null = null;

  shouldProcess(notification: unknown, source: GrokSessionNotificationSource): boolean {
    const fingerprint = this.createFingerprint(notification);
    if (!fingerprint) {
      this.candidate = null;
      return true;
    }

    if (this.candidate?.fingerprint !== fingerprint) {
      this.candidate = { fingerprint, sources: new Set([source]) };
      return true;
    }

    if (!this.candidate.sources.has(source)) {
      this.candidate.sources.add(source);
      return false;
    }

    // Identical consecutive chunks from one method may be legitimate streamed text.
    this.candidate = { fingerprint, sources: new Set([source]) };
    return true;
  }

  reset(): void {
    this.candidate = null;
  }

  private createFingerprint(notification: unknown): string | null {
    try {
      return JSON.stringify(notification) ?? null;
    } catch {
      return null;
    }
  }
}
