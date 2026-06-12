import type { ProviderSettingsReconciler } from '../../../core/providers/types';

export const antigravitySettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment() {
    return { changed: false, invalidatedConversations: [] };
  },

  normalizeModelVariantSettings() {
    return false;
  },
};
