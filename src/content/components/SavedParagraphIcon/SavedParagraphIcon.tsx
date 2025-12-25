// src/content/components/SavedParagraphIcon/SavedParagraphIcon.tsx
import React, { useState, useCallback } from 'react';
import { Bookmark } from 'lucide-react';
import styles from './SavedParagraphIcon.module.css';

export interface SavedParagraphIconProps {
  /** Position of the icon */
  position: { x: number; y: number };
  /** Click handler for green xplaino icon (kept for backward compatibility but not used) */
  onXplainoClick?: () => void;
  /** Click handler for purple bookmark icon */
  onBookmarkClick: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Ref callback to get icon element */
  iconRef?: (element: HTMLElement | null) => void;
  /** Selection range for scroll tracking */
  selectionRange?: Range | null;
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

export const SavedParagraphIcon: React.FC<SavedParagraphIconProps> = ({
  position,
  onBookmarkClick,
  useShadowDom = false,
  iconRef,
  selectionRange,
}) => {
  const containerElementRef: React.MutableRefObject<HTMLDivElement | null> = { current: null };
  const [isRefSet, setIsRefSet] = useState(false);
  const scrollableParentsRef = React.useRef<HTMLElement[]>([]);
  const rafIdRef = React.useRef<number | null>(null);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  // Update position function
  const updatePosition = useCallback(() => {
    if (!containerElementRef.current || !selectionRange) return;
    
    try {
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
      const leftmostX = elementRect.left;
      
      // Use selection's top coordinate (viewport-relative)
      // Since icon is position: fixed, these viewport coordinates work directly
      const topmostY = selectionRect.top;
      
      // Update position directly via DOM for immediate update (no React render delay)
      containerElementRef.current.style.left = `${leftmostX - 30}px`;
      containerElementRef.current.style.top = `${topmostY}px`;
    } catch (error) {
      // Silently handle errors (range might be invalid after DOM changes)
      console.error('[SavedParagraphIcon] Error updating position:', error);
    }
  }, [selectionRange]);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updatePosition();
    });
  }, [updatePosition]);

  // Callback ref to detect when element is mounted
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerElementRef.current = node;
    setIsRefSet(node !== null);
    if (iconRef) {
      iconRef(node);
    }
  }, [iconRef]);

  // Initial position update when ref is set
  React.useLayoutEffect(() => {
    if (isRefSet && selectionRange) {
      updatePosition();
    }
  }, [isRefSet, selectionRange, updatePosition]);

  // Set up scroll listeners when both ref and range are ready
  React.useEffect(() => {
    if (!selectionRange || !isRefSet || !containerElementRef.current) {
      return;
    }

    // Find all scrollable parents
    scrollableParentsRef.current = findScrollableParents(selectionRange.startContainer);

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
  }, [selectionRange, isRefSet, handleScroll, updatePosition]);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 2147483647,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  return (
    <div
      ref={setContainerRef}
      className={getClassName('savedParagraphIconContainer')}
      style={containerStyle}
    >
      {/* Only show bookmark icon - no green xplaino icon for bookmarked-only text */}
      <button
        className={getClassName('bookmarkButton')}
        onClick={(e) => {
          e.stopPropagation();
          onBookmarkClick();
        }}
        aria-label="Remove bookmark"
        title="Remove bookmark"
      >
        <Bookmark size={16} fill="#9527F5" color="#9527F5" />
      </button>
    </div>
  );
};

SavedParagraphIcon.displayName = 'SavedParagraphIcon';

