// src/content/utils/pageChunker.ts
// DOM-aware page chunker that produces chunks with full anchor metadata.
// Priority: heading+paragraphs > standalone <p> > <li> > <tr> > sliding window fallback.

import {
  findMainContentContainer,
  isElementVisible,
  isExtensionElement,
  shouldExcludeByPattern,
  EXCLUDED_TAGS,
  EXCLUDED_CONTAINER_TAGS,
} from './pageContentExtractor';

export interface ChunkMetadata {
  startXPath: string;
  endXPath: string;
  startOffset: number;
  endOffset: number;
  cssSelector: string;
  textSnippetStart: string;
  textSnippetEnd: string;
}

export interface PageChunk {
  chunkId: string;
  text: string;
  metadata: ChunkMetadata;
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const APPROX_TOKENS_PER_CHAR = 0.25; // ~4 chars per token
const WINDOW_TARGET_TOKENS = 300;
const WINDOW_OVERLAP_TOKENS = 50;
const WINDOW_TARGET_CHARS = Math.round(WINDOW_TARGET_TOKENS / APPROX_TOKENS_PER_CHAR);
const WINDOW_OVERLAP_CHARS = Math.round(WINDOW_OVERLAP_TOKENS / APPROX_TOKENS_PER_CHAR);

// =============================================================================
// XPath helpers
// =============================================================================

function getElementXPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current.tagName) {
    const parentEl: Element | null = current.parentElement;
    if (!parentEl) {
      parts.unshift(current.tagName.toLowerCase());
      break;
    }
    const tagName = current.tagName.toLowerCase();
    const tag = current.tagName;
    const siblingsOfSameTag = Array.from(parentEl.children).filter(
      (c: Element) => c.tagName === tag
    );
    const index = siblingsOfSameTag.indexOf(current) + 1;
    parts.unshift(siblingsOfSameTag.length > 1 ? `${tagName}[${index}]` : tagName);
    current = parentEl;
  }

  return '/' + parts.join('/');
}

// =============================================================================
// CSS selector helpers
// =============================================================================

function getCssSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current.tagName) {
    const parentEl: Element | null = current.parentElement;
    if (!parentEl) break;

    const tagName = current.tagName.toLowerCase();
    const tag = current.tagName;
    const siblingsOfSameTag = Array.from(parentEl.children).filter(
      (c: Element) => c.tagName === tag
    );
    const index = siblingsOfSameTag.indexOf(current) + 1;
    parts.unshift(
      siblingsOfSameTag.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName
    );
    current = parentEl;
  }

  return parts.join(' > ') || el.tagName.toLowerCase();
}

// =============================================================================
// Text extraction
// =============================================================================

function getElementText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// =============================================================================
// Chunk builder
// =============================================================================

function buildChunk(
  index: number,
  startEl: Element,
  endEl: Element,
  text: string
): PageChunk {
  const trimmedText = text.replace(/\s+/g, ' ').trim();
  const endOffset = (endEl.textContent ?? '').length;

  return {
    chunkId: `chunk_${index}`,
    text: trimmedText,
    metadata: {
      startXPath: getElementXPath(startEl),
      endXPath: getElementXPath(endEl),
      startOffset: 0,
      endOffset,
      cssSelector: getCssSelector(startEl),
      textSnippetStart: trimmedText.slice(0, 60),
      textSnippetEnd: trimmedText.slice(-60),
    },
  };
}

// =============================================================================
// Block collection
// =============================================================================

interface Block {
  element: HTMLElement;
  tag: string;
  text: string;
}

const BLOCK_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'LI', 'TR', 'BLOCKQUOTE', 'FIGCAPTION', 'TD', 'TH',
]);

const CONTAINER_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'SPAN']);

function hasBlockChildren(el: Element): boolean {
  for (const child of el.children) {
    if (BLOCK_TAGS.has(child.tagName) || CONTAINER_TAGS.has(child.tagName)) return true;
  }
  return false;
}

function collectBlocks(root: Element): Block[] {
  const skipContainers = root !== document.body;
  const blocks: Block[] = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const el = node as Element;
      // Hard reject: subtrees that can never contain readable content
      if (EXCLUDED_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      if (isExtensionElement(el)) return NodeFilter.FILTER_REJECT;
      if (!isElementVisible(el)) return NodeFilter.FILTER_REJECT;
      // Hard reject for semantic structural tags — their children are nav/boilerplate, not article content.
      // Exception: HEADER inside a content root often wraps article titles/intros (e.g. WordPress themes),
      // so soft-skip it to allow its block-level children to be collected.
      if (skipContainers && EXCLUDED_CONTAINER_TAGS.has(el.tagName)) {
        return el.tagName === 'HEADER' ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT;
      }
      // Soft skip for class/id patterns — a <div class="entry-header"> is not a nav element;
      // its <p> children may be article content, so visit them
      if (skipContainers && shouldExcludeByPattern(el)) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Element | null;
  while ((node = walker.nextNode() as Element | null)) {
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (BLOCK_TAGS.has(tag)) {
      const text = getElementText(el);
      if (text.length >= 3) {
        blocks.push({ element: el, tag, text });
      }
      continue;
    }

    if (CONTAINER_TAGS.has(tag)) {
      if (!hasBlockChildren(el)) {
        const text = getElementText(el);
        if (text.length >= 3) {
          blocks.push({ element: el, tag: 'P', text });
        }
      }
    }
  }

  return blocks;
}

// =============================================================================
// Main chunking function
// =============================================================================

export function chunkPage(): PageChunk[] {
  const root = findMainContentContainer() ?? document.body;
  const blocks = collectBlocks(root);

  if (blocks.length === 0) return [];

  const chunks: PageChunk[] = [];
  let chunkIndex = 0;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // 1. Heading + following paragraphs/content
    if (HEADING_TAGS.has(block.tag)) {
      const groupElements: Block[] = [block];
      let j = i + 1;

      while (j < blocks.length && !HEADING_TAGS.has(blocks[j].tag)) {
        const nextTag = blocks[j].tag;
        if (nextTag === 'P' || nextTag === 'BLOCKQUOTE' || nextTag === 'FIGCAPTION') {
          groupElements.push(blocks[j]);
          j++;
        } else {
          break;
        }
      }

      const combinedText = groupElements.map((b) => b.text).join('\n');
      if (combinedText.trim()) {
        const startEl = groupElements[0].element;
        const endEl = groupElements[groupElements.length - 1].element;
        chunks.push(buildChunk(chunkIndex++, startEl, endEl, combinedText));
      }
      i = j;
      continue;
    }

    // 2. Standalone <p> or block content
    if (block.tag === 'P' || block.tag === 'BLOCKQUOTE' || block.tag === 'FIGCAPTION') {
      if (block.text.trim()) {
        chunks.push(buildChunk(chunkIndex++, block.element, block.element, block.text));
      }
      i++;
      continue;
    }

    // 3. List items
    if (block.tag === 'LI') {
      if (block.text.trim()) {
        chunks.push(buildChunk(chunkIndex++, block.element, block.element, block.text));
      }
      i++;
      continue;
    }

    // 4. Table rows
    if (block.tag === 'TR' || block.tag === 'TD' || block.tag === 'TH') {
      if (block.text.trim()) {
        chunks.push(buildChunk(chunkIndex++, block.element, block.element, block.text));
      }
      i++;
      continue;
    }

    // 5. Sliding window fallback for other content
    let windowText = block.text;
    const windowStart = block;
    let windowEnd = block;
    i++;

    while (i < blocks.length && windowText.length < WINDOW_TARGET_CHARS) {
      const next = blocks[i];
      if (HEADING_TAGS.has(next.tag) || next.tag === 'P' || next.tag === 'LI' || next.tag === 'TR') {
        break;
      }
      windowText += ' ' + next.text;
      windowEnd = next;
      i++;
    }

    if (windowText.trim()) {
      chunks.push(buildChunk(chunkIndex++, windowStart.element, windowEnd.element, windowText));
    }

    // Overlap: back up a bit for the next window
    const overlapChars = WINDOW_OVERLAP_CHARS;
    if (windowText.length > overlapChars && i < blocks.length) {
      let overlapText = '';
      let backIdx = i - 1;
      while (backIdx >= 0 && overlapText.length < overlapChars) {
        overlapText = blocks[backIdx].text + ' ' + overlapText;
        backIdx--;
      }
    }
  }

  return chunks;
}

// =============================================================================
// Full page text extraction (for content hash)
// =============================================================================

export function extractFullPageText(): string {
  const root = findMainContentContainer() ?? document.body;
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}
