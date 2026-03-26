// src/content/utils/citationManager.ts
// Manages citation highlights on the live page DOM.
// Provides locate → scroll → highlight → toggle → cleanup operations.
// This is a pure DOM module with no React dependencies.

import { CitationDetail } from '@/api-services/WebpageChatService';

const MARK_ATTR = 'data-citation-highlight';
const MARK_STYLE =
  'background-color:transparent !important;color:inherit !important;' +
  'text-decoration:underline !important;text-decoration-style:dashed !important;' +
  'text-decoration-color:#0d9488 !important;text-decoration-thickness:2px !important;' +
  'text-underline-offset:3px !important;' +
  'box-decoration-break:clone !important;-webkit-box-decoration-break:clone !important;';

// =============================================================================
// XPath resolution
// =============================================================================

function resolveXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return (result.singleNodeValue as Element) ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Text-node-at-offset resolution
// =============================================================================

interface TextNodePos {
  node: Text;
  localOffset: number;
}

function getTextNodeAtOffset(element: Element, charOffset: number): TextNodePos | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let cumulative = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const t = node as Text;
    const len = t.textContent?.length ?? 0;
    if (cumulative + len > charOffset) {
      return { node: t, localOffset: charOffset - cumulative };
    }
    cumulative += len;
  }

  // Offset is exactly at the end — return last text node, end position
  const lastNode = node as Text | null;
  if (lastNode) {
    return { node: lastNode, localOffset: lastNode.textContent?.length ?? 0 };
  }
  return null;
}

// =============================================================================
// Range construction — primary strategy (XPath + offsets)
// =============================================================================

function buildRangeFromXPath(citation: CitationDetail): Range | null {
  const startEl = resolveXPath(citation.startXPath);
  const endEl = resolveXPath(citation.endXPath);
  if (!startEl || !endEl) return null;

  try {
    const range = document.createRange();
    const startPos = getTextNodeAtOffset(startEl, citation.startOffset);
    if (!startPos) {
      range.selectNodeContents(startEl);
    } else {
      range.setStart(startPos.node, startPos.localOffset);
    }

    const endPos = getTextNodeAtOffset(endEl, citation.endOffset);
    if (!endPos) {
      range.selectNodeContents(endEl);
      range.collapse(false);
    } else {
      range.setEnd(endPos.node, endPos.localOffset);
    }

    return range.collapsed ? null : range;
  } catch {
    return null;
  }
}

// =============================================================================
// Range construction — fallback strategy (fuzzy text search)
// =============================================================================

function buildRangeFromSnippets(
  textSnippetStart: string,
  textSnippetEnd: string
): Range | null {
  if (!textSnippetStart || !textSnippetEnd) return null;

  // Collect all visible text nodes with cumulative positions
  const textParts: { node: Text; start: number; end: number }[] = [];
  let pos = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName?.toUpperCase();
      if (
        tag === 'SCRIPT' ||
        tag === 'STYLE' ||
        tag === 'NOSCRIPT' ||
        tag === 'TEXTAREA'
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const len = t.textContent?.length ?? 0;
    if (len === 0) continue;
    textParts.push({ node: t, start: pos, end: pos + len });
    pos += len;
  }

  const fullText = textParts.map((p) => p.node.textContent ?? '').join('');

  const startIdx = fullText.indexOf(textSnippetStart);
  if (startIdx === -1) return null;

  const endSearch = fullText.indexOf(textSnippetEnd, startIdx);
  if (endSearch === -1) return null;
  const endIdx = endSearch + textSnippetEnd.length;

  const startPartInfo = textParts.find(
    (p) => p.start <= startIdx && p.end > startIdx
  );
  const endPartInfo = textParts.find(
    (p) => p.start < endIdx && p.end >= endIdx
  );
  if (!startPartInfo || !endPartInfo) return null;

  try {
    const range = document.createRange();
    range.setStart(startPartInfo.node, startIdx - startPartInfo.start);
    range.setEnd(endPartInfo.node, endIdx - endPartInfo.start);
    return range.collapsed ? null : range;
  } catch {
    return null;
  }
}

// =============================================================================
// Locate
// =============================================================================

export type LocationResult =
  | { found: true; range: Range }
  | { found: false };

export function locateCitation(citation: CitationDetail): LocationResult {
  // Primary: XPath + offsets
  const primaryRange = buildRangeFromXPath(citation);
  if (primaryRange) return { found: true, range: primaryRange };

  // Fallback: fuzzy snippet search
  const fallbackRange = buildRangeFromSnippets(
    citation.textSnippetStart,
    citation.textSnippetEnd
  );
  if (fallbackRange) return { found: true, range: fallbackRange };

  return { found: false };
}

// =============================================================================
// Highlight
// =============================================================================

function createMarkElement(chunkId: string): HTMLElement {
  const mark = document.createElement('mark');
  mark.setAttribute(MARK_ATTR, chunkId);
  mark.setAttribute('style', MARK_STYLE);
  return mark;
}

function wrapRangeInMark(range: Range, chunkId: string): HTMLElement | null {
  try {
    const mark = createMarkElement(chunkId);
    range.surroundContents(mark);
    return mark;
  } catch {
    // surroundContents fails when the range crosses element boundaries (e.g. heading-group chunks
    // that span an <h2> and several <p> siblings). Walk every text node that intersects the range
    // and wrap each in its own <mark> with the same chunkId, so deactivateCitation removes them all.
    try {
      const ancestor = range.commonAncestorContainer;
      const root =
        ancestor.nodeType === Node.ELEMENT_NODE
          ? (ancestor as Element)
          : ancestor.parentElement;
      if (!root) return null;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const marks: HTMLElement[] = [];
      let n: Node | null;

      while ((n = walker.nextNode())) {
        const text = n as Text;
        const len = text.length ?? 0;
        // Skip nodes that end before the range starts or begin after the range ends
        if (range.comparePoint(text, 0) > 0) continue;
        if (range.comparePoint(text, len) < 0) continue;

        const startOffset = text === range.startContainer ? range.startOffset : 0;
        const endOffset = text === range.endContainer ? range.endOffset : len;
        if (startOffset >= endOffset) continue;

        try {
          const nodeRange = document.createRange();
          nodeRange.setStart(text, startOffset);
          nodeRange.setEnd(text, endOffset);
          const m = createMarkElement(chunkId);
          nodeRange.surroundContents(m);
          marks.push(m);
        } catch {
          // Skip individual nodes that can't be wrapped
        }
      }

      return marks.length > 0 ? marks[0] : null;
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Unwrap
// =============================================================================

function unwrapMarks(chunkId: string): void {
  const marks = document.querySelectorAll(`[${MARK_ATTR}="${chunkId}"]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    const frag = document.createDocumentFragment();
    while (mark.firstChild) frag.appendChild(mark.firstChild);
    parent.replaceChild(frag, mark);
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Activate a citation: locate its text on the page, apply highlight, then scroll to it.
 * Scrolling after DOM insertion ensures the browser targets the final <mark> position.
 * Returns whether the citation could be located.
 */
export function activateCitation(chunkId: string, citation: CitationDetail): boolean {
  const result = locateCitation(citation);
  if (!result.found) return false;

  const mark = wrapRangeInMark(result.range, chunkId);
  if (!mark) return false;

  // Defer scroll until after the browser has finished painting the DOM mutation.
  // Using the direct mark reference avoids a querySelector race.
  setTimeout(() => {
    try {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // Ignore scroll failures
    }
  }, 0);

  return true;
}

/**
 * Deactivate a citation: remove all <mark> elements for this chunkId, restoring DOM.
 */
export function deactivateCitation(chunkId: string): void {
  unwrapMarks(chunkId);
}

/**
 * Check whether a citation is currently highlighted on the page.
 */
export function isCitationActive(chunkId: string): boolean {
  return document.querySelector(`[${MARK_ATTR}="${chunkId}"]`) !== null;
}

/**
 * Remove ALL citation highlights from the page (on sidebar close / chat clear).
 */
export function removeAllHighlights(): void {
  const marks = document.querySelectorAll(`[${MARK_ATTR}]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    const frag = document.createDocumentFragment();
    while (mark.firstChild) frag.appendChild(mark.firstChild);
    parent.replaceChild(frag, mark);
  }
}

// =============================================================================
// Answer text parsing
// =============================================================================

/** Pattern for inline citation markers: [[cite:chunk_4]] or [[cite:chunk_4,chunk_5]] */
export const CITE_PATTERN = /\[\[cite:([^\]]+)\]\]/g;

export interface ParsedCitation {
  /** Comma-separated raw chunkIds string as it appeared in the marker */
  raw: string;
  /** Parsed array of individual chunkIds */
  chunkIds: string[];
}

export interface ParsedAnswer {
  /** Answer text with [[cite:...]] replaced by CITE_N_PLACEHOLDER for ReactMarkdown */
  parsedText: string;
  /** Ordered list of citation groups, indexed by placeholder number (1-based) */
  citations: ParsedCitation[];
}

// =============================================================================
// Annotation pulsate (annotated text click → locate → scroll → 3× teal flash)
// =============================================================================

const PULSATE_ATTR = 'data-annotation-pulsate';

/**
 * Locate the annotated text on the live page using fuzzy snippet search,
 * scroll to it, then apply a 3× teal pulsate animation via WAAPI.
 * Silently no-ops if the text cannot be found.
 */
export function locateAndPulsateText(
  textSnippetStart: string,
  textSnippetEnd: string
): void {
  const range = buildRangeFromSnippets(textSnippetStart, textSnippetEnd);
  if (!range) return;

  // Scroll to the start of the range
  try {
    const startNode =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    if (startNode) {
      startNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch {
    // ignore scroll errors
  }

  // Wrap in a <mark> element for the animation
  const mark = document.createElement('mark');
  mark.setAttribute(PULSATE_ATTR, 'true');
  mark.setAttribute(
    'style',
    'background-color:transparent;border-radius:3px;padding:0 2px;' +
    'box-decoration-break:clone;-webkit-box-decoration-break:clone;'
  );

  let wrapped = false;
  try {
    range.surroundContents(mark);
    wrapped = true;
  } catch {
    try {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
      wrapped = true;
    } catch {
      // Cannot wrap — silently give up
    }
  }

  if (!wrapped) return;

  // 3× teal pulsate using Web Animations API (no CSS injection needed).
  // Semi-transparent teal so the underlying text remains readable.
  const anim = mark.animate(
    [
      { backgroundColor: 'transparent' },
      { backgroundColor: 'rgba(13,148,136,0.35)' },
      { backgroundColor: 'transparent' },
      { backgroundColor: 'rgba(13,148,136,0.35)' },
      { backgroundColor: 'transparent' },
      { backgroundColor: 'rgba(13,148,136,0.35)' },
      { backgroundColor: 'transparent' },
    ],
    { duration: 2100, easing: 'ease-in-out', fill: 'forwards' }
  );

  anim.onfinish = () => {
    // Unwrap the mark element, restoring original DOM
    const parent = mark.parentNode;
    if (!parent) return;
    const frag = document.createDocumentFragment();
    while (mark.firstChild) frag.appendChild(mark.firstChild);
    parent.replaceChild(frag, mark);
  };
}

/**
 * Parse [[cite:...]] markers in an answer string.
 * Replaces each with a `CITE_N_PLACEHOLDER` code span for ReactMarkdown rendering.
 */
export function parseAnswerCitations(answer: string): ParsedAnswer {
  const citations: ParsedCitation[] = [];
  let n = 0;

  const parsedText = answer.replace(CITE_PATTERN, (_match, inner: string) => {
    const chunkIds = inner
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    citations.push({ raw: inner, chunkIds });
    n++;
    return `\`CITE_${n}_PLACEHOLDER\``;
  });

  return { parsedText, citations };
}
