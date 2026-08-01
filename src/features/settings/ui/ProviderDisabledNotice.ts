import { t } from '../../../i18n/i18n';

export function renderProviderDisabledNotice(
  container: HTMLElement,
  providerName: string,
): void {
  const notice = container.createDiv({ cls: 'grimoire-provider-disabled-notice' });
  const copy = notice.createEl('p', { cls: 'setting-item-description' });
  copy.createEl('strong', {
    text: t('settings.provider.disabledTitle', { provider: providerName }),
  });
  copy.appendText(` ${t('settings.provider.disabledDesc')}`);
}
