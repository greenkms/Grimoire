import type { ChatMessage } from '@/core/types/chat';
import {
  selectTabsDueForPing,
  type TabPingActivity,
  type TabPingSnapshot,
} from '@/providers/claude/app/ClaudeAutoPingScheduler';

const INTERVAL_MS = 40 * 60_000;

function userMsg(id: string, timestamp: number, isAutoPing = false): ChatMessage {
  return {
    id,
    role: 'user',
    content: 'x',
    timestamp,
    completedAt: timestamp,
    isAutoPing: isAutoPing || undefined,
  };
}

function assistantMsg(id: string, completedAt: number | undefined, isAutoPing = false): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: 'x',
    timestamp: completedAt ?? Date.now(),
    completedAt,
    isAutoPing: isAutoPing || undefined,
  };
}

function tab(id: string, messages: ChatMessage[], isStreaming = false): TabPingSnapshot {
  return { tabId: id, providerId: 'claude', isActive: true, isStreaming, messages };
}

describe('selectTabsDueForPing', () => {
  const settings = { intervalMinutes: 40, maxConsecutive: 0 };

  it('does not ping on first observation of a tab (restore-safety)', () => {
    const now = 1_000_000;
    const staleAt = now - INTERVAL_MS - 1;
    const t = tab('t1', [userMsg('m1', staleAt)]); // stale, would be "due" if seeded
    const result = selectTabsDueForPing([t], new Map(), settings, now);
    expect(result.dueTabIds).toEqual([]);
    expect(result.nextActivity.get('t1')).toEqual({
      lastObservedSignature: `m1:${staleAt}`,
      lastLiveMessageAt: null,
      consecutiveAutoPings: 0,
    });
  });

  it('becomes due once a live message follows the baseline and the interval elapses', () => {
    const t0 = 1_000_000;
    const baselineTab = tab('t1', [userMsg('m1', t0)]);
    const afterBaseline = selectTabsDueForPing([baselineTab], new Map(), settings, t0);

    const liveMessageAt = t0 + 5_000;
    const liveTab = tab('t1', [userMsg('m1', t0), userMsg('m2', liveMessageAt)]);
    const notYetDue = selectTabsDueForPing(
      [liveTab],
      afterBaseline.nextActivity,
      settings,
      liveMessageAt + 1_000,
    );
    expect(notYetDue.dueTabIds).toEqual([]);

    const due = selectTabsDueForPing(
      [liveTab],
      afterBaseline.nextActivity,
      settings,
      liveMessageAt + INTERVAL_MS,
    );
    expect(due.dueTabIds).toEqual(['t1']);
  });

  it('does not ping a tab that is currently streaming', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: `m1:${t0}`, lastLiveMessageAt: t0, consecutiveAutoPings: 0 }],
    ]);
    const t = tab('t1', [userMsg('m1', t0)], true);
    const result = selectTabsDueForPing([t], activity, settings, t0 + INTERVAL_MS);
    expect(result.dueTabIds).toEqual([]);
  });

  it('anchors to completion time so a turn longer than the interval does not fire a ping the instant it finishes', () => {
    // Regression case for the exact scenario raised during design review: a turn
    // takes 45 minutes (longer than the 40-minute interval). While it is running,
    // isStreaming guards it off entirely (see previous test). The moment it
    // completes, the activity anchor must be the completion time, not the
    // original send time 45 minutes ago - otherwise it would look instantly
    // overdue and fire a redundant ping right when the cache was just refreshed
    // by the turn's own internal traffic.
    const sentAt = 1_000_000;
    const completedAt = sentAt + 45 * 60_000;

    const baselineTab = tab('t1', [userMsg('u1', sentAt)]);
    const afterBaseline = selectTabsDueForPing([baselineTab], new Map(), settings, sentAt);

    const finishedTab = tab('t1', [userMsg('u1', sentAt), assistantMsg('a1', completedAt)], false);
    const rightAfterCompletion = selectTabsDueForPing(
      [finishedTab],
      afterBaseline.nextActivity,
      settings,
      completedAt,
    );
    expect(rightAfterCompletion.dueTabIds).toEqual([]); // not due - cache was just refreshed

    const stillNotDue = selectTabsDueForPing(
      [finishedTab],
      rightAfterCompletion.nextActivity,
      settings,
      completedAt + INTERVAL_MS - 1_000,
    );
    expect(stillNotDue.dueTabIds).toEqual([]);

    const dueLater = selectTabsDueForPing(
      [finishedTab],
      rightAfterCompletion.nextActivity,
      settings,
      completedAt + INTERVAL_MS,
    );
    expect(dueLater.dueTabIds).toEqual(['t1']);
  });

  it('does not treat a still-streaming assistant message as new completed activity', () => {
    const t0 = 1_000_000;
    const baselineTab = tab('t1', [userMsg('u1', t0)]);
    const afterBaseline = selectTabsDueForPing([baselineTab], new Map(), settings, t0);

    const streamingTab = tab('t1', [userMsg('u1', t0), assistantMsg('a1', undefined)], true);
    const midStream = selectTabsDueForPing(
      [streamingTab],
      afterBaseline.nextActivity,
      settings,
      t0 + INTERVAL_MS,
    );
    expect(midStream.dueTabIds).toEqual([]);
    // lastLiveMessageAt stays null - the assistant message has not completed yet.
    expect(midStream.nextActivity.get('t1')!.lastLiveMessageAt).toBeNull();
  });

  it('increments consecutiveAutoPings when the completed turn was our own auto-ping', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: 'seed', lastLiveMessageAt: t0, consecutiveAutoPings: 0 }],
    ]);
    const pingedAt = t0 + INTERVAL_MS;
    const t = tab('t1', [userMsg('ping-u', pingedAt, true), assistantMsg('ping-a', pingedAt + 500, true)]);
    const result = selectTabsDueForPing([t], activity, settings, pingedAt + 500);
    expect(result.nextActivity.get('t1')!.consecutiveAutoPings).toBe(1);
  });

  it('resets consecutiveAutoPings to 0 on a genuine (non-ping) completed turn', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: 'seed', lastLiveMessageAt: t0, consecutiveAutoPings: 2 }],
    ]);
    const repliedAt = t0 + 1_000;
    const t = tab('t1', [userMsg('u2', repliedAt, false), assistantMsg('a2', repliedAt + 500, false)]);
    const result = selectTabsDueForPing([t], activity, settings, repliedAt + 500);
    expect(result.nextActivity.get('t1')!.consecutiveAutoPings).toBe(0);
  });

  it('stops pinging once consecutiveAutoPings reaches a nonzero cap', () => {
    const t0 = 1_000_000;
    const capped = { intervalMinutes: 40, maxConsecutive: 2 };
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: `ping-a:${t0}`, lastLiveMessageAt: t0, consecutiveAutoPings: 2 }],
    ]);
    const t = tab('t1', [userMsg('ping-u', t0 - 500, true), assistantMsg('ping-a', t0, true)]);
    const result = selectTabsDueForPing([t], activity, capped, t0 + INTERVAL_MS);
    expect(result.dueTabIds).toEqual([]);
  });

  it('keeps pinging past the cap when maxConsecutive is 0 (unlimited)', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: `ping-a:${t0}`, lastLiveMessageAt: t0, consecutiveAutoPings: 99 }],
    ]);
    const t = tab('t1', [userMsg('ping-u', t0 - 500, true), assistantMsg('ping-a', t0, true)]);
    const result = selectTabsDueForPing([t], activity, settings, t0 + INTERVAL_MS);
    expect(result.dueTabIds).toEqual(['t1']);
  });

  it('ignores an empty candidate list, since scope filtering belongs to the caller', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>([
      ['t1', { lastObservedSignature: `m1:${t0}`, lastLiveMessageAt: t0, consecutiveAutoPings: 0 }],
    ]);
    const result = selectTabsDueForPing([], activity, settings, t0 + INTERVAL_MS);
    expect(result.dueTabIds).toEqual([]);
  });

  it('skips a tab with no messages at all', () => {
    const t = tab('t1', []);
    const result = selectTabsDueForPing([t], new Map(), settings, 1_000_000);
    expect(result.dueTabIds).toEqual([]);
    expect(result.nextActivity.has('t1')).toBe(false);
  });

  it('does not mutate the activity map it was given', () => {
    const t0 = 1_000_000;
    const activity = new Map<string, TabPingActivity>();
    const t = tab('t1', [userMsg('m1', t0)]);
    selectTabsDueForPing([t], activity, settings, t0);
    expect(activity.size).toBe(0);
  });
});
