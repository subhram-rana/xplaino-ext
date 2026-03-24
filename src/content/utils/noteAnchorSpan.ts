// src/content/utils/noteAnchorSpan.ts
// DOM utilities for zero-width anchor spans that pin note icons to text selections.
// No visible rendering — these spans exist only for getBoundingClientRect() positioning.

export const NOTE_ANCHOR_ATTR = 'data-xplaino-note-id';

/**
 * Inserts a zero-width <span> at the *end* of the given range and tags it with
 * the note ID so it can be found and removed later.
 */
export function injectNoteAnchorSpan(range: Range, noteId: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.setAttribute(NOTE_ANCHOR_ATTR, noteId);
  span.style.cssText =
    'display:inline;width:0;height:0;overflow:visible;pointer-events:none;opacity:0;';

  const endRange = range.cloneRange();
  endRange.collapse(false); // collapse to the end of the selection
  endRange.insertNode(span);
  return span;
}

/**
 * Removes all anchor spans with the given note ID from the document.
 */
export function removeNoteAnchorSpan(noteId: string): void {
  document
    .querySelectorAll(`[${NOTE_ANCHOR_ATTR}="${CSS.escape(noteId)}"]`)
    .forEach((el) => el.remove());
}
