// src/content/components/WordAskAISidePanel/WordAskAISidePanel.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { ArrowUp, Square, Trash2, Plus, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import styles from './WordAskAISidePanel.module.css';
import { ChatMessage } from '@/store/wordExplanationAtoms';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { useEmergeAnimation } from '@/hooks/useEmergeAnimation';
import { MinimalCouponButton } from '../HighlightedCoupon';
import { HighlightedCoupon } from '../HighlightedCoupon';

// Custom expand icon - arrows pointing away from center (up and down)
const ExpandVerticalIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Arrow pointing up */}
    <polyline points="8 5 12 1 16 5" />
    {/* Arrow pointing down */}
    <polyline points="8 19 12 23 16 19" />
    {/* Center line */}
    <line x1="12" y1="1" x2="12" y2="23" />
  </svg>
);

// Custom contract icon - arrows pointing toward center
const ContractVerticalIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Arrow pointing down (from top) */}
    <polyline points="8 8 12 12 16 8" />
    {/* Arrow pointing up (from bottom) */}
    <polyline points="8 16 12 12 16 16" />
    {/* Top line */}
    <line x1="12" y1="1" x2="12" y2="12" />
    {/* Bottom line */}
    <line x1="12" y1="12" x2="12" y2="23" />
  </svg>
);

export interface WordAskAISidePanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose?: () => void;
  /** The word being asked about */
  word: string;
  /** Ref to the Ask AI button for emerge animation */
  buttonRef?: RefObject<HTMLElement> | null;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
  /** Chat history */
  chatHistory: ChatMessage[];
  /** Questions per message index */
  messageQuestions: Record<number, string[]>;
  /** Current streaming text from assistant */
  streamingText: string;
  /** Whether a request is in progress */
  isRequesting: boolean;
  /** Handler to send a message */
  onSendMessage: (question: string) => void;
  /** Handler to stop ongoing request */
  onStopRequest: () => void;
  /** Handler to clear chat */
  onClearChat: () => void;
  /** Callback to register the close handler for external animated close */
  onCloseHandlerReady?: (handler: () => void) => void;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 560;

export const WordAskAISidePanel: React.FC<WordAskAISidePanelProps> = ({
  isOpen,
  onClose,
  word,
  buttonRef,
  useShadowDom = false,
  chatHistory,
  messageQuestions,
  streamingText,
  isRequesting,
  onSendMessage,
  onStopRequest,
  onClearChat,
  onCloseHandlerReady,
}) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isVerticallyExpanded, setIsVerticallyExpanded] = useState(false);
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loadingDotCount, setLoadingDotCount] = useState(1);
  const hasEmergedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const previousIsOpenRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Reset isUnmountingRef when component is open
  if (isOpen) {
    isUnmountingRef.current = false;
  }

  // Animation hook - merge and shrink animations use 400ms duration
  const {
    elementRef,
    sourceRef: animationSourceRef,
    emerge,
    shrink,
    style: animationStyle,
  } = useEmergeAnimation({
    duration: 400, // 400ms for merge and shrink animations
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'top right',
  });

  // Sync sourceRef with buttonRef prop
  useEffect(() => {
    if (buttonRef?.current) {
      console.log('[WordAskAISidePanel] Syncing buttonRef');
      (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = buttonRef.current;
    }
  }, [buttonRef, animationSourceRef]);

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

  // Load expanded state from storage
  useEffect(() => {
    const loadExpandedState = async () => {
      const domain = window.location.hostname;
      const expanded = await ChromeStorage.getSidePanelExpanded(domain);
      setIsVerticallyExpanded(expanded);
      setExpandedLoaded(true);
    };
    loadExpandedState();
  }, []);

  // Save expanded state when it changes
  useEffect(() => {
    if (!expandedLoaded) return;
    const domain = window.location.hostname;
    ChromeStorage.setSidePanelExpanded(domain, isVerticallyExpanded);
  }, [isVerticallyExpanded, expandedLoaded]);

  // Animate loading dots (1-3 dots)
  useEffect(() => {
    if (!isRequesting || streamingText) return;

    const interval = setInterval(() => {
      setLoadingDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [isRequesting, streamingText]);

  const handleVerticalExpand = useCallback(() => {
    setIsVerticallyExpanded((prev) => !prev);
  }, []);

  const handleClose = useCallback(async () => {
    if (isUnmountingRef.current || isAnimatingRef.current) {
      console.log('[WordAskAISidePanel] Already unmounting/animating, ignoring close');
      return;
    }
    
    console.log('[WordAskAISidePanel] Closing with shrink animation');
    isUnmountingRef.current = true;
    isAnimatingRef.current = true;
    
    try {
      await shrink();
      console.log('[WordAskAISidePanel] Shrink animation complete');
    } catch (error) {
      console.error('[WordAskAISidePanel] Shrink animation error:', error);
    } finally {
      isAnimatingRef.current = false;
      hasEmergedRef.current = false;
      onClose?.();
    }
  }, [shrink, onClose]);

  // Register close handler for external animated close
  useEffect(() => {
    onCloseHandlerReady?.(handleClose);
  }, [handleClose, onCloseHandlerReady]);

  // Handle emerge/shrink based on isOpen
  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    previousIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen && !hasEmergedRef.current && !isAnimatingRef.current) {
      console.log('[WordAskAISidePanel] Emerging');
      isAnimatingRef.current = true;
      emerge()
        .then(() => {
          console.log('[WordAskAISidePanel] Emerge complete');
          hasEmergedRef.current = true;
        })
        .catch((error) => {
          console.error('[WordAskAISidePanel] Emerge error:', error);
        })
        .finally(() => {
          isAnimatingRef.current = false;
        });
    }
  }, [isOpen, emerge]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, streamingText]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isRequesting) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  }, [inputValue, isRequesting, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handlePromptClick = useCallback((prompt: string) => {
    if (isRequesting) return;
    onSendMessage(prompt);
  }, [isRequesting, onSendMessage]);

  // Built-in prompts
  const builtInPrompts = ['Explain more', 'Give examples', 'How to use?'];

  // Class names
  const sidePanelClass = getClassName(
    `wordAskAISidePanel ${isOpen ? 'open' : ''} ${isVerticallyExpanded ? 'verticallyExpanded' : ''}`,
    `${styles.wordAskAISidePanel} ${isOpen ? styles.open : ''} ${isVerticallyExpanded ? styles.verticallyExpanded : ''}`
  );
  const resizeHandleClass = getClassName('resizeHandle', styles.resizeHandle);
  const headerClass = getClassName('header', styles.header);
  const headerLeftClass = getClassName('headerLeft', styles.headerLeft);
  const headerCenterClass = getClassName('headerCenter', styles.headerCenter);
  const headerRightClass = getClassName('headerRight', styles.headerRight);
  const headerTitleClass = getClassName('headerTitle', styles.headerTitle);
  const iconButtonClass = getClassName('iconButton', styles.iconButton);
  const contentClass = getClassName('content', styles.content);
  const chatContainerClass = getClassName('chatContainer', styles.chatContainer);
  const messageClass = getClassName('message', styles.message);
  const userMessageClass = getClassName('userMessage', styles.userMessage);
  const assistantMessageClass = getClassName('assistantMessage', styles.assistantMessage);
  const cursorClass = getClassName('cursor', styles.cursor);
  const loadingDotsClass = getClassName('loadingDots', styles.loadingDots);
  const builtInPromptsContainerClass = getClassName('builtInPromptsContainer', styles.builtInPromptsContainer);
  const promptsWrapperClass = getClassName('promptsWrapper', styles.promptsWrapper);
  const promptButtonClass = getClassName('promptButton', styles.promptButton);
  const suggestedQuestionsClass = getClassName('suggestedQuestions', styles.suggestedQuestions);
  const questionItemClass = getClassName('questionItem', styles.questionItem);
  const questionIconClass = getClassName('questionIcon', styles.questionIcon);
  const questionTextClass = getClassName('questionText', styles.questionText);
  const inputContainerClass = getClassName('inputContainer', styles.inputContainer);
  const inputClass = getClassName('input', styles.input);
  const sendButtonClass = getClassName('sendButton', styles.sendButton);
  const stopButtonClass = getClassName('stopButton', styles.stopButton);
  const deleteButtonClass = getClassName('deleteButton', styles.deleteButton);

  const panelStyle: React.CSSProperties = {
    ...animationStyle,
    '--panel-width': `${width}px`,
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
      <div className={headerClass}>
        {/* Left: Action Icons */}
        <div className={headerLeftClass}>
          <button
            className={iconButtonClass}
            onClick={handleClose}
            aria-label="Close"
          >
            <Minus size={18} />
          </button>
          <button
            className={iconButtonClass}
            onClick={handleVerticalExpand}
            aria-label={isVerticallyExpanded ? 'Collapse' : 'Expand'}
          >
            {isVerticallyExpanded ? <ContractVerticalIcon size={18} /> : <ExpandVerticalIcon size={18} />}
          </button>
        </div>
        
        {/* Center: Title */}
        <div className={headerCenterClass}>
          <span className={headerTitleClass}>Ask about "{word}"</span>
          {/* Minimal Coupon Button */}
          <MinimalCouponButton useShadowDom={useShadowDom} />
        </div>
        
        {/* Right: Empty (for symmetry) */}
        <div className={headerRightClass}></div>
      </div>

      {/* Highlighted Coupon */}
      <HighlightedCoupon useShadowDom={useShadowDom} />

      {/* Content */}
      <div className={contentClass}>
        {/* Chat Container */}
        <div className={chatContainerClass} ref={chatContainerRef}>
          {/* Chat Messages */}
          {chatHistory.map((message, index) => (
            <React.Fragment key={index}>
              <div className={`${messageClass} ${message.role === 'user' ? userMessageClass : assistantMessageClass}`}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
              {/* Show questions for this assistant message */}
              {message.role === 'assistant' && messageQuestions[index] && messageQuestions[index].length > 0 && (
                <div className={suggestedQuestionsClass}>
                  {messageQuestions[index].map((question, qIndex) => (
                    <button
                      key={qIndex}
                      className={questionItemClass}
                      onClick={() => handlePromptClick(question)}
                      disabled={isRequesting}
                    >
                      <Plus size={14} className={questionIconClass} />
                      <span className={questionTextClass}>{question}</span>
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Streaming Assistant Message */}
          {streamingText && (
            <div className={`${messageClass} ${assistantMessageClass}`}>
              <ReactMarkdown>{streamingText}</ReactMarkdown>
              {isRequesting && <span className={cursorClass}>|</span>}
            </div>
          )}

          {/* Loading dots when no content yet */}
          {isRequesting && !streamingText && chatHistory.length > 0 && (
            <div className={loadingDotsClass}>
              {'.'.repeat(loadingDotCount)}
            </div>
          )}
        </div>

        {/* Built-in Prompts - Always visible */}
        <div className={builtInPromptsContainerClass}>
          <span className={promptsWrapperClass}>
            {builtInPrompts.map((prompt, index) => (
              <button
                key={index}
                className={promptButtonClass}
                onClick={() => handlePromptClick(prompt)}
                disabled={isRequesting}
              >
                {prompt}
              </button>
            ))}
          </span>
        </div>

        {/* Input Container */}
        <div className={inputContainerClass}>
          <input
            type="text"
            className={inputClass}
            placeholder="Ask a question..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={false}
          />
          {/* Toggle between Send and Stop button */}
          {isRequesting ? (
            <button
              className={stopButtonClass}
              onClick={onStopRequest}
              aria-label="Stop request"
            >
              <Square size={18} />
            </button>
          ) : (
            <>
              <button
                className={sendButtonClass}
                onClick={handleSend}
                disabled={!inputValue.trim()}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
              <button
                className={deleteButtonClass}
                onClick={onClearChat}
                aria-label="Clear chat"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

WordAskAISidePanel.displayName = 'WordAskAISidePanel';

