// src/content/utils/textSelectionUnderline.ts
/**
 * Utility functions for adding/removing solid teal underline to text selections
 */

import { COLORS, colorWithOpacity } from '../../constants/colors';

export interface UnderlineState {
  wrapperElement: HTMLElement;
  originalRange: Range;
}

/**
 * Add a solid teal underline to the selected text
 * @param range - The selection range to underline
 * @param _color - The color of the underline (default: green for text explanations) - kept for backward compatibility but always uses teal now
 * @returns The wrapper element and original range, or null if failed
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function addTextUnderline(range: Range, _color: 'green' | 'purple' = 'green'): UnderlineState | null {
  if (!range || range.collapsed) {
    return null;
  }

  try {
    // Clone the range to avoid modifying the original
    const clonedRange = range.cloneRange();
    
    // Get the computed styles from the selected text to preserve font properties
    const startContainer = range.startContainer;
    let fontStyle = '';
    let fontWeight = '';
    let fontSize = '';
    let fontFamily = '';
    let color = '';
    let lineHeight = '';
    
    if (startContainer.nodeType === Node.TEXT_NODE && startContainer.parentElement) {
      const computedStyle = window.getComputedStyle(startContainer.parentElement);
      fontStyle = computedStyle.fontStyle;
      fontWeight = computedStyle.fontWeight;
      fontSize = computedStyle.fontSize;
      fontFamily = computedStyle.fontFamily;
      color = computedStyle.color;
      lineHeight = computedStyle.lineHeight;
    } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
      const computedStyle = window.getComputedStyle(startContainer as Element);
      fontStyle = computedStyle.fontStyle;
      fontWeight = computedStyle.fontWeight;
      fontSize = computedStyle.fontSize;
      fontFamily = computedStyle.fontFamily;
      color = computedStyle.color;
      lineHeight = computedStyle.lineHeight;
    }
    
    // Create a wrapper span element
    const wrapper = document.createElement('span');
    
    // Preserve original font styles to maintain text size and appearance
    wrapper.style.fontStyle = fontStyle;
    wrapper.style.fontWeight = fontWeight;
    wrapper.style.fontSize = fontSize;
    wrapper.style.fontFamily = fontFamily;
    wrapper.style.color = color;
    wrapper.style.lineHeight = lineHeight;
    
    // Use text-decoration underline instead of bottom border
    wrapper.style.textDecoration = 'underline';
    wrapper.style.textDecorationColor = COLORS.PRIMARY;
    wrapper.style.textDecorationThickness = '1.5px';
    wrapper.style.textUnderlineOffset = '2px';
    
    // Make wrapper position relative so icon can be absolutely positioned within it
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline';
    
    // Add minimal padding and margin - ensure no bottom padding
    wrapper.style.padding = '0';
    wrapper.style.paddingBottom = '0';
    wrapper.style.margin = '0';
    wrapper.style.marginBottom = '0';
    
    // Add a data attribute to identify this wrapper for icon insertion
    wrapper.setAttribute('data-text-explanation-wrapper', 'true');
    
    // Wrap the selected content
    try {
      clonedRange.surroundContents(wrapper);
    } catch (error) {
      // If surroundContents fails (e.g., range spans multiple elements),
      // use an alternative approach
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
  if (!underlineState || !underlineState.wrapperElement) {
    return;
  }

  try {
    const wrapper = underlineState.wrapperElement;
    const parent = wrapper.parentNode;
    
    if (!parent) {
      return;
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
    
    // Check for teal, green, or purple underlines
    if (style.textDecoration.includes('underline')) {
      const isTeal = textDecorationColor.includes('13, 128, 112') || 
                     textDecorationColor.includes('0d8070') ||
                     textDecorationColor.includes(COLORS.PRIMARY.replace('#', ''));
      const isGreen = textDecorationColor.includes('0, 200, 0') || 
                     textDecorationColor.includes('00C800') ||
                     textDecorationColor.includes(COLORS.SUCCESS_GREEN.replace('#', ''));
      const isPurple = textDecorationColor.includes('149, 39, 245') || 
                      textDecorationColor.includes('9527F5');
      
      if (isTeal || isGreen || isPurple) {
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
 * @param color - The new color for the underline ('green', 'purple', or 'teal')
 */
export function changeUnderlineColor(underlineState: UnderlineState | null, color: 'green' | 'purple' | 'teal'): void {
  if (!underlineState || !underlineState.wrapperElement) {
    return;
  }

  const wrapper = underlineState.wrapperElement;
  
  // Update text-decoration color
  if (color === 'purple') {
    wrapper.style.textDecorationColor = colorWithOpacity(COLORS.PRIMARY, 0.8);
  } else if (color === 'teal') {
    wrapper.style.textDecorationColor = COLORS.PRIMARY;
  } else {
    wrapper.style.textDecorationColor = colorWithOpacity(COLORS.SUCCESS_GREEN, 0.8);
  }
}

/**
 * Check if a range overlaps with any underlined text (purple, green, or teal)
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
        // Check if it's purple, green, or teal underline
        const textDecorationColor = inlineStyle.textDecorationColor || style.textDecorationColor;
        const isPurple = textDecorationColor.includes('149, 39, 245') || 
                         textDecorationColor.includes('9527F5');
        const isGreen = textDecorationColor.includes('0, 200, 0') || 
                       textDecorationColor.includes('00C800') ||
                       textDecorationColor.includes(COLORS.SUCCESS_GREEN.replace('#', ''));
        const isTeal = textDecorationColor.includes('13, 128, 112') || 
                       textDecorationColor.includes('0d8070') ||
                       textDecorationColor.includes(COLORS.PRIMARY.replace('#', ''));
        
        if (!isPurple && !isGreen && !isTeal) {
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
      } catch (error) {
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
  if (!underlineState || !underlineState.wrapperElement) {
    return;
  }

  const wrapper = underlineState.wrapperElement;
  
  // Store original transition to restore later
  const originalTransition = wrapper.style.transition || '';
  const originalBackground = wrapper.style.backgroundColor || '';
  
  // Set transition for smooth color changes
  wrapper.style.transition = 'background-color 0.3s ease';
  
  // Pulse exactly 3 times with very light teal color
  let pulseCount = 0;
  const maxPulses = 3;
  
  const pulse = () => {
    if (pulseCount >= maxPulses) {
      // Restore to original state after animation completes
      wrapper.style.backgroundColor = originalBackground || 'transparent';
      wrapper.style.transition = originalTransition || '';
      return;
    }
    
    // Pulse to very light teal color
    wrapper.style.backgroundColor = COLORS.PRIMARY_VERY_LIGHT;
    
    setTimeout(() => {
      // Fade back to transparent
      wrapper.style.backgroundColor = 'transparent';
      pulseCount++;
      
      if (pulseCount < maxPulses) {
        // Wait before next pulse
        setTimeout(pulse, 250);
      } else {
        // Restore original state after final pulse fades
        setTimeout(() => {
          wrapper.style.backgroundColor = originalBackground || 'transparent';
          wrapper.style.transition = originalTransition || '';
        }, 300);
      }
    }, 300);
  };
  
  // Start first pulse immediately
  pulse();
}

