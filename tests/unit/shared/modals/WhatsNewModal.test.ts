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

import { showWhatsNewModal } from '@/shared/modals/WhatsNewModal';
import type { ChangelogRelease } from '@/app/changelog/types';

function collectText(el: MockElement): string {
  return [
    el.textContent,
    ...el.children.map(child => collectText(child)),
  ].filter(Boolean).join(' ');
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
    showWhatsNewModal({ app: mockApp, release });

    expect(lastModalInstance).toBeTruthy();
    expect(lastModalInstance.setTitle).toHaveBeenCalledWith('What\'s New in Grimoire v1.0.23');
    expect(lastModalInstance.modalEl.hasClass('grimoire-whats-new-modal')).toBe(true);
    expect(collectText(lastModalInstance.contentEl)).toContain('Released 2026-06-19');
    expect(collectText(lastModalInstance.contentEl)).toContain('Added');
    expect(collectText(lastModalInstance.contentEl)).toContain('What\'s New release modal.');
    expect(collectText(lastModalInstance.contentEl)).toContain('Changelog parsing support.');
    expect(collectText(lastModalInstance.contentEl)).toContain('Fixed');
    expect(collectText(lastModalInstance.contentEl)).toContain('Startup notification timing.');
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
});
