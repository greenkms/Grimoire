export function updateContextRowHasContent(contextRowEl: HTMLElement): void {
  const editorIndicator = contextRowEl.querySelector('.grimoire-selection-indicator');
  const browserIndicator = contextRowEl.querySelector('.grimoire-browser-selection-indicator');
  const canvasIndicator = contextRowEl.querySelector('.grimoire-canvas-indicator');
  const fileIndicator = contextRowEl.querySelector('.grimoire-file-indicator');
  const imagePreview = contextRowEl.querySelector('.grimoire-image-preview');

  const hasEditorSelection = !!editorIndicator && !editorIndicator.hasClass('grimoire-hidden');
  const hasBrowserSelection = !!browserIndicator && !browserIndicator.hasClass('grimoire-hidden');
  const hasCanvasSelection = !!canvasIndicator && !canvasIndicator.hasClass('grimoire-hidden');
  const hasFileChips = !!fileIndicator && fileIndicator.hasClass('grimoire-visible-flex');
  const hasImageChips = !!imagePreview && imagePreview.hasClass('grimoire-visible-flex');

  contextRowEl.classList.toggle(
    'has-content',
    hasEditorSelection || hasBrowserSelection || hasCanvasSelection || hasFileChips || hasImageChips
  );
}
