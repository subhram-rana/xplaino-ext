// src/content/components/ImageExplanationIcon/ImageExplanationIcon.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { ExplanationIconButton } from '../ui/ExplanationIconButton';

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
  /** Whether first chunk has been received (shows green icon instead of brand icon) */
  firstChunkReceived?: boolean;
  /** Whether the image is bookmarked */
  isBookmarked?: boolean;
  /** Click handler for bookmark icon */
  onBookmarkClick?: () => void;
  /** Whether the icon is hiding (for disappear animation) */
  isHiding?: boolean;
  /** Whether to show the feature discovery tooltip ("Explain this image") on initial hover */
  shouldShowFeatureTooltip?: boolean;
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
  isHiding = false,
  shouldShowFeatureTooltip = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollableParentsRef = useRef<HTMLElement[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const animStyleInjectedRef = useRef(false);

  // Inject grow-in animation keyframes into document.head
  useEffect(() => {
    if (animStyleInjectedRef.current) return;
    const existingStyle = document.getElementById('xplaino-icon-grow-keyframes');
    if (existingStyle) {
      animStyleInjectedRef.current = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'xplaino-icon-grow-keyframes';
    style.textContent = `
      @keyframes xplainoIconGrow {
        0% { opacity: 0; transform: scale(0); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    animStyleInjectedRef.current = true;
  }, []);

  // Update position function based on image element
  const updatePosition = useCallback(() => {
    if (!containerRef.current || !imageElement) return;
    
    try {
      // Get image's bounding rectangle (viewport-relative coordinates)
      const imageRect = imageElement.getBoundingClientRect();
      
      // If image is not visible, don't update position
      if (imageRect.width === 0 && imageRect.height === 0) {
        return;
      }

      // Position container inside image, at top-left corner with small inset
      const iconX = imageRect.left + 8;
      // Only clamp Y to viewport when in initial state (brand icon, before click).
      // Once spinning or explanation received, use the original image-relative position.
      const isInitialState = !isSpinning && !firstChunkReceived;
      const iconY = isInitialState
        ? Math.max(8, imageRect.top + 8)
        : imageRect.top + 8;
      
      // Update container position directly via DOM for immediate update
      containerRef.current.style.left = `${iconX}px`;
      containerRef.current.style.top = `${iconY}px`;
    } catch (error) {
      // Silently handle errors (image might be removed from DOM)
      console.error('[ImageExplanationIcon] Error updating position:', error);
    }
  }, [imageElement, isSpinning, firstChunkReceived]);

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

  // Initial position update when container ref is set
  useEffect(() => {
    if (containerRef.current && imageElement) {
      updatePosition();
    }
  }, [imageElement, updatePosition]);

  // Set up scroll and resize listeners
  useEffect(() => {
    if (!imageElement || !containerRef.current) {
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

  // Wrapper style for fixed positioning with grow-in animation
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 2147483647,
    animation: 'xplainoIconGrow 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
  };

  return (
    <div ref={containerRef} style={wrapperStyle}>
      <ExplanationIconButton
        isSpinning={isSpinning}
        isPanelOpen={isPanelOpen}
        isBookmarked={isBookmarked}
        firstChunkReceived={firstChunkReceived}
        isHiding={isHiding}
        onClick={onClick}
        onBookmarkClick={onBookmarkClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        iconRef={iconRef as ((element: HTMLButtonElement | null) => void) | undefined}
        useShadowDom={useShadowDom}
        spinnerSize="xs"
        showPurpleIconInitially={true}
        ariaLabel="Simplify image"
        hoverMessage={firstChunkReceived ? "View explanation" : "Explain this image"}
        bookmarkHoverMessage="Remove bookmark"
        imageMode={true}
        forceShowHoverMessage={shouldShowFeatureTooltip && !firstChunkReceived && !isSpinning}
        hoverMessageVariant={shouldShowFeatureTooltip && !firstChunkReceived ? 'featureDiscovery' : 'default'}
      />
    </div>
  );
};

ImageExplanationIcon.displayName = 'ImageExplanationIcon';
