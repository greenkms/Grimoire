import { t } from '../../../i18n/i18n';

export const INPUT_WRAPPER_MIN_HEIGHT = 106;
export const INPUT_WRAPPER_MAX_HEIGHT_RATIO = 0.7;

export interface InputResizeHandleOptions {
  inputWrapper: HTMLElement;
  viewport: HTMLElement;
}

export function createInputResizeHandle({
  inputWrapper,
  viewport,
}: InputResizeHandleOptions): () => void {
  const doc = inputWrapper.ownerDocument;
  const handle = inputWrapper.createDiv({ cls: 'grimoire-input-resize-handle' });
  handle.setAttribute('aria-label', t('chat.ui.composer.resizeInput'));
  inputWrapper.insertBefore(handle, inputWrapper.firstChild);

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;

  const clearDragState = () => {
    isDragging = false;
    doc.body?.classList.remove('grimoire-dragging-ns');
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;

    const maxHeight = Math.max(
      INPUT_WRAPPER_MIN_HEIGHT,
      viewport.clientHeight * INPUT_WRAPPER_MAX_HEIGHT_RATIO,
    );
    const nextHeight = Math.max(
      INPUT_WRAPPER_MIN_HEIGHT,
      Math.min(maxHeight, startHeight + startY - event.clientY),
    );

    inputWrapper.style.setProperty('--grimoire-input-wrapper-height', `${nextHeight}px`);
  };

  const onMouseUp = () => {
    clearDragState();
    doc.removeEventListener('mousemove', onMouseMove);
    doc.removeEventListener('mouseup', onMouseUp);
  };

  const onMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    isDragging = true;
    startY = event.clientY;
    startHeight = inputWrapper.offsetHeight;
    doc.body?.classList.add('grimoire-dragging-ns');
    doc.addEventListener('mousemove', onMouseMove);
    doc.addEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', onMouseDown);

  return () => {
    handle.removeEventListener('mousedown', onMouseDown);
    doc.removeEventListener('mousemove', onMouseMove);
    doc.removeEventListener('mouseup', onMouseUp);
    clearDragState();
    handle.remove();
  };
}
