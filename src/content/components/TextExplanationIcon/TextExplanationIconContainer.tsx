// src/content/components/TextExplanationIcon/TextExplanationIconContainer.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { TextExplanationIcon } from './TextExplanationIcon';
import { OnHoverMessage } from '../OnHoverMessage';
import styles from './TextExplanationIconContainer.module.css';
import { COLORS } from '../../../constants/colors';

export interface TextExplanationIconData {
  id: string;
  position: { x: number; y: number };
  selectionRange: Range | null;
  isSpinning: boolean;
  onTogglePanel: () => void;
  iconRef?: (element: HTMLElement | null) => void;
  isPanelOpen?: boolean;
  isBookmarked?: boolean;
  onBookmarkClick?: () => void;
}

export interface TextExplanationIconContainerProps {
  /** Array of icon data to display */
  icons: TextExplanationIconData[];
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
}

export const TextExplanationIconContainer: React.FC<TextExplanationIconContainerProps> = ({
  icons,
  useShadowDom = false,
}) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  if (icons.length === 0) {
    return null;
  }

  return (
    <div className={getClassName('iconContainer')}>
      {icons.map((icon) => {
        // If bookmarked, show both icons - both should be tied to text span
        if (icon.isBookmarked) {
          console.log('[TextExplanationIconContainer] Rendering bookmarked icon container:', {
            id: icon.id,
            isSpinning: icon.isSpinning,
            position: icon.position,
          });
          return (
            <React.Fragment key={icon.id}>
              <TextExplanationIcon
                position={icon.position}
                isSpinning={icon.isSpinning}
                onTogglePanel={icon.onTogglePanel}
                useShadowDom={useShadowDom}
                iconRef={icon.iconRef}
                isPanelOpen={icon.isPanelOpen}
                selectionRange={icon.selectionRange}
                key={`${icon.id}-book`}
              />
              <BookmarkIconButton
                className={getClassName('bookmarkButton')}
                onClick={(e) => {
                  e.stopPropagation();
                  icon.onBookmarkClick?.();
                }}
                selectionRange={icon.selectionRange}
                position={icon.position}
                key={`${icon.id}-bookmark`}
              />
            </React.Fragment>
          );
        }
        
        // Otherwise, show just the green icon
        return (
          <TextExplanationIcon
            key={icon.id}
            position={icon.position}
            isSpinning={icon.isSpinning}
            onTogglePanel={icon.onTogglePanel}
            useShadowDom={useShadowDom}
            iconRef={icon.iconRef}
            isPanelOpen={icon.isPanelOpen}
            selectionRange={icon.selectionRange}
          />
        );
      })}
    </div>
  );
};

// Bookmark icon button component with fixed positioning and scroll tracking
interface BookmarkIconButtonProps {
  className: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  selectionRange: Range | null;
  position: { x: number; y: number };
}

const BookmarkIconButton: React.FC<BookmarkIconButtonProps> = ({ 
  className, 
  onClick, 
  selectionRange,
  position,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const rafIdRef = useRef<number | null>(null);
  const scrollableParentsRef = useRef<HTMLElement[]>([]);
  
  // Update position function based on selection range
  const updatePosition = React.useCallback(() => {
    if (!buttonRef.current || !selectionRange) return;
    
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
      
      // Use selection's top coordinate + offset for bookmark icon (below book icon)
      const topmostY = selectionRect.top + 18;
      
      // Update position directly via DOM
      buttonRef.current.style.left = `${leftmostX - 24}px`;
      buttonRef.current.style.top = `${topmostY}px`;
    } catch (error) {
      console.error('[BookmarkIconButton] Error updating position:', error);
    }
  }, [selectionRange]);

  // Handle scroll event
  const handleScroll = React.useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updatePosition();
    });
  }, [updatePosition]);

  // Find all scrollable parent elements
  const findScrollableParents = React.useCallback((element: Node): HTMLElement[] => {
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
  }, []);
  
  // Set up scroll listeners and position tracking
  useEffect(() => {
    if (!selectionRange || !buttonRef.current) return;
    
    setIsMounted(true);
    
    // Find all scrollable parents
    scrollableParentsRef.current = findScrollableParents(selectionRange.startContainer);

    // Add listeners to window, document, and documentElement
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
  }, [selectionRange, handleScroll, updatePosition, findScrollableParents]);
  
  return (
    <>
      <button
        ref={buttonRef}
        className={className}
        onClick={onClick}
        aria-label="Remove bookmark"
        type="button"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y + 18}px`, // Below book icon
          zIndex: 2147483647,
        }}
      >
        <Bookmark size={18} fill={COLORS.PRIMARY} color={COLORS.PRIMARY} />
      </button>
      {isMounted && buttonRef.current && (
        <OnHoverMessage
          message="Remove bookmark"
          targetRef={buttonRef}
          position="left"
          offset={10}
        />
      )}
    </>
  );
};

BookmarkIconButton.displayName = 'BookmarkIconButton';

TextExplanationIconContainer.displayName = 'TextExplanationIconContainer';

