// src/hooks/useEmergeAnimation.ts
import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject, CSSProperties } from 'react';

/**
 * Animation state for emerge/shrink animations
 */
export type EmergeAnimationState = 'idle' | 'emerging' | 'shrinking' | 'visible' | 'hidden';

/**
 * Options for the emerge animation hook
 */
export interface EmergeAnimationOptions {
  /** Animation duration in milliseconds (default: 200) */
  duration?: number;
  /** CSS easing function (default: 'cubic-bezier(0.4, 0, 0.2, 1)') */
  easing?: string;
  /** Transform origin for the animation (default: 'center center') */
  transformOrigin?: string;
  /** Initial visibility state (default: false) */
  initialVisible?: boolean;
}

/**
 * Return type for the emerge animation hook
 */
export interface EmergeAnimationReturn {
  /** Ref to attach to the animated element */
  elementRef: RefObject<HTMLElement>;
  /** Ref to attach to the source element (e.g., button) */
  sourceRef: RefObject<HTMLElement>;
  /** Current animation state */
  animationState: EmergeAnimationState;
  /** Whether element is currently visible */
  isVisible: boolean;
  /** Trigger emerge animation (show) */
  emerge: () => Promise<void>;
  /** Trigger shrink animation (hide) */
  shrink: () => Promise<void>;
  /** Toggle between emerge and shrink */
  toggle: () => Promise<void>;
  /** Style object to apply to the element */
  style: CSSProperties;
  /** Whether element should be rendered (true during animations and when visible) */
  shouldRender: boolean;
  /** CSS class name to apply for the animation */
  className: string;
}

/**
 * Calculate the transform needed to move from element to source position
 * For "top right" origin: element's top-right corner should align with source's top-right corner
 */
function calculateTransform(
  elementRect: DOMRect,
  sourceRect: DOMRect,
  transformOrigin: string
): { translateX: number; translateY: number } {
  let translateX = 0;
  let translateY = 0;

  // Handle different transform origins
  if (transformOrigin.includes('left')) {
    // Align left edges
    translateX = sourceRect.left - elementRect.left;
  } else if (transformOrigin.includes('right')) {
    // Align right edges - this is what we want for "top right"
    translateX = sourceRect.right - elementRect.right;
  } else {
    // Center horizontally
    const elementCenterX = elementRect.left + elementRect.width / 2;
    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    translateX = sourceCenterX - elementCenterX;
  }

  if (transformOrigin.includes('top')) {
    // Align top edges - this is what we want for "top right"
    translateY = sourceRect.top - elementRect.top;
  } else if (transformOrigin.includes('bottom')) {
    // Align bottom edges
    translateY = sourceRect.bottom - elementRect.bottom;
  } else {
    // Center vertically
    const elementCenterY = elementRect.top + elementRect.height / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    translateY = sourceCenterY - elementCenterY;
  }

  return { translateX, translateY };
}

/**
 * Hook for emerge (appear from source) and shrink (disappear into source) animations.
 * 
 * Use this when you want a component to appear as if it's emerging from a source element
 * (like a button) while growing, and disappear by shrinking back into that source.
 * 
 * @example
 * ```tsx
 * const { elementRef, sourceRef, emerge, shrink, shouldRender, style, className } = useEmergeAnimation();
 * 
 * return (
 *   <>
 *     <button ref={sourceRef} onClick={toggle}>Open</button>
 *     {shouldRender && (
 *       <div ref={elementRef} style={style} className={className}>
 *         Content
 *       </div>
 *     )}
 *   </>
 * );
 * ```
 */
export function useEmergeAnimation(options: EmergeAnimationOptions = {}): EmergeAnimationReturn {
  const {
    duration = 200,
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin = 'center center',
    initialVisible = false,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const initialTransformRef = useRef<string | null>(null);
  const animationStartedRef = useRef<boolean>(false);

  const [animationState, setAnimationState] = useState<EmergeAnimationState>(
    initialVisible ? 'visible' : 'hidden'
  );
  const [isVisible, setIsVisible] = useState(initialVisible);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
      }
    };
  }, []);

  // Reset flags when state changes
  useEffect(() => {
    if (animationState === 'visible' || animationState === 'hidden') {
      animationStartedRef.current = false;
      if (animationState === 'hidden') {
        initialTransformRef.current = null;
      }
    }
  }, [animationState]);

  // Removed useLayoutEffect - it was running before source was available
  // Now we handle everything synchronously in emerge() after both element and source are ready

  /**
   * Trigger emerge animation (appear from source)
   */
  const emerge = useCallback(async (): Promise<void> => {
    console.log('[useEmergeAnimation] emerge() called - current state:', {
      animationState,
      isVisible,
      animationStarted: animationStartedRef.current,
    });

    if (animationState === 'emerging' || animationState === 'visible') {
      console.log('[useEmergeAnimation] emerge() - already emerging or visible, returning early');
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current) {
      console.log('[useEmergeAnimation] emerge() - cancelling existing animation');
      animationRef.current.cancel();
    }

    console.log('[useEmergeAnimation] emerge() - setting state to emerging');
    setAnimationState('emerging');
    setIsVisible(true);

    // Wait for element and source to be available
    // Poll until both are rendered (with a timeout to prevent infinite wait)
    console.log('[useEmergeAnimation] emerge() - waiting for element and source to be available');
    let element = elementRef.current;
    let source = sourceRef.current;
    let attempts = 0;
    const maxAttempts = 10; // Wait up to 10 frames (~166ms at 60fps)

    while ((!element || !source) && attempts < maxAttempts) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      element = elementRef.current;
      source = sourceRef.current;
      attempts++;
      console.log(`[useEmergeAnimation] emerge() - attempt ${attempts}:`, {
        hasElement: !!element,
        hasSource: !!source,
      });
    }

    console.log('[useEmergeAnimation] emerge() - after waiting:', {
      hasElement: !!element,
      hasSource: !!source,
      elementTag: element?.tagName,
      sourceTag: source?.tagName,
      attempts,
    });

    if (!element || !source) {
      console.warn('[useEmergeAnimation] emerge() - missing element or source after waiting, setting to visible');
      setAnimationState('visible');
      return;
    }

    // Calculate initial transform now that both element and source are available
    console.log('[useEmergeAnimation] emerge() - calculating transform');
    const elementRect = element.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const { translateX, translateY } = calculateTransform(elementRect, sourceRect, transformOrigin);
    
    console.log('[useEmergeAnimation] emerge() - calculated transform:', {
      elementRect: {
        left: elementRect.left,
        top: elementRect.top,
        right: elementRect.right,
        bottom: elementRect.bottom,
        width: elementRect.width,
        height: elementRect.height,
      },
      sourceRect: {
        left: sourceRect.left,
        top: sourceRect.top,
        right: sourceRect.right,
        bottom: sourceRect.bottom,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      translateX,
      translateY,
      transformOrigin,
    });
    
    const initialTransform = `translate(${translateX}px, ${translateY}px) scale(0)`;
    initialTransformRef.current = initialTransform;
    
    // Apply transform synchronously to prevent flash, then immediately start animation
    // Force a reflow to ensure transform is applied before animation starts
    element.style.transform = initialTransform;
    void element.offsetHeight; // Force synchronous reflow
    
    console.log('[useEmergeAnimation] emerge() - applied transform:', initialTransform);

    // Mark that animation has started
    animationStartedRef.current = true;
    console.log('[useEmergeAnimation] emerge() - starting animation with:', {
      initialTransform,
      duration,
      easing,
    });

    try {
      // Use Web Animations API for smooth animation
      // Start from the initial transform (already applied above)
      // Web Animation will override the inline style
      animationRef.current = element.animate(
        [
          {
            transform: initialTransform,
          },
          {
            transform: 'translate(0, 0) scale(1)',
          },
        ],
        {
          duration,
          easing,
          fill: 'forwards',
        }
      );

      console.log('[useEmergeAnimation] emerge() - animation created, waiting for finish');
      await animationRef.current.finished;
      console.log('[useEmergeAnimation] emerge() - animation finished, setting to visible');
      setAnimationState('visible');
    } catch (error) {
      // Animation was cancelled or failed - set to visible as fallback
      console.error('[useEmergeAnimation] emerge() - animation error:', error);
      setAnimationState('visible');
    }
  }, [animationState, duration, easing, transformOrigin, isVisible]);

  /**
   * Trigger shrink animation (disappear into source)
   */
  const shrink = useCallback(async (): Promise<void> => {
    if (animationState === 'shrinking' || animationState === 'hidden') {
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current) {
      animationRef.current.cancel();
    }

    setAnimationState('shrinking');

    const element = elementRef.current;
    const source = sourceRef.current;

    if (!element || !source) {
      setAnimationState('hidden');
      setIsVisible(false);
      return;
    }

    // Get current positions - element should be at translate(0,0) scale(1) at this point
    // We need to calculate where it should move to (source button's top-right corner)
    const elementRect = element.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    
    // Calculate transform to move element's top-right corner to source's top-right corner
    const { translateX, translateY } = calculateTransform(elementRect, sourceRect, transformOrigin);

    // Start from the final visible state (translate(0,0) scale(1))
    // The animation fill: 'forwards' should have kept it at this state
    const startTransform = 'translate(0, 0) scale(1)';
    const finalTransform = `translate(${translateX}px, ${translateY}px) scale(0)`;

    try {
      // Use Web Animations API for smooth animation
      // Keep opacity at 1 throughout - only animate transform
      animationRef.current = element.animate(
        [
          {
            transform: startTransform,
          },
          {
            transform: finalTransform,
          },
        ],
        {
          duration,
          easing,
          fill: 'forwards',
        }
      );

      await animationRef.current.finished;
      setAnimationState('hidden');
      setIsVisible(false);
    } catch {
      // Animation was cancelled or failed - set to hidden as fallback
      setAnimationState('hidden');
      setIsVisible(false);
    }
  }, [animationState, duration, easing, transformOrigin]);

  /**
   * Toggle between emerge and shrink
   */
  const toggle = useCallback(async (): Promise<void> => {
    if (animationState === 'visible' || animationState === 'emerging') {
      await shrink();
    } else {
      await emerge();
    }
  }, [animationState, emerge, shrink]);

  // Calculate styles
  const style: CSSProperties = {
    transformOrigin,
    // Don't set transform in style - let useLayoutEffect and animations handle it
    // This prevents conflicts between style transform and animation transform
  };

  // Calculate class name based on animation state
  const className = animationState === 'emerging' 
    ? 'emerge-animation' 
    : animationState === 'shrinking' 
      ? 'shrink-animation' 
      : '';

  // Determine if element should be rendered
  const shouldRender = isVisible || animationState === 'emerging' || animationState === 'shrinking';

  return {
    elementRef,
    sourceRef,
    animationState,
    isVisible,
    emerge,
    shrink,
    toggle,
    style,
    shouldRender,
    className,
  };
}

export default useEmergeAnimation;

