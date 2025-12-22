// src/content/components/TextExplanationSidePanel/TextExplanationSidePanel.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import styles from './TextExplanationSidePanel.module.css';
import { TextExplanationHeader } from './TextExplanationHeader';
import { TextExplanationFooter } from './TextExplanationFooter';
import { TextExplanationView } from './TextExplanationView';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { showLoginModalAtom } from '@/store/uiAtoms';

export interface TextExplanationSidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
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
  /** Pending question that was clicked but API hasn't responded yet */
  pendingQuestion?: string;
  /** Whether first chunk has been received from API */
  firstChunkReceived?: boolean;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export const TextExplanationSidePanel: React.FC<TextExplanationSidePanelProps> = ({
  isOpen,
  onClose,
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
  pendingQuestion,
  firstChunkReceived = false,
}) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const [isSlidingOut, setIsSlidingOut] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Jotai setter for login modal
  const setShowLoginModal = useSetAtom(showLoginModalAtom);

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

  // Reset sliding state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsSlidingOut(false);
    }
  }, [isOpen]);

  const handleSlideOut = useCallback(() => {
    setIsSlidingOut(true);
    setTimeout(() => {
      onClose?.();
    }, 300); // Match transition duration
  }, [onClose]);

  const handleVerticalExpand = useCallback(() => {
    setIsVerticallyExpanded((prev) => !prev);
  }, []);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Class names for Shadow DOM vs CSS Modules
  const sidePanelClass = getClassName(
    `textExplanationSidePanel ${isOpen ? 'open' : ''} ${isSlidingOut ? 'slidingOut' : ''} ${isVerticallyExpanded ? 'verticallyExpanded' : ''}`,
    `${styles.textExplanationSidePanel} ${isOpen ? styles.open : ''} ${isSlidingOut ? styles.slidingOut : ''} ${isVerticallyExpanded ? styles.verticallyExpanded : ''}`
  );
  const resizeHandleClass = getClassName('resizeHandle', styles.resizeHandle);
  const contentClass = getClassName('content', styles.content);

  return (
    <div
      ref={panelRef}
      className={sidePanelClass}
      style={{ 
        '--panel-width': `${width}px`,
      } as React.CSSProperties }
    >
      {/* Resize Handle */}
      <div
        className={resizeHandleClass}
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <TextExplanationHeader
        onSlideOut={handleSlideOut}
        onVerticalExpand={handleVerticalExpand}
        onBookmark={onBookmark}
        onRemove={onRemove}
        onViewOriginal={onViewOriginal}
        useShadowDom={useShadowDom}
        isExpanded={isVerticallyExpanded}
        showRightIcons={showHeaderIcons}
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
        />
      </div>

      {/* Footer */}
      <TextExplanationFooter
        useShadowDom={useShadowDom}
        activeView={viewMode}
        onViewChange={onViewModeChange}
      />
    </div>
  );
};

TextExplanationSidePanel.displayName = 'TextExplanationSidePanel';

