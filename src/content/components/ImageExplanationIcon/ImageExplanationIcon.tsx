// src/content/components/ImageExplanationIcon/ImageExplanationIcon.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import styles from './ImageExplanationIcon.module.css';
import { COLORS } from '@/constants/colors';

export interface ImageExplanationIconProps {
  /** Position of the icon */
  position: { x: number; y: number };
  /** Whether to show spinner (true) or icon (false) */
  isSpinning: boolean;
  /** Click handler */
  onClick: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Ref callback to get icon element */
  iconRef?: (element: HTMLElement | null) => void;
  /** Whether the panel is currently open */
  isPanelOpen?: boolean;
  /** Image element to track position */
  imageElement: HTMLImageElement;
  /** Mouse enter handler */
  onMouseEnter?: () => void;
  /** Mouse leave handler */
  onMouseLeave?: () => void;
  /** Whether first chunk has been received (shows green icon instead of purple) */
  firstChunkReceived?: boolean;
  /** Whether the image is bookmarked */
  isBookmarked?: boolean;
  /** Click handler for bookmark icon */
  onBookmarkClick?: () => void;
}

/**
 * Get the icon URL for the purple xplaino icon
 */
function getPurpleIconUrl(): string {
  return chrome.runtime.getURL('src/assets/icons/xplaino-purple-icon.ico');
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

export const ImageExplanationIcon: React.FC<ImageExplanationIconProps> = ({
  position,
  isSpinning,
  onClick,
  useShadowDom = false,
  iconRef,
  isPanelOpen = false,
  imageElement,
  onMouseEnter,
  onMouseLeave,
  firstChunkReceived = false,
  isBookmarked = false,
  onBookmarkClick,
}) => {
  const iconElementRef = useRef<HTMLButtonElement | null>(null);
  const bookmarkElementRef = useRef<HTMLButtonElement | null>(null);
  const scrollableParentsRef = useRef<HTMLElement[]>([]);
  const rafIdRef = useRef<number | null>(null);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  // Update position function based on image element
  const updatePosition = useCallback(() => {
    if (!iconElementRef.current || !imageElement) return;
    
    try {
      // Get image's bounding rectangle (viewport-relative coordinates)
      const imageRect = imageElement.getBoundingClientRect();
      
      // If image is not visible, don't update position
      if (imageRect.width === 0 && imageRect.height === 0) {
        return;
      }

      // Position icon outside image, to the left of top-left corner with margin
      // left: imageRect.left - 30px (margin to left)
      // top: imageRect.top + 8px (slight margin from top)
      const iconX = imageRect.left - 30;
      const iconY = imageRect.top + 8;
      
      // Update position directly via DOM for immediate update
      iconElementRef.current.style.left = `${iconX}px`;
      iconElementRef.current.style.top = `${iconY}px`;
      
      // Update bookmark icon position if it exists
      if (bookmarkElementRef.current && isBookmarked) {
        bookmarkElementRef.current.style.left = `${iconX}px`;
        bookmarkElementRef.current.style.top = `${iconY + 28}px`; // 28px below main icon
      }
    } catch (error) {
      // Silently handle errors (image might be removed from DOM)
      console.error('[ImageExplanationIcon] Error updating position:', error);
    }
  }, [imageElement, isBookmarked]);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      updatePosition();
    });
  }, [updatePosition]);

  // Handle resize event
  const handleResize = useCallback(() => {
    updatePosition();
  }, [updatePosition]);

  // Callback ref to detect when element is mounted
  const setIconRef = useCallback((node: HTMLButtonElement | null) => {
    iconElementRef.current = node;
    if (iconRef) {
      iconRef(node);
    }
  }, [iconRef]);

  // Initial position update when ref is set
  useEffect(() => {
    if (iconElementRef.current && imageElement) {
      updatePosition();
    }
  }, [imageElement, updatePosition]);

  // Set up scroll and resize listeners
  useEffect(() => {
    if (!imageElement || !iconElementRef.current) {
      return;
    }

    // Find all scrollable parents
    scrollableParentsRef.current = findScrollableParents(imageElement);

    // Add listeners to window, document, and documentElement
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
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
      window.removeEventListener('resize', handleResize);
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
  }, [imageElement, handleScroll, handleResize, updatePosition]);

  const iconStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 2147483647,
  };

  const buttonClassName = `${getClassName('imageExplanationIcon')} ${isPanelOpen ? getClassName('panelOpen') : ''} ${firstChunkReceived ? getClassName('greenIcon') : ''}`;

  // Bookmark icon position (below the main icon) - will be updated dynamically
  const bookmarkStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`, // Same horizontal position as main icon (initial, will be updated)
    top: `${position.y + 28}px`, // 28px below the main icon (initial, will be updated)
    zIndex: 2147483647,
    width: '20px',
    height: '20px',
    padding: '2px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <button
        ref={setIconRef}
        className={buttonClassName}
        style={iconStyle}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          onMouseEnter?.();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          onMouseLeave?.();
        }}
        aria-label="Simplify image"
      >
        {isSpinning ? (
          <span 
            className={getClassName('loadingSpinner')}
          />
        ) : (
          <img
            src={firstChunkReceived ? getGreenIconUrl() : getPurpleIconUrl()}
            alt="Xplaino"
            className={getClassName('iconImage')}
          />
        )}
      </button>
      {isBookmarked && onBookmarkClick && (
        <button
          ref={bookmarkElementRef}
          style={bookmarkStyle}
          onClick={(e) => {
            e.stopPropagation();
            onBookmarkClick();
          }}
          aria-label="Remove bookmark"
          title="Remove bookmark"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={COLORS.PRIMARY}
            stroke={COLORS.PRIMARY}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </>
  );
};

ImageExplanationIcon.displayName = 'ImageExplanationIcon';

