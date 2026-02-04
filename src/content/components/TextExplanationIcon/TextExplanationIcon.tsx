// src/content/components/TextExplanationIcon/TextExplanationIcon.tsx
import React, { useState, useCallback, useRef } from 'react';
import { ExplanationIconButton } from '../ui/ExplanationIconButton';

export interface TextExplanationIconProps {
  /** Position of the icon */
  position: { x: number; y: number };
  /** Whether to show spinner (true) or green icon (false) */
  isSpinning: boolean;
  /** Click handler to toggle panel */
  onTogglePanel: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Ref callback to get icon element */
  iconRef?: (element: HTMLElement | null) => void;
  /** Whether the panel is currently open */
  isPanelOpen?: boolean;
  /** Selection range for scroll tracking (fallback if wrapperElement not provided) */
  selectionRange?: Range | null;
  /** Wrapper element for scroll tracking (preferred over selectionRange) */
  wrapperElement?: HTMLElement | null;
  /** Whether the text is bookmarked */
  isBookmarked?: boolean;
  /** Click handler for bookmark icon */
  onBookmarkClick?: () => void;
}

/**
 * Find all scrollable parent elements
 */
function findScrollableParents(element: Node): HTMLElement[] {
  const scrollableParents: HTMLElement[] = [];
  let current: Node | null = element;

  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      const style = window.getComputedStyle(el);
      const overflow = style.overflow + style.overflowY + style.overflowX;
      
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        scrollableParents.push(el);
      }
    }
    current = current.parentNode;
  }

  return scrollableParents;
}

export const TextExplanationIcon: React.FC<TextExplanationIconProps> = ({
  position,
  isSpinning,
  onTogglePanel,
  useShadowDom = false,
  iconRef,
  isPanelOpen = false,
  selectionRange,
  wrapperElement,
  isBookmarked = false,
  onBookmarkClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRefSet, setIsRefSet] = useState(false);
  const scrollableParentsRef = useRef<HTMLElement[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // Update position function
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    // Need either wrapperElement or selectionRange for positioning
    if (!wrapperElement && !selectionRange) return;
    
    try {
      let targetRect: DOMRect | null = null;
      let leftmostX: number;
      let topmostY: number;

      // Use wrapper element if available (more reliable - stable DOM element)
      // This fixes scroll issues on websites with CSS transforms (like The Atlantic)
      if (wrapperElement) {
        targetRect = wrapperElement.getBoundingClientRect();
        
        // If element is not visible, don't update position
        if (targetRect.width === 0 && targetRect.height === 0) {
          return;
        }
        
        leftmostX = targetRect.left;
        topmostY = targetRect.top;
      } else if (selectionRange) {
        // Fallback to selectionRange if wrapperElement not available
        // Check if selection range is still valid
        if (!selectionRange.startContainer || !selectionRange.endContainer) {
          return;
        }

        // Get selection's bounding rectangle (viewport-relative coordinates)
        const selectionRect = selectionRange.getBoundingClientRect();
        
        // If selection is not visible, don't update position
        if (selectionRect.width === 0 && selectionRect.height === 0) {
          return;
        }

        // Find containing element for left positioning
        let containingElement: HTMLElement | null = null;
        let node: Node | null = selectionRange.startContainer;
        
        while (node && node !== document.body) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            containingElement = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
        
        if (!containingElement) {
          containingElement = document.body;
        }
        
        // Get element's leftmost coordinate (viewport-relative)
        const elementRect = containingElement.getBoundingClientRect();
        leftmostX = elementRect.left;
        
        // Use selection's top coordinate (viewport-relative)
        topmostY = selectionRect.top;
      } else {
        return;
      }
      
      // Update position directly via DOM for immediate update (no React render delay)
      // Align icon with text span - position it closer and aligned with text baseline
      containerRef.current.style.left = `${leftmostX - 24}px`;
      containerRef.current.style.top = `${topmostY}px`;
    } catch (error) {
      // Silently handle errors (range might be invalid after DOM changes)
      console.error('[TextExplanationIcon] Error updating position:', error);
    }
  }, [wrapperElement, selectionRange]);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updatePosition();
    });
  }, [updatePosition]);

  // Callback ref for container
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    setIsRefSet(element !== null);
  }, []);

  // Initial position update when ref is set
  React.useLayoutEffect(() => {
    if (isRefSet && (wrapperElement || selectionRange)) {
      updatePosition();
    }
  }, [isRefSet, wrapperElement, selectionRange, updatePosition]);

  // Set up scroll listeners when both ref and tracking element are ready
  React.useEffect(() => {
    // Need either wrapperElement or selectionRange for scroll tracking
    if (!isRefSet || (!wrapperElement && !selectionRange)) {
      return;
    }

    // Find all scrollable parents - prefer wrapperElement (stable DOM element)
    const trackingElement = wrapperElement || (selectionRange ? selectionRange.startContainer : null);
    if (trackingElement) {
      scrollableParentsRef.current = findScrollableParents(trackingElement);
    }

    // Add listeners to window, document, and documentElement
    // Using capture phase (true) to catch all scroll events
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    document.addEventListener('scroll', handleScroll, true);
    if (document.documentElement) {
      document.documentElement.addEventListener('scroll', handleScroll, true);
    }
    if (document.body) {
      document.body.addEventListener('scroll', handleScroll, true);
    }

    // Add listeners to all scrollable parent elements
    scrollableParentsRef.current.forEach((parent) => {
      parent.addEventListener('scroll', handleScroll, true);
    });

    // Initial position update
    updatePosition();
    
    // Also update on next animation frame to ensure initial positioning
    requestAnimationFrame(() => {
      updatePosition();
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      if (document.documentElement) {
        document.documentElement.removeEventListener('scroll', handleScroll, true);
      }
      if (document.body) {
        document.body.removeEventListener('scroll', handleScroll, true);
      }

      scrollableParentsRef.current.forEach((parent) => {
        parent.removeEventListener('scroll', handleScroll, true);
      });
      
      scrollableParentsRef.current = [];
    };
  }, [wrapperElement, selectionRange, isRefSet, handleScroll, updatePosition]);

  // Wrapper style for fixed positioning
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 2147483647,
  };

  return (
    <div ref={setContainerRef} style={wrapperStyle}>
      <ExplanationIconButton
        isSpinning={isSpinning}
        isPanelOpen={isPanelOpen}
        isBookmarked={isBookmarked}
        firstChunkReceived={true} // Text explanation always shows book icon (no icon phase)
        onClick={onTogglePanel}
        onBookmarkClick={onBookmarkClick}
        iconRef={iconRef as ((element: HTMLButtonElement | null) => void) | undefined}
        useShadowDom={useShadowDom}
        spinnerSize="sm"
        showPurpleIconInitially={false}
        ariaLabel="Toggle text explanation"
        hoverMessage="View explanation"
        bookmarkHoverMessage="Remove bookmark"
      />
    </div>
  );
};

TextExplanationIcon.displayName = 'TextExplanationIcon';
