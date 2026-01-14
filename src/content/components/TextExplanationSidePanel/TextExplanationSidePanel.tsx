// src/content/components/TextExplanationSidePanel/TextExplanationSidePanel.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import type { RefObject } from 'react';
import styles from './TextExplanationSidePanel.module.css';
import { TextExplanationHeader } from './TextExplanationHeader';
import { TextExplanationFooter } from './TextExplanationFooter';
import { TextExplanationView } from './TextExplanationView';
import { UpgradeFooter } from '../BaseSidePanel/UpgradeFooter';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { showLoginModalAtom } from '@/store/uiAtoms';
import { useEmergeAnimation } from '@/hooks/useEmergeAnimation';

export interface TextExplanationSidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Ref to the icon element for emerge animation */
  iconRef?: RefObject<HTMLElement> | null;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Callback when login is required (401 error) */
  onLoginRequired?: () => void;
  /** Streaming text content */
  streamingText?: string;
  /** View mode */
  viewMode?: 'contextual' | 'translation';
  /** Possible questions from API */
  possibleQuestions?: string[];
  /** Handler for view mode changes */
  onViewModeChange?: (mode: 'contextual' | 'translation') => void;
  /** Handler for question clicks */
  onQuestionClick?: (question: string) => void;
  /** Handler for input submission */
  onInputSubmit?: (text: string) => void;
  /** Handler for bookmark */
  onBookmark?: () => void;
  /** Handler for remove */
  onRemove?: () => void;
  /** Handler for view original */
  onViewOriginal?: () => void;
  /** Chat messages */
  chatMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Message questions per message index */
  messageQuestions?: Record<number, string[]>;
  /** Handler for clear chat */
  onClearChat?: () => void;
  /** Handler for stop request */
  onStopRequest?: () => void;
  /** Whether a request is currently in progress */
  isRequesting?: boolean;
  /** Whether to show Simplify button */
  shouldAllowSimplifyMore?: boolean;
  /** Handler for Simplify button click */
  onSimplify?: () => void;
  /** Whether simplify API is in progress */
  isSimplifying?: boolean;
  /** Whether to show header icons (hide when content is empty) */
  showHeaderIcons?: boolean;
  /** Whether to show the delete icon (only show when there's content) */
  showDeleteIcon?: boolean;
  /** Pending question that was clicked but API hasn't responded yet */
  pendingQuestion?: string;
  /** Whether first chunk has been received from API */
  firstChunkReceived?: boolean;
  /** Translations array */
  translations?: Array<{ language: string; translated_content: string }>;
  /** Handler for translate button click */
  onTranslate?: (language: string) => void;
  /** Whether translation is in progress */
  isTranslating?: boolean;
  /** Callback to register the close handler for external animated close */
  onCloseHandlerReady?: (handler: () => void) => void;
  /** Whether the text is bookmarked */
  isBookmarked?: boolean;
  /** Whether to hide the tab group footer (used for image explanations) */
  hideFooter?: boolean;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export const TextExplanationSidePanel: React.FC<TextExplanationSidePanelProps> = ({
  isOpen,
  onClose,
  iconRef,
  useShadowDom = false,
  onLoginRequired,
  streamingText = '',
  viewMode = 'contextual',
  possibleQuestions = [],
  onViewModeChange,
  onQuestionClick,
  onInputSubmit,
  onBookmark,
  onRemove,
  onViewOriginal,
  chatMessages = [],
  messageQuestions = {},
  onClearChat,
  onStopRequest,
  isRequesting = false,
  shouldAllowSimplifyMore = false,
  onSimplify,
  isSimplifying = false,
  showHeaderIcons = true,
  showDeleteIcon = false,
  pendingQuestion,
  firstChunkReceived = false,
  translations = [],
  onTranslate,
  isTranslating = false,
  onCloseHandlerReady,
  isBookmarked = false,
  hideFooter = false,
}) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const hasEmergedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const isAnimatingRef = useRef(false); // Prevent double animations
  const previousIsOpenRef = useRef(false); // Start with false so first mount with isOpen=true triggers animation
  
  // Reset isUnmountingRef when component is open (handles reopening after close)
  if (isOpen) {
    isUnmountingRef.current = false;
  }
  
  // Jotai setter for login modal
  const setShowLoginModal = useSetAtom(showLoginModalAtom);

  // Animation hook
  const {
    elementRef,
    sourceRef: animationSourceRef,
    emerge,
    shrink,
    style: animationStyle,
  } = useEmergeAnimation({
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'top right',
  });

  // Sync sourceRef with iconRef prop immediately when iconRef changes
  // This ensures the animation targets the correct element
  useEffect(() => {
    if (iconRef?.current) {
      console.log('[TextExplanationSidePanel] Syncing iconRef:', iconRef.current.tagName, iconRef.current.className);
      (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = iconRef.current;
    }
  }, [iconRef, animationSourceRef]);

  // Handle login required callback (from API errors)
  const handleLoginRequired = useCallback(() => {
    setShowLoginModal(true);
    onLoginRequired?.();
  }, [onLoginRequired, setShowLoginModal]);

  // Get class name based on context (Shadow DOM vs CSS Modules)
  const getClassName = useCallback((shadowClass: string, moduleClass: string) => {
    return useShadowDom ? shadowClass : moduleClass;
  }, [useShadowDom]);

  // Handle resize start - attach listeners directly for Shadow DOM compatibility
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const startX = e.clientX;
      const startWidth = width;
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Since panel is on the right, dragging left increases width
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
      setIsVerticallyExpanded(expanded);
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

  // Trigger emerge animation when panel opens (only once)
  // Track previous isOpen state to detect actual state changes
  useEffect(() => {
    const previousIsOpen = previousIsOpenRef.current;
    const isOpening = !previousIsOpen && isOpen;
    const isClosing = previousIsOpen && !isOpen;
    
    // Update previous state
    previousIsOpenRef.current = isOpen;
    
    // Only trigger animation when isOpen changes from false to true
    // Also check isAnimatingRef to prevent double animations
    if (isOpening && !hasEmergedRef.current && !isUnmountingRef.current && !isAnimatingRef.current) {
      hasEmergedRef.current = true;
      isAnimatingRef.current = true;
      
      console.log('[TextExplanationSidePanel] Emerge animation starting...');
      
      // Sync iconRef before animation starts
      if (iconRef?.current) {
        const iconElement = iconRef.current;
        const iconRect = iconElement.getBoundingClientRect();
        console.log('[TextExplanationSidePanel] Pre-emerge sync iconRef:', {
          tag: iconElement.tagName,
          className: iconElement.className,
          position: { left: iconRect.left, top: iconRect.top, right: iconRect.right, bottom: iconRect.bottom }
        });
        (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = iconElement;
      }
      
      // Trigger emerge immediately without setTimeout to prevent flash
      if (!isUnmountingRef.current) {
        emerge()
          .then(() => {
            console.log('[TextExplanationSidePanel] Emerge animation completed');
            isAnimatingRef.current = false;
          })
          .catch((error) => {
            isAnimatingRef.current = false;
            // Ignore errors if component is unmounting or if it's an abort error
            if (!isUnmountingRef.current && (error as Error)?.name !== 'AbortError') {
              console.error('[TextExplanationSidePanel] Emerge animation error:', error);
            }
          });
      } else {
        isAnimatingRef.current = false;
      }
    } else if (isClosing) {
      // Only reset when isOpen actually changes from true to false
      hasEmergedRef.current = false;
      isAnimatingRef.current = false;
    }
  }, [isOpen, iconRef, animationSourceRef]); // Added iconRef and animationSourceRef for sync

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  // Handle close with shrink animation
  const handleClose = useCallback(async () => {
    console.log('[TextExplanationSidePanel] handleClose called');
    
    if (isUnmountingRef.current || isAnimatingRef.current) {
      console.log('[TextExplanationSidePanel] Already closing or animating, skipping');
      return; // Already closing/unmounting or animation in progress
    }
    isUnmountingRef.current = true;
    isAnimatingRef.current = true;
    
    try {
      // Ensure iconRef is synced before shrink animation
      // Log to debug which element we're shrinking toward
      if (iconRef?.current) {
        const iconElement = iconRef.current;
        const iconRect = iconElement.getBoundingClientRect();
        console.log('[TextExplanationSidePanel] Shrink target (iconRef):', {
          tag: iconElement.tagName,
          className: iconElement.className,
          position: { left: iconRect.left, top: iconRect.top, right: iconRect.right, bottom: iconRect.bottom }
        });
        (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = iconElement;
        console.log('[TextExplanationSidePanel] Starting shrink animation...');
        await shrink();
      } else {
        console.warn('[TextExplanationSidePanel] No iconRef.current available for shrink animation! Attempting to find icon element...');
        // Try to find the icon element from the active explanation's icon container
        // This is a fallback in case iconRef wasn't set properly
        const textExplanationIconHost = document.getElementById('xplaino-text-explanation-icon-host');
        if (textExplanationIconHost?.shadowRoot) {
          // Try to find the green icon button (not the bookmark button)
          // Look for the first .textExplanationIcon button in a .bookmarkedIconContainer or standalone
          const bookmarkedContainer = textExplanationIconHost.shadowRoot.querySelector('.bookmarkedIconContainer');
          const iconButton = (bookmarkedContainer 
            ? bookmarkedContainer.querySelector('.textExplanationIcon')
            : textExplanationIconHost.shadowRoot.querySelector('.textExplanationIcon')) as HTMLElement;
          if (iconButton) {
            console.log('[TextExplanationSidePanel] Found icon element in DOM, using it for shrink animation');
            (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = iconButton;
            await shrink();
          } else {
            console.warn('[TextExplanationSidePanel] Could not find icon element, closing without animation');
            isAnimatingRef.current = false;
            onClose?.();
            return;
          }
        } else {
          console.warn('[TextExplanationSidePanel] Could not find icon container, closing without animation');
          isAnimatingRef.current = false;
          onClose?.();
          return;
        }
      }
      console.log('[TextExplanationSidePanel] Shrink animation completed successfully');
      
      // Call onClose AFTER animation completes, not in finally
      isAnimatingRef.current = false;
      console.log('[TextExplanationSidePanel] Calling onClose...');
      onClose?.();
    } catch (error) {
      console.error('[TextExplanationSidePanel] Shrink animation error:', error);
      // On error, still call onClose to allow component to close
      isAnimatingRef.current = false;
      onClose?.();
    }
  }, [shrink, onClose, iconRef, animationSourceRef]);

  // Register the close handler with parent so icon toggle can trigger animated close
  useEffect(() => {
    if (onCloseHandlerReady) {
      console.log('[TextExplanationSidePanel] Registering close handler with parent');
      onCloseHandlerReady(handleClose);
    }
  }, [handleClose, onCloseHandlerReady]);

  const handleVerticalExpand = useCallback(() => {
    setIsVerticallyExpanded((prev) => !prev);
  }, []);

  // Don't render if not open
  // Note: We render when isOpen is true, and let the animation hook handle visibility
  // The element needs to be in the DOM for the animation to work
  if (!isOpen) {
    return null;
  }

  // Class names for Shadow DOM vs CSS Modules
  const sidePanelClass = getClassName(
    `textExplanationSidePanel open ${isVerticallyExpanded ? 'verticallyExpanded' : ''}`,
    `${styles.textExplanationSidePanel} ${styles.open} ${isVerticallyExpanded ? styles.verticallyExpanded : ''}`
  );
  const resizeHandleClass = getClassName('resizeHandle', styles.resizeHandle);
  const contentClass = getClassName('content', styles.content);

  // Merge animation style with panel width style
  // Disable CSS transitions when animation is active to prevent conflicts
  const panelStyle: React.CSSProperties = {
    ...animationStyle,
    '--panel-width': `${width}px`,
    transition: 'none', // Disable CSS transitions - animation hook handles it
  } as React.CSSProperties;

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={sidePanelClass}
      style={panelStyle}
    >
      {/* Resize Handle */}
      <div
        className={resizeHandleClass}
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <TextExplanationHeader
        onClose={handleClose}
        onVerticalExpand={handleVerticalExpand}
        onBookmark={onBookmark}
        onRemove={onRemove}
        onViewOriginal={onViewOriginal}
        useShadowDom={useShadowDom}
        isExpanded={isVerticallyExpanded}
        showRightIcons={showHeaderIcons}
        isBookmarked={isBookmarked}
        showDeleteIcon={showDeleteIcon}
        viewMode={viewMode}
      />

      {/* Content */}
      <div className={contentClass}>
        <TextExplanationView
          useShadowDom={useShadowDom}
          onLoginRequired={handleLoginRequired}
          streamingText={streamingText}
          viewMode={viewMode}
          possibleQuestions={possibleQuestions}
          onQuestionClick={onQuestionClick}
          onInputSubmit={onInputSubmit}
          chatMessages={chatMessages}
          messageQuestions={messageQuestions}
          onClearChat={onClearChat}
          onStopRequest={onStopRequest}
          isRequesting={isRequesting}
          shouldAllowSimplifyMore={shouldAllowSimplifyMore}
          onSimplify={onSimplify}
          isSimplifying={isSimplifying}
          pendingQuestion={pendingQuestion}
          firstChunkReceived={firstChunkReceived}
          translations={translations}
          onTranslate={onTranslate}
          isTranslating={isTranslating}
        />
      </div>

      {/* Tab Group (hidden when hideFooter is true, e.g. for image explanations) */}
      {!hideFooter && (
        <TextExplanationFooter
          useShadowDom={useShadowDom}
          activeView={viewMode}
          onViewChange={onViewModeChange}
        />
      )}

      {/* Upgrade Footer with coupon and upgrade buttons (always shown) */}
      <UpgradeFooter useShadowDom={useShadowDom} />
    </div>
  );
};

TextExplanationSidePanel.displayName = 'TextExplanationSidePanel';

