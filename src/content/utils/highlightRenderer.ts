// src/content/utils/highlightRenderer.ts
/**
 * DOM utilities for applying and removing visual text highlights.
 *
 * Highlights are rendered as <mark> elements with a semi-transparent background
 * and a data attribute that ties them back to their backend ID.
 * Multi-block (cross-container) selections are handled by wrapping each
 * block's portion of the selection separately, mirroring the approach used
 * by textSelectionUnderline.ts.
 */

import { COLORS } from '../../constants/colors';
import { getCurrentTheme } from '../../constants/theme';

/** Data attribute used to identify and look up highlight mark elements. */
export const HIGHLIGHT_DATA_ATTR = 'data-xplaino-highlight-id';

// Default colours (theme-aware applied at runtime)
const HIGHLIGHT_BG_LIGHT = 'rgba(255, 235, 59, 0.40)';
const HIGHLIGHT_BG_DARK = 'rgba(255, 235, 59, 0.25)';

// Block-level element tag names (kept in sync with textSelectionUnderline.ts)
const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);

// ---------------------------------------------------------------------------
// Internal helpers (ported from textSelectionUnderline.ts)
// ---------------------------------------------------------------------------

function getBlockAncestor(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      if (BLOCK_ELEMENTS.has(el.tagName)) return el;
    }
    current = current.parentNode;
  }
  return null;
}

function isMultiBlockSelection(range: Range): boolean {
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);
  if (!startBlock || !endBlock) return false;
  return startBlock !== endBlock;
}

function findAncestorChildOf(node: Node, parent: Element): Element | null {
  let current: Node | null = node;
  while (current && current.parentNode !== parent) {
    current = current.parentNode;
  }
  return current as Element | null;
}

function findDeepestBlockWithContent(element: HTMLElement, range: Range): HTMLElement | null {
  const blockChildren = Array.from(element.children).filter(
    (child) => BLOCK_ELEMENTS.has(child.tagName)
  );
  if (blockChildren.length === 0) {
    return BLOCK_ELEMENTS.has(element.tagName) ? element : null;
  }
  for (const child of blockChildren) {
    try {
      const childRange = document.createRange();
      childRange.selectNodeContents(child);
      const intersects =
        range.compareBoundaryPoints(Range.END_TO_START, childRange) <= 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, childRange) >= 0;
      if (intersects) {
        const deeper = findDeepestBlockWithContent(child as HTMLElement, range);
        if (deeper) return deeper;
      }
    } catch {
      // skip
    }
  }
  return BLOCK_ELEMENTS.has(element.tagName) ? element : null;
}

function getBlocksInRange(range: Range): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);

  if (!startBlock || !endBlock) return blocks;
  if (startBlock === endBlock) return [startBlock];

  if (startBlock.parentNode === endBlock.parentNode) {
    blocks.push(startBlock);
    let current: Element | null = startBlock.nextElementSibling;
    while (current && current !== endBlock) {
      if (BLOCK_ELEMENTS.has(current.tagName)) blocks.push(current as HTMLElement);
      current = current.nextElementSibling;
    }
    blocks.push(endBlock);
    return blocks;
  }

  const commonAncestor = range.commonAncestorContainer;
  let container: Node | null = commonAncestor;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
  if (!container || container.nodeType !== Node.ELEMENT_NODE) return [startBlock, endBlock];

  const containerElement = container as Element;
  const startAncestor = findAncestorChildOf(startBlock, containerElement);
  const endAncestor = findAncestorChildOf(endBlock, containerElement);
  if (!startAncestor || !endAncestor) return [startBlock, endBlock];

  let foundStart = false;
  let foundEnd = false;
  for (const child of Array.from(containerElement.children)) {
    if (child === startAncestor) foundStart = true;
    if (foundStart && !foundEnd) {
      const deepest = findDeepestBlockWithContent(child as HTMLElement, range);
      if (deepest) {
        blocks.push(deepest);
      } else if (BLOCK_ELEMENTS.has(child.tagName)) {
        blocks.push(child as HTMLElement);
      }
    }
    if (child === endAncestor) {
      foundEnd = true;
      break;
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Mark element creation
// ---------------------------------------------------------------------------

function createMarkElement(
  highlightId: string,
  bgColor: string,
): HTMLElement {
  const mark = document.createElement('mark');
  mark.setAttribute(HIGHLIGHT_DATA_ATTR, highlightId);

  mark.style.backgroundColor = bgColor;
  mark.style.color = 'inherit';
  mark.style.borderRadius = '2px';
  mark.style.padding = '0';
  mark.style.cursor = 'pointer';
  // Inherit all font properties so the highlight doesn't alter text appearance
  mark.style.font = 'inherit';
  mark.style.fontSize = 'inherit';
  mark.style.fontFamily = 'inherit';
  mark.style.fontWeight = 'inherit';
  mark.style.fontStyle = 'inherit';
  mark.style.lineHeight = 'inherit';
  mark.style.verticalAlign = 'baseline';

  return mark;
}

/**
 * Wrap the portion of `block` that falls within `range` with a mark element.
 * Returns the created mark, or null if the portion is empty / wrapping failed.
 */
function wrapBlockPortion(
  block: HTMLElement,
  range: Range,
  highlightId: string,
  bgColor: string,
): HTMLElement | null {
  try {
    const blockRange = document.createRange();

    const startBlock = getBlockAncestor(range.startContainer);
    if (startBlock === block) {
      blockRange.setStart(range.startContainer, range.startOffset);
    } else {
      blockRange.setStart(block, 0);
    }

    const endBlock = getBlockAncestor(range.endContainer);
    if (endBlock === block) {
      blockRange.setEnd(range.endContainer, range.endOffset);
    } else {
      blockRange.setEndAfter(block.lastChild || block);
    }

    if (blockRange.collapsed || blockRange.toString().trim() === '') return null;

    const mark = createMarkElement(highlightId, bgColor);

    try {
      blockRange.surroundContents(mark);
      return mark;
    } catch {
      const contents = blockRange.extractContents();
      if (contents.textContent?.trim()) {
        mark.appendChild(contents);
        blockRange.insertNode(mark);
        return mark;
      }
      return null;
    }
  } catch (error) {
    console.error('[highlightRenderer] Error wrapping block portion:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a visual highlight to a browser Range.
 *
 * Creates one or more <mark> elements (one per block for multi-block
 * selections) and returns references to them so they can be removed later.
 *
 * @param range       The browser Range to highlight.
 * @param highlightId The backend ID — stored as a data attribute on each mark.
 * @param color       Optional highlight colour. Defaults to semi-transparent yellow.
 * @returns           Array of created mark elements, or empty array on failure.
 */
export async function applyHighlight(
  range: Range,
  highlightId: string,
  color?: string | null
): Promise<HTMLElement[]> {
  if (!range || range.collapsed) return [];

  try {
    const theme = await getCurrentTheme();
    const isDark = theme === 'dark';
    const bgColor = color ?? (isDark ? HIGHLIGHT_BG_DARK : HIGHLIGHT_BG_LIGHT);

    const markElements: HTMLElement[] = [];

    if (isMultiBlockSelection(range)) {
      const blocks = getBlocksInRange(range);
      for (const block of blocks) {
        const mark = wrapBlockPortion(block, range, highlightId, bgColor);
        if (mark) markElements.push(mark);
      }
    } else {
      // Single-block selection
      const clonedRange = range.cloneRange();
      const mark = createMarkElement(highlightId, bgColor);
      try {
        clonedRange.surroundContents(mark);
      } catch {
        const contents = clonedRange.extractContents();
        mark.appendChild(contents);
        clonedRange.insertNode(mark);
      }
      if (mark.textContent?.trim()) {
        markElements.push(mark);
      }
    }

    return markElements;
  } catch (error) {
    console.error('[highlightRenderer] Error applying highlight:', error);
    return [];
  }
}

/**
 * Remove all <mark> elements associated with a given highlight ID by unwrapping
 * their contents back into the parent (same approach as removeTextUnderline).
 */
export function removeHighlight(highlightId: string): void {
  const marks = document.querySelectorAll<HTMLElement>(
    `[${HIGHLIGHT_DATA_ATTR}="${CSS.escape(highlightId)}"]`
  );

  marks.forEach((mark) => {
    try {
      const parent = mark.parentNode;
      if (!parent) return;

      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    } catch (error) {
      console.error('[highlightRenderer] Error removing highlight mark:', error);
    }
  });
}

/**
 * Find the highlight ID for a DOM element (or its nearest ancestor) that is
 * a highlight mark. Returns null if the element is not inside a highlight.
 */
export function getHighlightIdFromElement(element: Element): string | null {
  let current: Element | null = element;
  while (current) {
    const id = current.getAttribute(HIGHLIGHT_DATA_ATTR);
    if (id) return id;
    current = current.parentElement;
  }
  return null;
}

/**
 * Return the last <mark> element (in DOM order) for a given highlight ID.
 * Used to anchor the hover dot at the end of the highlight.
 */
export function getLastMarkElement(highlightId: string): HTMLElement | null {
  const marks = document.querySelectorAll<HTMLElement>(
    `[${HIGHLIGHT_DATA_ATTR}="${CSS.escape(highlightId)}"]`
  );
  return marks.length > 0 ? marks[marks.length - 1] : null;
}

/**
 * Return the bounding rect of all mark elements for a given highlight ID.
 * Useful for positioning a remove popover.
 */
export function getHighlightBoundingRect(highlightId: string): DOMRect | null {
  const marks = document.querySelectorAll<HTMLElement>(
    `[${HIGHLIGHT_DATA_ATTR}="${CSS.escape(highlightId)}"]`
  );
  if (marks.length === 0) return null;

  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  marks.forEach((mark) => {
    const rect = mark.getBoundingClientRect();
    if (rect.top < top) top = rect.top;
    if (rect.left < left) left = rect.left;
    if (rect.right > right) right = rect.right;
    if (rect.bottom > bottom) bottom = rect.bottom;
  });

  return new DOMRect(left, top, right - left, bottom - top);
}

/**
 * Expose the COLORS constant for theme-aware usage in the popover.
 * (Imported here to keep all highlight visual config in one file.)
 */
export { COLORS };
