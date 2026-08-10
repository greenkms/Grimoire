import { GrokSessionNotificationMirrorDeduplicator } from '@/providers/grok/runtime/GrokSessionNotificationMirrorDeduplicator';
import {
  GROK_SESSION_UPDATE_NOTIFICATION_METHODS,
  GROK_WRAPPED_SESSION_NOTIFICATION_METHOD,
  isGrokTurnCompletedUpdate,
  parseGrokSessionNotification,
} from '@/providers/grok/runtime/GrokSessionNotifications';

describe('GrokSessionNotifications', () => {
  const notification = {
    sessionId: 'session-1',
    update: {
      content: { text: 'hello', type: 'text' },
      sessionUpdate: 'agent_message_chunk',
    },
  };

  it.each(GROK_SESSION_UPDATE_NOTIFICATION_METHODS)(
    'accepts the direct %s session update alias',
    (method) => {
      expect(parseGrokSessionNotification(method, notification)).toEqual(notification);
    },
  );

  it('unwraps only the exact xAI session notification envelope', () => {
    expect(parseGrokSessionNotification(GROK_WRAPPED_SESSION_NOTIFICATION_METHOD, {
      method: 'x.ai/session_notification',
      params: notification,
    })).toEqual(notification);
    expect(parseGrokSessionNotification(GROK_WRAPPED_SESSION_NOTIFICATION_METHOD, {
      method: '_x.ai/session_notification',
      params: notification,
    })).toBeNull();
    expect(parseGrokSessionNotification(GROK_WRAPPED_SESSION_NOTIFICATION_METHOD, notification))
      .toBeNull();
  });

  it('rejects malformed and unrelated notifications', () => {
    expect(parseGrokSessionNotification('session/update', notification)).toBeNull();
    expect(parseGrokSessionNotification('_x.ai/session/update', {
      sessionId: 'session-1',
      update: null,
    })).toBeNull();
    expect(parseGrokSessionNotification('_x.ai/session/update', {
      sessionId: ' ',
      update: notification.update,
    })).toBeNull();
  });

  it('recognizes Grok turn completion extension updates', () => {
    expect(isGrokTurnCompletedUpdate({ sessionUpdate: 'turn_completed' })).toBe(true);
    expect(isGrokTurnCompletedUpdate({ type: 'turn_completed' })).toBe(true);
    expect(isGrokTurnCompletedUpdate({ sessionUpdate: 'agent_message_chunk' })).toBe(false);
  });
});

describe('GrokSessionNotificationMirrorDeduplicator', () => {
  const notification = {
    sessionId: 'session-1',
    update: {
      content: { text: 'hello', type: 'text' },
      sessionUpdate: 'agent_message_chunk',
    },
  };

  it('suppresses copies mirrored across standard, direct, and wrapped channels', () => {
    const deduplicator = new GrokSessionNotificationMirrorDeduplicator();

    expect(deduplicator.shouldProcess(notification, 'standard')).toBe(true);
    expect(deduplicator.shouldProcess(notification, 'x.ai/session/update')).toBe(false);
    expect(deduplicator.shouldProcess(notification, '_x.ai/session_notification')).toBe(false);
  });

  it('preserves identical consecutive chunks from the same channel', () => {
    const deduplicator = new GrokSessionNotificationMirrorDeduplicator();

    expect(deduplicator.shouldProcess(notification, 'standard')).toBe(true);
    expect(deduplicator.shouldProcess(notification, 'standard')).toBe(true);
  });

  it('starts a fresh mirror candidate after reset', () => {
    const deduplicator = new GrokSessionNotificationMirrorDeduplicator();
    expect(deduplicator.shouldProcess(notification, 'standard')).toBe(true);
    deduplicator.reset();
    expect(deduplicator.shouldProcess(notification, 'x.ai/session/update')).toBe(true);
  });
});
