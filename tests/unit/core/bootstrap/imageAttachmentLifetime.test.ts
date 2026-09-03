import { releaseRestorableImageData } from '@/core/bootstrap/imageAttachmentLifetime';
import type { ProviderConversationHistoryService } from '@/core/providers/types';
import type { Conversation, ImageAttachment } from '@/core/types';

function createImage(data: string): ImageAttachment {
  return {
    id: 'img-1',
    name: 'screenshot.png',
    mediaType: 'image/png',
    data,
    size: 12,
    source: 'paste',
  };
}

function createConversation(images: ImageAttachment[]): Conversation {
  return {
    id: 'conv-1',
    providerId: 'antigravity',
    messages: [
      { role: 'user', content: 'look', images },
    ],
  } as unknown as Conversation;
}

function createHistoryService(
  overrides: Partial<ProviderConversationHistoryService> = {},
): ProviderConversationHistoryService {
  return {
    hydrateConversationHistory: jest.fn(),
    deleteConversationSession: jest.fn(),
    resolveSessionIdForConversation: jest.fn().mockReturnValue(null),
    isPendingForkConversation: jest.fn().mockReturnValue(false),
    buildForkProviderState: jest.fn().mockReturnValue({}),
    ...overrides,
  };
}

describe('releaseRestorableImageData', () => {
  it('keeps the data when the provider cannot restore it from its own history', () => {
    // agy receives attachments as temp files that the turn deletes, so nothing
    // outside this object holds the bytes. Dropping them here loses them.
    const conversation = createConversation([createImage('YmFzZTY0')]);

    releaseRestorableImageData(conversation, createHistoryService());

    expect(conversation.messages[0].images?.[0].data).toBe('YmFzZTY0');
  });

  it('drops the data when the provider restores it on hydration', () => {
    const conversation = createConversation([createImage('YmFzZTY0')]);

    releaseRestorableImageData(
      conversation,
      createHistoryService({ restoresImageAttachmentData: true }),
    );

    expect(conversation.messages[0].images?.[0].data).toBe('');
  });

  it('keeps the data of a pending fork even when the provider restores it', () => {
    // A pending fork's deep-cloned images are not in provider storage yet.
    const conversation = createConversation([createImage('YmFzZTY0')]);

    releaseRestorableImageData(
      conversation,
      createHistoryService({
        restoresImageAttachmentData: true,
        isPendingForkConversation: jest.fn().mockReturnValue(true),
      }),
    );

    expect(conversation.messages[0].images?.[0].data).toBe('YmFzZTY0');
  });

  it('leaves messages without attachments untouched', () => {
    const conversation = createConversation([]);
    conversation.messages.push({ role: 'assistant', content: 'ok' } as never);

    expect(() =>
      releaseRestorableImageData(
        conversation,
        createHistoryService({ restoresImageAttachmentData: true }),
      ),
    ).not.toThrow();
  });
});
