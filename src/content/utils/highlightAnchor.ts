// src/content/utils/highlightAnchor.ts
/**
 * Utilities for building and resolving multi-strategy anchors for web highlights.
 *
 * A highlight anchor stores three independent strategies for locating the
 * highlighted text after page re-loads:
 *   1. XPath + character offset  – exact structural match
 *   2. Text quote (exact + context) – fuzzy substring match
 *   3. Body text position (start/end char offsets) – last resort
 *
 * On resolution, strategies are attempted in order and the first one that
 * produces a Range whose text matches the saved text is returned.
 */

import type {
  AnchorContainer,
  AnchorData,
  AnchorTextPosition,
  AnchorTextQuote,
} from '@/api-services/dto/WebHighlightDTO';

// ---------------------------------------------------------------------------
// XPath generation
// ---------------------------------------------------------------------------

/**
 * Generate a stable XPath expression for a DOM node, relative to document.body.
 * Uses element tag names and nth-of-type indices so it doesn't depend on IDs
 * or class names that may be dynamic.
 */
export function getXPath(node: Node): string {
  const parts: string[] = [];
  let current: Node | null = node;

  // Walk up to body (exclusive)
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.nodeType === Node.TEXT_NODE) {
      // For text nodes, record index among sibling text nodes
      const parent: Node | null = current.parentNode;
      if (parent) {
        let textIndex = 1;
        let sib: ChildNode | null = parent.firstChild;
        while (sib && sib !== current) {
          if (sib.nodeType === Node.TEXT_NODE) textIndex++;
          sib = sib.nextSibling;
        }
        parts.unshift(`text()[${textIndex}]`);
      }
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      const tag = el.tagName.toLowerCase();
      // Count preceding siblings of same tag
      let index = 1;
      let sib: Element | null = el.previousElementSibling;
      while (sib) {
        if (sib.tagName.toLowerCase() === tag) index++;
        sib = sib.previousElementSibling;
      }
      parts.unshift(`${tag}[${index}]`);
    }
    current = current.parentNode;
  }

  return '//' + parts.join('/');
}

/**
 * Resolve an XPath expression to the first matching node within document.body.
 * Returns null if the XPath is invalid or matches nothing.
 */
function resolveXPath(xpath: string): Node | null {
  try {
    const result = document.evaluate(
      xpath,
      document.body,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anchor container (XPath + offset)
// ---------------------------------------------------------------------------

/**
 * Convert a Range boundary (container node + character offset) into an
 * AnchorContainer using an XPath and the same offset value.
 */
export function buildAnchorContainer(node: Node, offset: number): AnchorContainer {
  return {
    xpath: getXPath(node),
    offset,
  };
}

// ---------------------------------------------------------------------------
// Body text position
// ---------------------------------------------------------------------------

/**
 * Compute the character start/end offsets of a Range within document.body.textContent.
 * Falls back to 0/0 if the body text cannot be computed.
 */
export function getBodyTextPosition(range: Range): AnchorTextPosition {
  try {
    const bodyText = document.body.textContent ?? '';
    const startRange = document.createRange();
    startRange.setStart(document.body, 0);
    startRange.setEnd(range.startContainer, range.startOffset);
    const start = startRange.toString().length;
    const end = start + range.toString().length;

    if (start < 0 || end > bodyText.length) {
      return { start: 0, end: 0 };
    }
    return { start, end };
  } catch {
    return { start: 0, end: 0 };
  }
}

// ---------------------------------------------------------------------------
// Text quote (exact + context)
// ---------------------------------------------------------------------------

/**
 * Build a TextQuote descriptor with the exact selected text and surrounding
 * context characters for fuzzy re-matching.
 */
export function getTextQuote(range: Range, contextLength = 32): AnchorTextQuote {
  const exact = range.toString();

  try {
    const bodyText = document.body.textContent ?? '';
    const startRange = document.createRange();
    startRange.setStart(document.body, 0);
    startRange.setEnd(range.startContainer, range.startOffset);
    const startIdx = startRange.toString().length;

    const prefix = bodyText.slice(Math.max(0, startIdx - contextLength), startIdx);
    const suffix = bodyText.slice(startIdx + exact.length, startIdx + exact.length + contextLength);

    return { exact, prefix, suffix };
  } catch {
    return { exact, prefix: '', suffix: '' };
  }
}

// ---------------------------------------------------------------------------
// Build full anchor
// ---------------------------------------------------------------------------

/**
 * Build a complete AnchorData from a live browser Range.
 */
export function buildAnchor(range: Range): AnchorData {
  return {
    startContainer: buildAnchorContainer(range.startContainer, range.startOffset),
    endContainer: buildAnchorContainer(range.endContainer, range.endOffset),
    textQuote: getTextQuote(range),
    textPosition: getBodyTextPosition(range),
  };
}

// ---------------------------------------------------------------------------
// Anchor resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to reconstruct a Range from an AnchorData using multiple strategies.
 *
 * Strategy 1 — XPath + offset:
 *   Resolve start/end container XPaths, create a Range, verify the text matches.
 *
 * Strategy 2 — Text quote (exact + prefix/suffix):
 *   Walk all text nodes in document.body, search for a substring matching
 *   `exact`. Among candidates, prefer the one whose surrounding context best
 *   matches `prefix`/`suffix`.
 *
 * Strategy 3 — Body text position:
 *   Walk text nodes and slice at the recorded character offsets.
 *
 * Returns null if no strategy yields a matching Range.
 */
export function resolveAnchor(anchor: AnchorData): Range | null {
  const exact = anchor.textQuote.exact;
  if (!exact.trim()) return null;

  // ---- Strategy 1: XPath ----
  try {
    const startNode = resolveXPath(anchor.startContainer.xpath);
    const endNode = resolveXPath(anchor.endContainer.xpath);

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, anchor.startContainer.offset);
      range.setEnd(endNode, anchor.endContainer.offset);

      // Verify the extracted text is close enough to the saved text
      const rangeText = range.toString();
      if (textSimilar(rangeText, exact)) {
        return range;
      }
    }
  } catch {
    // XPath strategy failed; try next
  }

  // ---- Strategy 2: Text quote search ----
  const textNodes = collectTextNodes(document.body);
  const bodyText = textNodes.map((n) => n.nodeValue ?? '').join('');

  // Collect all indices where `exact` appears in body text
  const candidates = findAllOccurrences(bodyText, exact);
  if (candidates.length > 0) {
    const best = pickBestCandidate(candidates, bodyText, anchor.textQuote);
    if (best !== -1) {
      const range = buildRangeFromBodyOffset(textNodes, best, best + exact.length);
      if (range) return range;
    }
  }

  // ---- Strategy 3: Body text position ----
  const { start, end } = anchor.textPosition;
  if (start >= 0 && end > start) {
    const range = buildRangeFromBodyOffset(textNodes, start, end);
    if (range) {
      const rangeText = range.toString();
      if (textSimilar(rangeText, exact)) {
        return range;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all non-empty text nodes under a root element via depth-first walk.
 * Skips nodes inside <script>, <style>, and xplaino shadow hosts so we don't
 * accidentally match inside extension UI.
 */
function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);

  function walk(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName)) return;
      // Skip xplaino shadow hosts
      if (el.id && el.id.startsWith('xplaino-')) return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if ((text.nodeValue ?? '').length > 0) {
        nodes.push(text);
      }
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  }

  walk(root);
  return nodes;
}

/** Find all starting indices of `needle` within `haystack`. */
function findAllOccurrences(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    indices.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return indices;
}

/**
 * Among candidate start indices, return the one whose surrounding context
 * best matches the saved prefix/suffix. Returns -1 if no candidates.
 */
function pickBestCandidate(
  candidates: number[],
  bodyText: string,
  textQuote: AnchorTextQuote
): number {
  if (candidates.length === 1) return candidates[0];

  let bestScore = -1;
  let bestIdx = candidates[0];

  for (const idx of candidates) {
    const prefix = bodyText.slice(Math.max(0, idx - textQuote.prefix.length), idx);
    const suffix = bodyText.slice(
      idx + textQuote.exact.length,
      idx + textQuote.exact.length + textQuote.suffix.length
    );
    const score = similarityScore(prefix, textQuote.prefix) + similarityScore(suffix, textQuote.suffix);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/**
 * Build a browser Range from character offsets within the concatenated text
 * of the provided text node list.
 */
function buildRangeFromBodyOffset(
  textNodes: Text[],
  startOffset: number,
  endOffset: number
): Range | null {
  try {
    let charCount = 0;
    let startNode: Text | null = null;
    let startNodeOffset = 0;
    let endNode: Text | null = null;
    let endNodeOffset = 0;

    for (const textNode of textNodes) {
      const len = (textNode.nodeValue ?? '').length;
      const nodeStart = charCount;
      const nodeEnd = charCount + len;

      if (startNode === null && startOffset >= nodeStart && startOffset <= nodeEnd) {
        startNode = textNode;
        startNodeOffset = startOffset - nodeStart;
      }

      if (endNode === null && endOffset >= nodeStart && endOffset <= nodeEnd) {
        endNode = textNode;
        endNodeOffset = endOffset - nodeStart;
      }

      if (startNode && endNode) break;
      charCount += len;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return range;
  } catch {
    return null;
  }
}

/** Returns true if two strings are considered equivalent for highlight matching. */
function textSimilar(a: string, b: string): boolean {
  // Normalise whitespace for comparison so minor DOM whitespace changes don't break matching
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  return normalize(a) === normalize(b);
}

/** Simple character overlap score between two strings (0 = no overlap). */
function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  let matches = 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  return matches;
}
