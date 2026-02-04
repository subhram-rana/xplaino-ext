// src/content/utils/textSelectionUnderline.ts
/**
 * Utility functions for adding/removing dashed teal underline to text selections
 * Note: The underline is added without modifying any original CSS properties of the text,
 * preserving font colors, sizes, styles, hyperlinks, and all other styling.
 */

import { COLORS, colorWithOpacity } from '../../constants/colors';
import { getCurrentTheme } from '../../constants/theme';

export interface UnderlineState {
  wrapperElement: HTMLElement;
  // Support multiple wrapper elements for multi-block selections
  wrapperElements?: HTMLElement[];
  originalRange: Range;
}

// Block-level element tag names
const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
]);

/**
 * Get the nearest block-level ancestor of a node
 * @param node - The node to find the block ancestor for
 * @returns The nearest block-level ancestor element, or null
 */
function getBlockAncestor(node: Node): HTMLElement | null {
  let current: Node | null = node;
  
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement;
      if (BLOCK_ELEMENTS.has(element.tagName)) {
        return element;
      }
    }
    current = current.parentNode;
  }
  
  return null;
}

/**
 * Check if a selection range spans multiple block-level elements
 * @param range - The range to check
 * @returns true if the range spans multiple blocks
 */
function isMultiBlockSelection(range: Range): boolean {
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);
  
  // If either doesn't have a block ancestor, or they're the same, it's not multi-block
  if (!startBlock || !endBlock) {
    return false;
  }
  
  return startBlock !== endBlock;
}

/**
 * Find the ancestor of a node that is a direct child of the given parent
 * @param node - The node to find the ancestor for
 * @param parent - The parent element to search within
 * @returns The ancestor that is a direct child of parent, or null
 */
function findAncestorChildOf(node: Node, parent: Element): Element | null {
  let current: Node | null = node;
  
  while (current && current.parentNode !== parent) {
    current = current.parentNode;
  }
  
  return current as Element | null;
}

/**
 * Get all block elements that are within the range
 * Uses a simple sibling-traversal approach for reliability
 * @param range - The range to get blocks from
 * @returns Array of block elements within the range
 */
function getBlocksInRange(range: Range): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const startBlock = getBlockAncestor(range.startContainer);
  const endBlock = getBlockAncestor(range.endContainer);
  
  if (!startBlock || !endBlock) {
    return blocks;
  }
  
  // If start and end are the same block, just return that one
  if (startBlock === endBlock) {
    return [startBlock];
  }
  
  // Check if they're siblings (same parent)
  if (startBlock.parentNode === endBlock.parentNode) {
    // Simple case: traverse siblings from start to end
    blocks.push(startBlock);
    let current: Element | null = startBlock.nextElementSibling;
    while (current && current !== endBlock) {
      if (BLOCK_ELEMENTS.has(current.tagName)) {
        blocks.push(current as HTMLElement);
      }
      current = current.nextElementSibling;
    }
    if (endBlock) {
      blocks.push(endBlock);
    }
    return blocks;
  }
  
  // They're not siblings - find the common ancestor and traverse at that level
  const commonAncestor = range.commonAncestorContainer;
  let container: Node | null = commonAncestor;
  
  // If common ancestor is a text node, get its parent
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentNode;
  }
  
  if (!container || container.nodeType !== Node.ELEMENT_NODE) {
    // Fallback: just return start and end blocks
    return [startBlock, endBlock];
  }
  
  const containerElement = container as Element;
  
  // Find which direct children of the common ancestor contain our start and end blocks
  const startAncestor = findAncestorChildOf(startBlock, containerElement);
  const endAncestor = findAncestorChildOf(endBlock, containerElement);
  
  if (!startAncestor || !endAncestor) {
    // Fallback: just return start and end blocks
    return [startBlock, endBlock];
  }
  
  // Collect all block elements between startAncestor and endAncestor (inclusive)
  // We want the leaf-level blocks (like <p> inside <li>), not the container blocks (like <li>)
  let foundStart = false;
  let foundEnd = false;
  
  for (const child of Array.from(containerElement.children)) {
    if (child === startAncestor) {
      foundStart = true;
    }
    
    if (foundStart && !foundEnd) {
      // Find the deepest block element within this child that contains actual content
      const deepestBlock = findDeepestBlockWithContent(child as HTMLElement, range);
      if (deepestBlock) {
        blocks.push(deepestBlock);
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

/**
 * Find the deepest block element within an element that intersects with the range
 * @param element - The element to search within
 * @param range - The selection range
 * @returns The deepest block element, or null
 */
function findDeepestBlockWithContent(element: HTMLElement, range: Range): HTMLElement | null {
  // Check if this element has any block children
  const blockChildren = Array.from(element.children).filter(
    child => BLOCK_ELEMENTS.has(child.tagName)
  );
  
  if (blockChildren.length === 0) {
    // No block children - this is the deepest block
    return BLOCK_ELEMENTS.has(element.tagName) ? element : null;
  }
  
  // Find block children that intersect with the range
  for (const child of blockChildren) {
    try {
      const childRange = document.createRange();
      childRange.selectNodeContents(child);
      
      // Check if the child intersects with the selection range
      const intersects = range.compareBoundaryPoints(Range.END_TO_START, childRange) <= 0 &&
                         range.compareBoundaryPoints(Range.START_TO_END, childRange) >= 0;
      
      if (intersects) {
        // Recursively find the deepest block
        const deeper = findDeepestBlockWithContent(child as HTMLElement, range);
        if (deeper) {
          return deeper;
        }
      }
    } catch {
      // If comparison fails, skip
    }
  }
  
  // If no intersecting block children found, return this element if it's a block
  return BLOCK_ELEMENTS.has(element.tagName) ? element : null;
}

/**
 * Create a styled wrapper span element for underlining
 * @param primaryColor - The primary color for the underline
 * @returns A styled span element
 */
function createWrapperSpan(primaryColor: string): HTMLSpanElement {
  const wrapper = document.createElement('span');
  
  // Explicitly inherit all font-related properties to preserve original styling
  wrapper.style.font = 'inherit';
  wrapper.style.fontSize = 'inherit';
  wrapper.style.fontFamily = 'inherit';
  wrapper.style.fontWeight = 'inherit';
  wrapper.style.fontStyle = 'inherit';
  wrapper.style.lineHeight = 'inherit';
  wrapper.style.letterSpacing = 'inherit';
  wrapper.style.color = 'inherit';
  wrapper.style.verticalAlign = 'baseline';
  
  // Add underline styling - only these properties should be different
  wrapper.style.textDecoration = 'underline';
  wrapper.style.textDecorationStyle = 'dashed';
  wrapper.style.textDecorationColor = primaryColor;
  wrapper.style.textDecorationThickness = '1px';
  wrapper.style.textUnderlineOffset = '2px';
  wrapper.style.textDecorationSkipInk = 'auto';
  
  // Layout properties
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline';
  wrapper.style.padding = '0';
  wrapper.style.paddingBottom = '0';
  wrapper.style.margin = '0';
  wrapper.style.marginBottom = '0';
  
  wrapper.setAttribute('data-text-explanation-wrapper', 'true');
  
  return wrapper;
}

/**
 * Wrap text content within a single block element based on the range
 * @param block - The block element to wrap text in
 * @param range - The original selection range
 * @param primaryColor - The color for the underline
 * @returns The wrapper element, or null if wrapping failed
 */
function wrapTextInBlock(block: HTMLElement, range: Range, primaryColor: string): HTMLElement | null {
  try {
    // Create a range for just this block's portion of the selection
    const blockRange = document.createRange();
    
    // Determine the start point
    const startBlock = getBlockAncestor(range.startContainer);
    if (startBlock === block) {
      blockRange.setStart(range.startContainer, range.startOffset);
    } else {
      // Start at the beginning of this block's content
      blockRange.setStart(block, 0);
    }
    
    // Determine the end point
    const endBlock = getBlockAncestor(range.endContainer);
    if (endBlock === block) {
      blockRange.setEnd(range.endContainer, range.endOffset);
    } else {
      // End at the end of this block's content
      blockRange.setEndAfter(block.lastChild || block);
    }
    
    // Skip if the range is collapsed or empty
    if (blockRange.collapsed || blockRange.toString().trim() === '') {
      return null;
    }
    
    const wrapper = createWrapperSpan(primaryColor);
    
    try {
      blockRange.surroundContents(wrapper);
      return wrapper;
    } catch {
      // If surroundContents fails within a single block, use extractContents
      // This is safer within a single block since we're not crossing block boundaries
      const contents = blockRange.extractContents();
      if (contents.textContent?.trim()) {
        wrapper.appendChild(contents);
        blockRange.insertNode(wrapper);
        return wrapper;
      }
      return null;
    }
  } catch (error) {
    console.error('[textSelectionUnderline] Error wrapping text in block:', error);
    return null;
  }
}

/**
 * Add a thin dashed teal underline to the selected text without modifying original styles
 * This preserves all original CSS properties (font color, size, style, hyperlinks, etc.)
 * @param range - The selection range to underline
 * @param _color - Kept for backward compatibility but always uses teal now
 * @returns The wrapper element and original range, or null if failed
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function addTextUnderline(range: Range, _color: 'green' | 'primary' = 'green'): Promise<UnderlineState | null> {
  if (!range || range.collapsed) {
    return null;
  }

  try {
    // Get theme-aware primary color
    const theme = await getCurrentTheme();
    const primaryColor = theme === 'dark' ? COLORS.DARK_PRIMARY : COLORS.PRIMARY;
    
    // Check if this is a multi-block selection
    if (isMultiBlockSelection(range)) {
      // Handle multi-block selection by wrapping text in each block separately
      const blocks = getBlocksInRange(range);
      const wrapperElements: HTMLElement[] = [];
      
      for (const block of blocks) {
        const wrapper = wrapTextInBlock(block, range, primaryColor);
        if (wrapper) {
          wrapperElements.push(wrapper);
        }
      }
      
      if (wrapperElements.length === 0) {
        return null;
      }
      
      return {
        wrapperElement: wrapperElements[0], // Primary wrapper for backward compatibility
        wrapperElements, // All wrappers for multi-block
        originalRange: range,
      };
    }
    
    // Single-block selection - use original approach
    const clonedRange = range.cloneRange();
    const wrapper = createWrapperSpan(primaryColor);
    
    // Wrap the selected content
    try {
      clonedRange.surroundContents(wrapper);
    } catch {
      // If surroundContents fails, use alternative approach
      const contents = clonedRange.extractContents();
      wrapper.appendChild(contents);
      clonedRange.insertNode(wrapper);
    }
    
    return {
      wrapperElement: wrapper,
      originalRange: range,
    };
  } catch (error) {
    console.error('[textSelectionUnderline] Error adding underline:', error);
    return null;
  }
}

/**
 * Remove the underline from a previously underlined selection
 * @param underlineState - The underline state returned from addTextUnderline
 */
export function removeTextUnderline(underlineState: UnderlineState | null): void {
  if (!underlineState) {
    return;
  }

  // Get all wrapper elements (handle both single and multi-block)
  const wrappers = underlineState.wrapperElements || 
    (underlineState.wrapperElement ? [underlineState.wrapperElement] : []);
  
  for (const wrapper of wrappers) {
    try {
      const parent = wrapper.parentNode;
      
      if (!parent) {
        continue;
      }
      
      // Replace the wrapper with its contents
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      
      // Remove the wrapper
      parent.removeChild(wrapper);
    } catch (error) {
      console.error('[textSelectionUnderline] Error removing underline:', error);
    }
  }
}

/**
 * Find all underlined elements in the document
 * @returns Array of wrapper elements
 */
export function findAllUnderlinedElements(): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const allSpans = document.querySelectorAll('span');
  
  allSpans.forEach((span) => {
    // Check for text-decoration underlines
    const style = window.getComputedStyle(span);
    const inlineStyle = (span as HTMLElement).style;
    const textDecorationColor = inlineStyle.textDecorationColor || style.textDecorationColor;
    
    // Check for teal, green, or primary underlines
    if (style.textDecoration.includes('underline')) {
      const isTeal = textDecorationColor.includes('13, 128, 112') || 
                     textDecorationColor.includes('0d8070') ||
                     textDecorationColor.includes(COLORS.PRIMARY.replace('#', ''));
      const isGreen = textDecorationColor.includes('0, 200, 0') || 
                     textDecorationColor.includes('00C800') ||
                     textDecorationColor.includes(COLORS.SUCCESS_GREEN.replace('#', ''));
      const isPrimary = textDecorationColor.includes('13, 128, 112') || 
                      textDecorationColor.includes('0d8070');
      
      if (isTeal || isGreen || isPrimary) {
        elements.push(span);
        return;
      }
    }
    
    // Check for legacy dashed green underlines (for backward compatibility)
    const isDashedGreen = style.textDecoration.includes('underline') &&
      style.textDecorationStyle === 'dashed' &&
      (textDecorationColor.includes(COLORS.SUCCESS_GREEN.replace('#', 'rgb(').slice(0, -1) + ')') ||
       textDecorationColor.includes('rgb(0, 200, 0)'));
    
    if (isDashedGreen) {
      elements.push(span);
    }
  });
  
  return elements;
}

/**
 * Change the color of an existing underline
 * @param underlineState - The underline state containing the wrapper element
 * @param color - The new color for the underline ('green', 'primary', or 'teal')
 */
export function changeUnderlineColor(underlineState: UnderlineState | null, color: 'green' | 'primary' | 'teal'): void {
  if (!underlineState) {
    return;
  }

  // Get all wrapper elements (handle both single and multi-block)
  const wrappers = underlineState.wrapperElements || 
    (underlineState.wrapperElement ? [underlineState.wrapperElement] : []);
  
  for (const wrapper of wrappers) {
    // Update text-decoration color
    if (color === 'primary') {
      wrapper.style.textDecorationColor = colorWithOpacity(COLORS.PRIMARY, 0.8);
    } else if (color === 'teal') {
      wrapper.style.textDecorationColor = COLORS.PRIMARY;
    } else {
      wrapper.style.textDecorationColor = colorWithOpacity(COLORS.SUCCESS_GREEN, 0.8);
    }
  }
}

/**
 * Check if a range overlaps with any underlined text (primary, green, or teal)
 * @param range - The selection range to check
 * @returns true if the range overlaps with underlined text, false otherwise
 */
export function isRangeOverlappingUnderlinedText(range: Range): boolean {
  if (!range || range.collapsed) {
    return false;
  }

  try {
    // Find all span elements in the document
    const allSpans = document.querySelectorAll('span');
    
    // Check if any part of the range overlaps with an underlined span
    for (const span of allSpans) {
      // Check for text-decoration underlines
      const style = window.getComputedStyle(span);
      const inlineStyle = (span as HTMLElement).style;
      
      // Check if this span has an underline
      const hasUnderline = style.textDecoration.includes('underline');
      
      if (hasUnderline) {
        // Check if it's primary, green, or teal underline
        const textDecorationColor = inlineStyle.textDecorationColor || style.textDecorationColor;
        const isPrimary = textDecorationColor.includes('13, 128, 112') || 
                         textDecorationColor.includes('0d8070');
        const isGreen = textDecorationColor.includes('0, 200, 0') || 
                       textDecorationColor.includes('00C800') ||
                       textDecorationColor.includes(COLORS.SUCCESS_GREEN.replace('#', ''));
        const isTeal = textDecorationColor.includes('13, 128, 112') || 
                       textDecorationColor.includes('0d8070') ||
                       textDecorationColor.includes(COLORS.PRIMARY.replace('#', ''));
        
        if (!isPrimary && !isGreen && !isTeal) {
          continue;
        }
      } else {
        continue;
      }
      
      if (!hasUnderline) {
        continue;
      }
      
      // Check if the range overlaps with this span
      try {
        const spanRange = document.createRange();
        spanRange.selectNodeContents(span);
        
        // Check if ranges overlap using boundary point comparison
        // Ranges overlap if: range.start < spanRange.end AND range.end > spanRange.start
        const rangeStartBeforeSpanEnd = range.compareBoundaryPoints(Range.START_TO_END, spanRange) < 0;
        const rangeEndAfterSpanStart = range.compareBoundaryPoints(Range.END_TO_START, spanRange) > 0;
        
        if (rangeStartBeforeSpanEnd && rangeEndAfterSpanStart) {
          return true;
        }
        
        // Also check if the range's start or end container is within the span
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        // Check if startContainer or endContainer is the span itself or a descendant
        if (span === startContainer || span === endContainer || 
            span.contains(startContainer) || span.contains(endContainer)) {
          return true;
        }
        
        // Check if the span is within the range by comparing boundaries
        // Span is within range if: range.start <= spanRange.start AND range.end >= spanRange.end
        const rangeStartBeforeSpanStart = range.compareBoundaryPoints(Range.START_TO_START, spanRange) <= 0;
        const rangeEndAfterSpanEnd = range.compareBoundaryPoints(Range.END_TO_END, spanRange) >= 0;
        
        if (rangeStartBeforeSpanStart && rangeEndAfterSpanEnd) {
          return true;
        }
      } catch {
        // If range comparison fails, try a simpler approach
        // Check if the range's start or end container is within the span
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        if (span === startContainer || span === endContainer ||
            span.contains(startContainer) || span.contains(endContainer)) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('[textSelectionUnderline] Error checking for overlapping underlined text:', error);
    return false;
  }
}

/**
 * Pulse the background color of the underlined text three times with very light teal color
 * @param underlineState - The underline state containing the wrapper element
 */
export function pulseTextBackground(underlineState: UnderlineState | null): void {
  if (!underlineState) {
    return;
  }

  // Get all wrapper elements (handle both single and multi-block)
  const wrappers = underlineState.wrapperElements || 
    (underlineState.wrapperElement ? [underlineState.wrapperElement] : []);
  
  if (wrappers.length === 0) {
    return;
  }
  
  // Store original styles for all wrappers
  const originalStyles = wrappers.map(wrapper => ({
    transition: wrapper.style.transition || '',
    background: wrapper.style.backgroundColor || ''
  }));
  
  // Set transition for smooth color changes on all wrappers
  for (const wrapper of wrappers) {
    wrapper.style.transition = 'background-color 0.3s ease';
  }
  
  // Pulse exactly 3 times with very light teal color
  let pulseCount = 0;
  const maxPulses = 3;
  
  const pulse = () => {
    if (pulseCount >= maxPulses) {
      // Restore to original state after animation completes
      wrappers.forEach((wrapper, index) => {
        wrapper.style.backgroundColor = originalStyles[index].background || 'transparent';
        wrapper.style.transition = originalStyles[index].transition || '';
      });
      return;
    }
    
    // Pulse to very light teal color on all wrappers
    for (const wrapper of wrappers) {
      wrapper.style.backgroundColor = COLORS.PRIMARY_VERY_LIGHT;
    }
    
    setTimeout(() => {
      // Fade back to transparent
      for (const wrapper of wrappers) {
        wrapper.style.backgroundColor = 'transparent';
      }
      pulseCount++;
      
      if (pulseCount < maxPulses) {
        // Wait before next pulse
        setTimeout(pulse, 250);
      } else {
        // Restore original state after final pulse fades
        setTimeout(() => {
          wrappers.forEach((wrapper, index) => {
            wrapper.style.backgroundColor = originalStyles[index].background || 'transparent';
            wrapper.style.transition = originalStyles[index].transition || '';
          });
        }, 300);
      }
    }, 300);
  };
  
  // Start first pulse immediately
  pulse();
}
