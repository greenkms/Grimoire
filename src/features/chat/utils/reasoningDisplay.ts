import { t } from '../../../i18n/i18n';

/** Localize reasoning levels shared by provider controls and response metadata. */
export function localizeReasoningLevel(value: string, fallback = value): string {
  switch (value.trim().toLowerCase()) {
    case 'low':
      return t('chat.ui.toolbar.effortLevels.low');
    case 'medium':
    case 'med':
      return t('chat.ui.toolbar.effortLevels.medium');
    case 'high':
      return t('chat.ui.toolbar.effortLevels.high');
    case 'xhigh':
    case 'extra-high':
      return t('chat.ui.toolbar.effortLevels.xhigh');
    case 'max':
    case 'maximum':
      return t('chat.ui.toolbar.effortLevels.max');
    default:
      return fallback;
  }
}
