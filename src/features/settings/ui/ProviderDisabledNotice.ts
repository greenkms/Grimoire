export function renderProviderDisabledNotice(
  container: HTMLElement,
  providerName: string,
): void {
  const notice = container.createDiv({ cls: 'grimoire-provider-disabled-notice' });
  const copy = notice.createEl('p', { cls: 'setting-item-description' });
  copy.createEl('strong', { text: `${providerName} is disabled.` });
  copy.appendText(' Enable it under General → Providers to use these settings and show its models in the selector.');
}
