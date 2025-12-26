// src/content/utils/textSelectionUnderline.ts
/**
 * Utility functions for adding/removing dashed green underline to text selections
 */

export interface UnderlineState {
  wrapperElement: HTMLElement;
  originalRange: Range;
}

/**
 * Add a dashed underline to the selected text
 * @param range - The selection range to underline
 * @param color - The color of the underline (default: green for text explanations)
 * @returns The wrapper element and original range, or null if failed
 */
export function addTextUnderline(range: Range, color: 'green' | 'purple' = 'green'): UnderlineState | null {
  if (!range || range.collapsed) {
    return null;
  }

  try {
    // Clone the range to avoid modifying the original
    const clonedRange = range.cloneRange();
    
    // Create a wrapper span element
    const wrapper = document.createElement('span');
    wrapper.style.textDecoration = 'underline';
    wrapper.style.textDecorationStyle = 'dashed';
    
    // Set color based on parameter
    if (color === 'purple') {
      // Medium purple color: rgba(149, 39, 245, 0.6) -> rgba(149, 39, 245, 0.8)
      wrapper.style.textDecorationColor = 'rgba(149, 39, 245, 0.6)';
    } else {
      // Green color for text explanations
      wrapper.style.textDecorationColor = 'rgba(0, 200, 0, 0.6)';
    }
    
    wrapper.style.textDecorationThickness = '2px';
    wrapper.style.transition = 'text-decoration-color 0.3s ease';
    // Add padding for visual spacing around the underline
    wrapper.style.padding = '2px 0';
    
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
    
    // Animate the underline appearance
    requestAnimationFrame(() => {
      if (color === 'purple') {
        wrapper.style.textDecorationColor = 'rgba(149, 39, 245, 0.8)';
      } else {
        wrapper.style.textDecorationColor = 'rgba(0, 200, 0, 0.8)';
      }
    });
    
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
    const style = window.getComputedStyle(span);
    if (
      style.textDecoration.includes('underline') &&
      style.textDecorationStyle === 'dashed' &&
      span.style.textDecorationColor.includes('rgb(0, 200, 0)')
    ) {
      elements.push(span);
    }
  });
  
  return elements;
}

/**
 * Change the color of an existing underline
 * @param underlineState - The underline state containing the wrapper element
 * @param color - The new color for the underline
 */
export function changeUnderlineColor(underlineState: UnderlineState | null, color: 'green' | 'purple'): void {
  if (!underlineState || !underlineState.wrapperElement) {
    return;
  }

  const wrapper = underlineState.wrapperElement;
  
  // Update the text decoration color
  if (color === 'purple') {
    wrapper.style.textDecorationColor = 'rgba(149, 39, 245, 0.8)';
  } else {
    wrapper.style.textDecorationColor = 'rgba(0, 200, 0, 0.8)';
  }
}

/**
 * Pulse the background color of the underlined text three times with green color
 * @param underlineState - The underline state containing the wrapper element
 */
export function pulseTextBackground(underlineState: UnderlineState | null): void {
  if (!underlineState || !underlineState.wrapperElement) {
    return;
  }

  const wrapper = underlineState.wrapperElement;
  
  // Store original transition to restore later
  const originalTransition = wrapper.style.transition || '';
  
  // Set transition for smooth color changes with longer duration for better visibility
  wrapper.style.transition = 'background-color 0.4s ease';
  
  // Pulse three times
  let pulseCount = 0;
  const maxPulses = 3;
  
  const pulse = () => {
    if (pulseCount >= maxPulses) {
      // Restore to transparent after animation completes
      wrapper.style.backgroundColor = 'transparent';
      // Restore original transition
      if (originalTransition) {
        wrapper.style.transition = originalTransition;
      } else {
        wrapper.style.transition = '';
      }
      return;
    }
    
    // Pulse to green with higher opacity for better visibility
    wrapper.style.backgroundColor = 'rgba(0, 200, 0, 0.5)';
    
    setTimeout(() => {
      // Fade back to transparent
      wrapper.style.backgroundColor = 'transparent';
      
      pulseCount++;
      if (pulseCount < maxPulses) {
        // Wait a bit before next pulse
        setTimeout(pulse, 300);
      } else {
        // Ensure background is transparent and restore original transition after all pulses
        setTimeout(() => {
          wrapper.style.backgroundColor = 'transparent';
          if (originalTransition) {
            wrapper.style.transition = originalTransition;
          } else {
            wrapper.style.transition = '';
          }
        }, 400);
      }
    }, 400);
  };
  
  // Start first pulse immediately
  pulse();
}

