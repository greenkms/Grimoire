import { createMockEl } from '@test/helpers/mockElement';

import { updateContextRowHasContent } from '@/features/chat/controllers/contextRowVisibility';

function createContextRow(browserIndicator: HTMLElement | null): HTMLElement {
  const editorIndicator = createMockEl();
  editorIndicator.addClass('grimoire-selection-indicator grimoire-hidden');
  const canvasIndicator = createMockEl();
  canvasIndicator.addClass('grimoire-canvas-indicator grimoire-hidden');
  const fileIndicator = createMockEl();
  fileIndicator.addClass('grimoire-file-indicator grimoire-hidden');
  const imagePreview = createMockEl();
  imagePreview.addClass('grimoire-image-preview grimoire-hidden');
  const lookup = new Map<string, unknown>([
    ['.grimoire-selection-indicator', editorIndicator],
    ['.grimoire-browser-selection-indicator', browserIndicator],
    ['.grimoire-canvas-indicator', canvasIndicator],
    ['.grimoire-file-indicator', fileIndicator],
    ['.grimoire-image-preview', imagePreview],
  ]);

  const contextRow = createMockEl();
  const toggle = contextRow.classList.toggle;
  contextRow.classList.toggle = jest.fn((cls: string, force?: boolean) => toggle(cls, force));
  contextRow.querySelector = jest.fn((selector: string) => lookup.get(selector) ?? null);
  return contextRow as unknown as HTMLElement;
}

describe('updateContextRowHasContent', () => {
  it('does not treat missing browser indicator as visible content', () => {
    const contextRowEl = createContextRow(null);

    expect(() => updateContextRowHasContent(contextRowEl)).not.toThrow();
    expect((contextRowEl.classList.toggle as jest.Mock)).toHaveBeenCalledWith('has-content', false);
  });

  it('treats browser indicator as visible only when it is not hidden', () => {
    const browserIndicator = createMockEl();
    browserIndicator.addClass('grimoire-browser-selection-indicator');
    const contextRowEl = createContextRow(browserIndicator);

    updateContextRowHasContent(contextRowEl);

    expect((contextRowEl.classList.toggle as jest.Mock)).toHaveBeenCalledWith('has-content', true);
  });
});
