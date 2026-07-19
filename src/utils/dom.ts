/**
 * Creates a detached element with Obsidian's DOM helpers while preserving the
 * document that owns the surrounding UI (including pop-out windows).
 */
export function createDetachedEl<K extends keyof HTMLElementTagNameMap>(
  ownerDocument: Document,
  tagName: K,
  options?: DomElementInfo | string,
): HTMLElementTagNameMap[K] {
  const element = ownerDocument.body.createEl(tagName, options);
  element.detach();
  return element;
}
