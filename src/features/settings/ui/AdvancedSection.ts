import { setIcon } from 'obsidian';

import { t } from '../../../i18n/i18n';

export interface AdvancedSectionOptions {
  count: number;
  id: string;
  isOpen: (id: string) => boolean;
  setOpen: (id: string, open: boolean) => Promise<void> | void;
  summary: string;
}

function setOpenState(
  toggle: HTMLElement,
  wrap: HTMLElement,
  open: boolean,
): void {
  toggle.toggleClass('is-open', open);
  wrap.toggleClass('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  wrap.setAttribute('aria-hidden', String(!open));
}

export function renderAdvancedSection(
  container: HTMLElement,
  opts: AdvancedSectionOptions,
): HTMLElement {
  const open = opts.isOpen(opts.id);
  const section = container.createDiv({ cls: 'grimoire-adv' });
  const toggle = section.createEl('button', {
    attr: {
      'aria-expanded': String(open),
      type: 'button',
    },
    cls: `grimoire-adv-toggle${open ? ' is-open' : ''}`,
  });

  const chevron = toggle.createSpan({ cls: 'grimoire-adv-chevron' });
  setIcon(chevron, 'chevron-right');

  const copy = toggle.createSpan({ cls: 'grimoire-adv-copy' });
  copy.createSpan({ cls: 'grimoire-adv-title', text: t('settings.advanced.title') });
  copy.createSpan({ cls: 'grimoire-adv-summary', text: opts.summary });
  toggle.createSpan({ cls: 'grimoire-adv-count', text: String(opts.count) });

  const wrap = section.createDiv({
    cls: `grimoire-adv-wrap${open ? ' is-open' : ''} grimoire-adv-wrap--no-transition`,
  });
  wrap.setAttribute('aria-hidden', String(!open));
  const inner = wrap.createDiv({ cls: 'grimoire-adv-inner' });
  const body = inner.createDiv({ cls: 'grimoire-adv-body' });

  const view = wrap.ownerDocument?.defaultView ?? window;
  view.requestAnimationFrame(() => {
    wrap.removeClass('grimoire-adv-wrap--no-transition');
  });

  toggle.addEventListener('click', () => {
    const next = !wrap.hasClass('is-open');
    setOpenState(toggle, wrap, next);
    void opts.setOpen(opts.id, next);
  });

  return body;
}
