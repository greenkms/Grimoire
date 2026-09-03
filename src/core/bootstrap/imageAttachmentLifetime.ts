/**
 * In-memory lifetime of `ImageAttachment.data`.
 *
 * Attachment bytes are the largest thing a conversation holds - a single
 * screenshot is megabytes of base64, and every open conversation keeps its
 * messages in memory - so they are released once the conversation is saved.
 *
 * That is only safe when the provider can put them back. A provider whose
 * transcript stores the image itself rehydrates the bytes in
 * `hydrateConversationHistory`; a provider that never sees an image as data
 * cannot. Antigravity is the second kind: attachments reach `agy` as temp
 * files that the turn deletes, so this object is the only copy, and clearing
 * it loses the image for the rest of the session - the full-size viewer shows
 * an empty frame, and a restored draft would resend empty files.
 *
 * The release is therefore opt-in per provider, and the default is to keep the
 * bytes: a provider that forgets to declare the capability wastes memory,
 * while one that wrongly claims it loses user data.
 */

import type { ProviderConversationHistoryService } from '../providers/types';
import type { Conversation } from '../types';

/**
 * Clears attachment bytes the provider is able to restore, and leaves every
 * other attachment intact.
 */
export function releaseRestorableImageData(
  conversation: Conversation,
  historyService: ProviderConversationHistoryService,
): void {
  if (historyService.restoresImageAttachmentData !== true) {
    return;
  }

  // A pending fork's deep-cloned images have not reached provider storage yet,
  // so nothing would restore them.
  if (historyService.isPendingForkConversation(conversation)) {
    return;
  }

  for (const message of conversation.messages) {
    if (!message.images) {
      continue;
    }
    for (const image of message.images) {
      image.data = '';
    }
  }
}
