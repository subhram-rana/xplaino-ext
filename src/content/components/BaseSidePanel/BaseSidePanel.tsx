// src/content/components/BaseSidePanel/BaseSidePanel.tsx
// Unified base side panel component that all panels can use
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { useAtomValue } from 'jotai';
import styles from './BaseSidePanel.module.css';
import { UpgradeFooter } from './UpgradeFooter';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { useEmergeAnimation } from '@/hooks/useEmergeAnimation';
import { isFreeTrialAtom } from '@/store/uiAtoms';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export interface BaseSidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Header content - pass a React node */
  header: React.ReactNode;
  /** Main content - pass a React node */
  content: React.ReactNode;
  /** Optional footer content - pass a React node for custom footer */
  footer?: React.ReactNode;
  /** Whether to show the upgrade footer with coupon and upgrade buttons */
  showUpgradeFooter?: boolean;
  /** Whether to use emerge/shrink animation */
  useAnimation?: boolean;
  /** Ref to the source element for emerge/shrink animation */
  animationSourceRef?: RefObject<HTMLElement> | null;
  /** Callback to register the close handler for external animated close */
  onCloseHandlerReady?: (handler: () => void) => void;
  /** Additional class name for the panel */
  className?: string;
  /** Whether the panel is vertically expanded (controlled externally) */
  isVerticallyExpanded?: boolean;
  /** Callback when vertical expand state changes */
  onVerticalExpandChange?: (expanded: boolean) => void;
  /** Whether panel uses slide animation (like SidePanel) instead of emerge animation */
  useSlideAnimation?: boolean;
  /** Whether panel is sliding out (for slide animation) */
  isSlidingOut?: boolean;
}

export const BaseSidePanel: React.FC<BaseSidePanelProps> = ({
  isOpen,
  onClose,
  useShadowDom = false,
  header,
  content,
  footer,
  showUpgradeFooter = false,
  useAnimation = false,
  animationSourceRef,
  onCloseHandlerReady,
  className = '',
  isVerticallyExpanded: externalExpanded,
  onVerticalExpandChange: _onVerticalExpandChange,
  useSlideAnimation = false,
  isSlidingOut = false,
}) => {
  // Subscription status for conditional upgrade footer
  const isFreeTrial = useAtomValue(isFreeTrialAtom);
  
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const hasEmergedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const previousIsOpenRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Use external expanded state if provided, otherwise internal
  const isVerticallyExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;

  // Reset isUnmountingRef when component is open (handles reopening after close)
  if (isOpen) {
    isUnmountingRef.current = false;
  }

  // Animation hook (only used when useAnimation is true)
  const {
    elementRef,
    sourceRef: animationHookSourceRef,
    emerge,
    shrink,
    style: animationStyle,
  } = useEmergeAnimation({
    duration: 400,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'top right',
  });

  // Sync sourceRef with animationSourceRef prop when it changes
  useEffect(() => {
    if (useAnimation && animationSourceRef?.current) {
      (animationHookSourceRef as React.MutableRefObject<HTMLElement | null>).current = animationSourceRef.current;
    }
  }, [useAnimation, animationSourceRef, animationHookSourceRef]);

  // Get class name based on context (Shadow DOM vs CSS Modules)
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = width;

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [width]
  );

  // Load expanded state from storage on mount
  useEffect(() => {
    const loadExpandedState = async () => {
      const domain = window.location.hostname;
      const expanded = await ChromeStorage.getSidePanelExpanded(domain);
      setInternalExpanded(expanded);
      setExpandedLoaded(true);
    };
    loadExpandedState();
  }, []);

  // Save expanded state when it changes (after initial load)
  useEffect(() => {
    if (!expandedLoaded) return;
    const domain = window.location.hostname;
    ChromeStorage.setSidePanelExpanded(domain, isVerticallyExpanded);
  }, [isVerticallyExpanded, expandedLoaded]);

  // Trigger emerge animation when panel opens (only when useAnimation is true)
  useEffect(() => {
    if (!useAnimation) return;

    const previousIsOpen = previousIsOpenRef.current;
    const isOpening = !previousIsOpen && isOpen;
    const isClosing = previousIsOpen && !isOpen;

    previousIsOpenRef.current = isOpen;

    if (isOpening && !hasEmergedRef.current && !isUnmountingRef.current && !isAnimatingRef.current) {
      hasEmergedRef.current = true;
      isAnimatingRef.current = true;

      if (animationSourceRef?.current) {
        (animationHookSourceRef as React.MutableRefObject<HTMLElement | null>).current = animationSourceRef.current;
      }

      if (!isUnmountingRef.current) {
        emerge()
          .then(() => {
            isAnimatingRef.current = false;
          })
          .catch((error) => {
            isAnimatingRef.current = false;
            if (!isUnmountingRef.current && (error as Error)?.name !== 'AbortError') {
              console.error('[BaseSidePanel] Emerge animation error:', error);
            }
          });
      } else {
        isAnimatingRef.current = false;
      }
    } else if (isClosing) {
      hasEmergedRef.current = false;
      isAnimatingRef.current = false;
    }
  }, [isOpen, useAnimation, animationSourceRef, animationHookSourceRef, emerge]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  // Handle close with shrink animation (when useAnimation is true)
  const handleClose = useCallback(async () => {
    if (isUnmountingRef.current || isAnimatingRef.current) {
      return;
    }
    isUnmountingRef.current = true;
    isAnimatingRef.current = true;

    try {
      if (useAnimation && animationSourceRef?.current) {
        (animationHookSourceRef as React.MutableRefObject<HTMLElement | null>).current = animationSourceRef.current;
        await shrink();
      }
      isAnimatingRef.current = false;
      onClose?.();
    } catch (error) {
      console.error('[BaseSidePanel] Shrink animation error:', error);
      isAnimatingRef.current = false;
      onClose?.();
    }
  }, [useAnimation, shrink, onClose, animationSourceRef, animationHookSourceRef]);

  // Register the close handler with parent
  useEffect(() => {
    if (onCloseHandlerReady && useAnimation) {
      onCloseHandlerReady(handleClose);
    }
  }, [handleClose, onCloseHandlerReady, useAnimation]);

  // Note: handleVerticalExpand is defined in the useVerticalExpand hook below

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Build class names
  const panelClasses = [
    getClassName('baseSidePanel', styles.baseSidePanel),
    isVerticallyExpanded ? getClassName('verticallyExpanded', styles.verticallyExpanded) : '',
    useSlideAnimation && isOpen ? getClassName('open', styles.open) : '',
    useSlideAnimation && isSlidingOut ? getClassName('slidingOut', styles.slidingOut) : '',
    className,
  ].filter(Boolean).join(' ');

  const resizeHandleClass = getClassName('resizeHandle', styles.resizeHandle);
  const contentClass = getClassName('baseSidePanelContent', styles.baseSidePanelContent);

  // Build panel style
  const panelStyle: React.CSSProperties = {
    ...(useAnimation ? animationStyle : {}),
    '--panel-width': `${width}px`,
    ...(useAnimation ? { transition: 'none' } : {}),
  } as React.CSSProperties;

  // Use appropriate ref
  const refToUse = useAnimation 
    ? elementRef as React.RefObject<HTMLDivElement>
    : panelRef;

  return (
    <div
      ref={refToUse}
      className={panelClasses}
      style={panelStyle}
    >
      {/* Resize Handle */}
      <div
        className={resizeHandleClass}
        onMouseDown={handleResizeStart}
      />

      {/* Header Slot */}
      {header}

      {/* Content Slot */}
      <div className={contentClass}>
        {content}
      </div>

      {/* Footer Slot (optional custom footer) */}
      {footer}

      {/* Upgrade Footer - only shown for free trial users when enabled */}
      {showUpgradeFooter && isFreeTrial && <UpgradeFooter useShadowDom={useShadowDom} />}
    </div>
  );
};

BaseSidePanel.displayName = 'BaseSidePanel';

// Export helper for vertical expand handler
export const useVerticalExpand = () => {
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const handleVerticalExpand = useCallback(() => {
    setIsVerticallyExpanded((prev) => !prev);
  }, []);
  return { isVerticallyExpanded, handleVerticalExpand, setIsVerticallyExpanded };
};
