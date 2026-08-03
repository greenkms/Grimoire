import { createMockEl, type MockElement } from '@test/helpers/mockElement';

let lastModalInstance: any;
let createdButtons: any[] = [];

jest.mock('obsidian', () => {
  const actual = jest.requireActual('obsidian');

  class MockModal {
    app: any;
    modalEl: any;
    contentEl: any;

    constructor(app: any) {
      this.app = app;
      this.modalEl = createMockEl();
      this.contentEl = createMockEl();
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastModalInstance = this;
    }

    setTitle = jest.fn();

    open() {
      this.onOpen();
    }

    close() {
      this.onClose();
    }

    onOpen() {
      // Overridden by subclass
    }

    onClose() {
      // Overridden by subclass
    }
  }

  class MockSetting {
    constructor(_containerEl: any) {}

    addButton(cb: (btn: any) => void) {
      const btn: any = {
        _onClick: null as null | (() => void | Promise<void>),
        setButtonText: jest.fn().mockReturnThis(),
        setCta: jest.fn().mockReturnThis(),
        onClick: jest.fn((handler: () => void | Promise<void>) => {
          btn._onClick = handler;
          return btn;
        }),
      };
      createdButtons.push(btn);
      cb(btn);
      return this;
    }
  }

  return {
    ...actual,
    Modal: MockModal,
    Setting: MockSetting,
  };
});

import type { ChangelogRelease } from '@/app/changelog/types';
import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';

function collectText(el: MockElement): string {
  return [
    el.textContent,
    ...el.children.map(child => collectText(child)),
  ].filter(Boolean).join(' ');
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  lastModalInstance = null;
  createdButtons = [];
});

describe('showWhatsNewModal', () => {
  const mockApp = {} as any;
  const release: ChangelogRelease = {
    version: '1.0.23',
    date: '2026-06-19',
    categories: [
      {
        title: 'Added',
        items: ['What\'s New release modal.', 'Changelog parsing support.'],
      },
      {
        title: 'Fixed',
        items: ['Startup notification timing.'],
      },
    ],
  };

  it('renders release title, summary, categories, and items', () => {
    void showWhatsNewModal({
      app: mockApp,
      release,
      fullChangelogUrl: 'https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md',
    });

    expect(lastModalInstance).toBeTruthy();
    expect(lastModalInstance.setTitle).toHaveBeenCalledWith('What\'s New in Grimoire v1.0.23');
    expect(lastModalInstance.modalEl.hasClass('grimoire-whats-new-modal')).toBe(true);
    expect(collectText(lastModalInstance.contentEl)).toContain('Released 2026-06-19');
    expect(collectText(lastModalInstance.contentEl)).toContain('Added');
    expect(collectText(lastModalInstance.contentEl)).toContain('What\'s New release modal.');
    expect(collectText(lastModalInstance.contentEl)).toContain('Changelog parsing support.');
    expect(collectText(lastModalInstance.contentEl)).toContain('Fixed');
    expect(collectText(lastModalInstance.contentEl)).toContain('Startup notification timing.');
    const link = lastModalInstance.contentEl.querySelector('.grimoire-whats-new-link');
    expect(link?.textContent).toBe('Full changelog');
    expect(link?.getAttribute('href')).toBe('https://github.com/sandsaber/Grimoire/blob/main/CHANGELOG.md');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(createdButtons).toHaveLength(1);
    expect(createdButtons[0].setButtonText).toHaveBeenCalledWith('Got it');
    expect(createdButtons[0].setCta).toHaveBeenCalled();
  });

  it('calls onDismiss once, resolves, and empties content when Got it is clicked', async () => {
    const onDismiss = jest.fn().mockResolvedValue(undefined);
    const promise = showWhatsNewModal({ app: mockApp, release, onDismiss });

    await createdButtons[0]._onClick();
    await expect(promise).resolves.toBeUndefined();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(lastModalInstance.contentEl.children).toHaveLength(0);

    await createdButtons[0]._onClick();
    lastModalInstance.close();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('resolves without calling onDismiss when closed without primary action', async () => {
    const onDismiss = jest.fn();
    const promise = showWhatsNewModal({ app: mockApp, release, onDismiss });

    lastModalInstance.close();

    await expect(promise).resolves.toBeUndefined();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });

  it('calls onClose once and waits before resolving when closed without primary action', async () => {
    const onDismiss = jest.fn();
    let resolveClose!: () => void;
    const onClose = jest.fn(() => new Promise<void>(resolve => {
      resolveClose = resolve;
    }));
    const promise = showWhatsNewModal({ app: mockApp, release, onDismiss, onClose });
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    lastModalInstance.close();
    lastModalInstance.close();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    await flushPromises();
    expect(resolved).toBe(false);

    resolveClose();
    await expect(promise).resolves.toBeUndefined();
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });

  it('resolves when non-primary onClose rejects', async () => {
    const onClose = jest.fn().mockRejectedValue(new Error('settings write failed'));
    const promise = showWhatsNewModal({ app: mockApp, release, onClose });

    lastModalInstance.close();

    await expect(promise).resolves.toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });

  it('waits for pending onDismiss before resolving when closed during primary dismissal', async () => {
    let resolveDismiss!: () => void;
    const onDismiss = jest.fn(() => new Promise<void>(resolve => {
      resolveDismiss = resolve;
    }));
    const promise = showWhatsNewModal({ app: mockApp, release, onDismiss });
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });

    const clickPromise = createdButtons[0]._onClick();
    lastModalInstance.close();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    await flushPromises();
    expect(resolved).toBe(false);

    resolveDismiss();
    await clickPromise;
    await expect(promise).resolves.toBeUndefined();
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });

  it('closes and resolves when onDismiss rejects', async () => {
    const onDismiss = jest.fn().mockRejectedValue(new Error('settings write failed'));
    const promise = showWhatsNewModal({ app: mockApp, release, onDismiss });

    await expect(createdButtons[0]._onClick()).resolves.toBeUndefined();
    await expect(promise).resolves.toBeUndefined();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(lastModalInstance.contentEl.children).toHaveLength(0);
  });
});
