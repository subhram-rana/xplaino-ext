// src/content/components/TextExplanationIcon/TextExplanationIcon.tsx
import React, { useState, useCallback } from 'react';
import styles from './TextExplanationIcon.module.css';

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
  /** Selection range for scroll tracking */
  selectionRange?: Range | null;
}

/**
 * Get the icon URL for the green xplaino icon
 */
function getGreenIconUrl(): string {
  return chrome.runtime.getURL('src/assets/icons/xplaino-green-icon.ico');
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
}) => {
  const iconElementRef: React.MutableRefObject<HTMLButtonElement | null> = { current: null };
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
    if (!iconElementRef.current || !selectionRange) return;
    
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
      iconElementRef.current.style.left = `${leftmostX - 30}px`;
      iconElementRef.current.style.top = `${topmostY}px`;
    } catch (error) {
      // Silently handle errors (range might be invalid after DOM changes)
      console.error('[TextExplanationIcon] Error updating position:', error);
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
  const setIconRef = useCallback((node: HTMLButtonElement | null) => {
    iconElementRef.current = node;
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
    if (!selectionRange || !isRefSet || !iconElementRef.current) {
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

  const iconStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 2147483647,
  };

  const buttonClassName = `${getClassName('textExplanationIcon')} ${isPanelOpen ? getClassName('panelOpen') : ''}`;

  return (
    <button
      ref={setIconRef}
      className={buttonClassName}
      style={iconStyle}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePanel();
      }}
      aria-label="Toggle text explanation"
    >
      {isSpinning ? (
        <span 
          className={getClassName('loadingSpinner')}
        />
      ) : (
        <img
          src={getGreenIconUrl()}
          alt="Xplaino"
          className={getClassName('iconImage')}
        />
      )}
    </button>
  );
};

TextExplanationIcon.displayName = 'TextExplanationIcon';

