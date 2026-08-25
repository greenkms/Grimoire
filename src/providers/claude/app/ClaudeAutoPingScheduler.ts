import type { ChatMessage } from '../../../core/types/chat';

export interface TabPingActivity {
  /**
   * Signature (`${id}:${completedAt ?? 'pending'}`) of the newest message observed
   * for this tab, used to detect new activity - including a still-streaming
   * message finally completing.
   */
  lastObservedSignature: string | null;
  /**
   * Completion time of the last *live* (in-session) completed message, of either
   * role. Null until a second live completion follows the baseline observation.
   */
  lastLiveMessageAt: number | null;
  /** Consecutive auto-pings with no intervening genuine (non-auto-ping) turn. */
  consecutiveAutoPings: number;
}

export interface TabPingSnapshot {
  tabId: string;
  providerId: string;
  isActive: boolean;
  isStreaming: boolean;
  messages: ChatMessage[];
}

export interface AutoPingSettingsSnapshot {
  intervalMinutes: number;
  maxConsecutive: number;
}

export interface SelectTabsDueForPingResult {
  dueTabIds: string[];
  nextActivity: Map<string, TabPingActivity>;
}

function newestMessage(messages: ChatMessage[]): ChatMessage | null {
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

function signatureFor(msg: ChatMessage): string {
  return `${msg.id}:${msg.completedAt ?? 'pending'}`;
}

/**
 * Pure decision function: given the current snapshot of candidate tabs, the
 * scheduler's own in-memory activity ledger, the effective settings, and the
 * current time, decides which tabs are due for an auto-ping and returns the
 * updated ledger. No timers, no I/O, no mutation of inputs.
 *
 * The activity anchor is the newest message's *completion* time (any role), not
 * its send time: a long agentic turn already refreshes the cache through its own
 * internal request traffic, so anchoring to the send time would fire a redundant
 * ping the instant a turn longer than the interval finished.
 *
 * Restore-safety: the first observation of any tab is always a baseline capture
 * that can never be due, so a restored conversation with stale timestamps never
 * triggers a ping on plugin load.
 */
export function selectTabsDueForPing(
  tabs: TabPingSnapshot[],
  activityByTab: Map<string, TabPingActivity>,
  settings: AutoPingSettingsSnapshot,
  now: number,
): SelectTabsDueForPingResult {
  const nextActivity = new Map(activityByTab);
  const dueTabIds: string[] = [];
  const intervalMs = settings.intervalMinutes * 60_000;

  for (const tab of tabs) {
    const newest = newestMessage(tab.messages);
    if (!newest) continue;

    const signature = signatureFor(newest);
    const previous = nextActivity.get(tab.tabId);
    let current: TabPingActivity;

    if (!previous) {
      // First look at this tab this session: capture a baseline only.
      current = {
        lastObservedSignature: signature,
        lastLiveMessageAt: null,
        consecutiveAutoPings: 0,
      };
    } else if (signature !== previous.lastObservedSignature && newest.completedAt !== undefined) {
      // A genuinely new completed message since we last looked (new id, or the
      // same message finally finished streaming). An undefined completedAt
      // (still streaming) never moves the anchor.
      const pairedUser = newest.role === 'assistant' && tab.messages.length >= 2
        ? tab.messages[tab.messages.length - 2]
        : newest;
      const wasAutoPing = pairedUser?.role === 'user'
        ? pairedUser.isAutoPing === true
        : newest.isAutoPing === true;
      current = {
        lastObservedSignature: signature,
        lastLiveMessageAt: newest.completedAt,
        consecutiveAutoPings: wasAutoPing ? previous.consecutiveAutoPings + 1 : 0,
      };
    } else {
      current = previous;
    }
    nextActivity.set(tab.tabId, current);

    if (current.lastLiveMessageAt === null) continue;
    if (tab.isStreaming) continue;
    if (now - current.lastLiveMessageAt < intervalMs) continue;
    if (settings.maxConsecutive > 0 && current.consecutiveAutoPings >= settings.maxConsecutive) continue;

    dueTabIds.push(tab.tabId);
  }

  return { dueTabIds, nextActivity };
}
