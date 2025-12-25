// src/content/components/WordExplanationPopover/WordExplanationPopover.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookText, GraduationCap, Bookmark, Lightbulb, MessageCircle, BookOpen, ArrowLeftRight, Languages } from 'lucide-react';
import { ButtonGroup, ButtonItem } from '@/components/ui/ButtonGroup';
import { useEmergeAnimation } from '@/hooks/useEmergeAnimation';
import styles from './WordExplanationPopover.module.css';

export type TabType = 'contextual' | 'grammar';

export interface WordExplanationPopoverProps {
  /** The word being explained */
  word: string;
  /** Source element (word span) for emerge/shrink animation */
  sourceRef: React.RefObject<HTMLElement>;
  /** Whether the popover is visible */
  visible: boolean;
  /** Content to display (markdown format) */
  content: string;
  /** Active tab */
  activeTab: TabType;
  /** Handler for tab change */
  onTabChange: (tab: TabType) => void;
  /** Handler for close request */
  onClose: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Whether content is loading */
  isLoading?: boolean;
  /** Error message if any */
  errorMessage?: string;
  
  // Data props for grammar tab
  /** Synonyms for the word */
  synonyms?: string[];
  /** Antonyms for the word */
  antonyms?: string[];
  /** Translations of the word */
  translations?: Array<{ language: string; translated_content: string }>;
  /** Whether more examples can be fetched */
  shouldAllowFetchMoreExamples?: boolean;
  
  // Loading states
  /** Whether examples are being loaded */
  isLoadingExamples?: boolean;
  /** Whether synonyms are being loaded */
  isLoadingSynonyms?: boolean;
  /** Whether antonyms are being loaded */
  isLoadingAntonyms?: boolean;
  /** Whether translation is in progress */
  isLoadingTranslation?: boolean;
  
  // Bookmark/Save state
  /** Whether the word is saved/bookmarked */
  isSaved?: boolean;
  /** Whether save/unsave is in progress */
  isSavingWord?: boolean;
  /** Handler for bookmark icon click */
  onBookmarkClick?: () => void;
  
  // Handlers for utility buttons
  /** Handler for Get more examples button */
  onGetMoreExamples?: () => void;
  /** Handler for Get synonyms button */
  onGetSynonyms?: () => void;
  /** Handler for Get antonyms/opposite button */
  onGetAntonyms?: () => void;
  /** Handler for Translate button */
  onTranslate?: (languageCode?: string) => void;
  /** Handler for Ask AI button */
  onAskAI?: () => void;
  /** Callback when Ask AI button ref is ready */
  onAskAIButtonMount?: (ref: React.RefObject<HTMLButtonElement>) => void;
}

const tabButtons: ButtonItem[] = [
  { id: 'contextual', icon: BookText, label: 'Contextual' },
  { id: 'grammar', icon: GraduationCap, label: 'Grammar' },
];

export const WordExplanationPopover: React.FC<WordExplanationPopoverProps> = ({
  word,
  sourceRef,
  visible,
  content,
  activeTab,
  onTabChange,
  onClose,
  useShadowDom = false,
  isLoading = false,
  errorMessage,
  synonyms = [],
  antonyms = [],
  translations = [],
  shouldAllowFetchMoreExamples = true,
  isLoadingExamples = false,
  isLoadingSynonyms = false,
  isLoadingAntonyms = false,
  isLoadingTranslation = false,
  isSaved = false,
  isSavingWord = false,
  onBookmarkClick,
  onGetMoreExamples,
  onGetSynonyms,
  onGetAntonyms,
  onTranslate,
  onAskAI,
  onAskAIButtonMount,
}) => {
  const wasVisible = useRef(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const askAIButtonRef = useRef<HTMLButtonElement>(null);

  console.log('[WordExplanationPopover] Render with props:', {
    visible,
    contentLength: content?.length || 0,
    hasSourceRef: !!sourceRef?.current,
    isLoading,
    errorMessage,
  });

  // Animation hook
  const {
    elementRef,
    sourceRef: animationSourceRef,
    emerge,
    shrink,
    shouldRender: animationShouldRender,
    style: animationStyle,
    animationState,
  } = useEmergeAnimation({
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'center center',
  });

  // Override shouldRender to also check the visible prop
  // This ensures the component renders when visible is true, even before animation starts
  const shouldRender = visible || animationShouldRender;

  console.log('[WordExplanationPopover] Animation state:', { 
    visible, 
    animationShouldRender, 
    shouldRender 
  });

  // Calculate popover position based on source element
  const calculatePosition = useCallback(() => {
    if (!sourceRef?.current || !elementRef.current) {
      console.log('[WordExplanationPopover] Cannot calculate position - missing refs');
      return;
    }

    const sourceRect = sourceRef.current.getBoundingClientRect();
    const popoverRect = elementRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default: position below the word, centered
    let top = sourceRect.bottom + 8; // 8px gap
    let left = sourceRect.left + (sourceRect.width / 2) - (popoverRect.width / 2);

    // Check if popover would go off the right edge
    if (left + popoverRect.width > viewportWidth - 20) {
      left = viewportWidth - popoverRect.width - 20;
    }

    // Check if popover would go off the left edge
    if (left < 20) {
      left = 20;
    }

    // Check if popover would go off the bottom edge
    if (top + popoverRect.height > viewportHeight - 20) {
      // Position above the word instead
      top = sourceRect.top - popoverRect.height - 8;
    }

    // Ensure it doesn't go above the viewport
    if (top < 20) {
      top = 20;
    }

    console.log('[WordExplanationPopover] Calculated position:', {
      top,
      left,
      sourceRect: {
        top: sourceRect.top,
        bottom: sourceRect.bottom,
        left: sourceRect.left,
        right: sourceRect.right,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      popoverRect: {
        width: popoverRect.width,
        height: popoverRect.height,
      },
    });

    setPosition({ top, left });
  }, [sourceRef, elementRef]);

  // Calculate position when component mounts or sourceRef changes
  useEffect(() => {
    if (visible && sourceRef?.current) {
      // Wait a frame for the element to be rendered with content
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [visible, sourceRef, calculatePosition]);

  // Sync sourceRef with animation hook
  useEffect(() => {
    if (sourceRef?.current) {
      (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = sourceRef.current;
      console.log('[WordExplanationPopover] Synced source ref:', {
        sourceElement: sourceRef.current,
        tagName: sourceRef.current.tagName,
        className: sourceRef.current.className,
        textContent: sourceRef.current.textContent,
      });
    } else {
      console.warn('[WordExplanationPopover] sourceRef.current is null!');
    }
  }, [sourceRef, animationSourceRef]);

  // Handle visibility changes with animation
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening
      wasVisible.current = true;
      console.log('[WordExplanationPopover] Opening with emerge animation');
      emerge().catch((error) => {
        console.error('[WordExplanationPopover] Emerge animation error:', error);
      });
    } else if (!visible && wasVisible.current) {
      // Closing
      wasVisible.current = false;
      console.log('[WordExplanationPopover] Closing with shrink animation');
      shrink().catch((error) => {
        console.error('[WordExplanationPopover] Shrink animation error:', error);
      });
    }
  }, [visible, emerge, shrink]);

  // Handle outside click
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Use composedPath to get the full event path including Shadow DOM elements
      const path = event.composedPath();
      
      // Check if our popover or source element is in the event path
      const isInsidePopover = elementRef.current && path.includes(elementRef.current);
      const isInsideSource = sourceRef.current && path.includes(sourceRef.current);

      // Only close if click is outside both popover and source
      if (!isInsidePopover && !isInsideSource) {
        console.log('[WordExplanationPopover] Outside click detected, closing');
        onClose();
      }
    };

    // Add listener with slight delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose, sourceRef, elementRef]);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleButtonChange = (buttonId: string) => {
    if (buttonId === 'contextual' || buttonId === 'grammar') {
      onTabChange(buttonId);
    }
  };

  // Tooltip state for utility buttons
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Utility button handlers
  const handleGetMoreExamples = () => {
    console.log('[WordExplanationPopover] Get more examples clicked');
    onGetMoreExamples?.();
  };

  const handleAskAI = () => {
    console.log('[WordExplanationPopover] Ask AI clicked');
    onAskAI?.();
  };

  // Pass Ask AI button ref to parent when mounted
  useEffect(() => {
    if (askAIButtonRef.current) {
      onAskAIButtonMount?.(askAIButtonRef);
    }
  }, [onAskAIButtonMount]);

  const handleGetSynonyms = () => {
    console.log('[WordExplanationPopover] Get synonyms clicked');
    onGetSynonyms?.();
  };

  const handleGetOpposite = () => {
    console.log('[WordExplanationPopover] Get opposite clicked');
    onGetAntonyms?.();
  };

  const handleTranslate = () => {
    console.log('[WordExplanationPopover] Translate clicked');
    // Language will be retrieved from Chrome storage in the handler
    onTranslate?.();
  };

  // Don't render if shouldn't be visible
  if (!shouldRender) {
    console.log('[WordExplanationPopover] Not rendering - shouldRender is false');
    return null;
  }

  console.log('[WordExplanationPopover] Rendering popover container');

  // Combine animation style with position style
  // Only apply position when NOT animating to avoid overriding animation transforms
  const combinedStyle: React.CSSProperties = {
    ...animationStyle,
    // Only override position when not animating
    ...(position && animationState !== 'emerging' && animationState !== 'shrinking' && {
      top: `${position.top}px`,
      left: `${position.left}px`,
    }),
    // Don't force opacity/visibility during animations
    ...(animationState === 'visible' && {
      opacity: 1,
      visibility: 'visible',
    }),
    zIndex: 2147483640,
  };

  console.log('[WordExplanationPopover] Combined style:', combinedStyle);
  console.log('[WordExplanationPopover] Animation state:', animationState);
  console.log('[WordExplanationPopover] Element ref:', elementRef.current);

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={getClassName('popoverContainer')}
      style={combinedStyle}
    >
      {/* Header with Word and Bookmark */}
      <div className={getClassName('header')}>
        <span className={getClassName('headerWord')}>{word}</span>
        <button 
          className={`${getClassName('headerBookmark')} ${isSaved ? getClassName('headerBookmarkSaved') : ''}`}
          aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
          onClick={onBookmarkClick}
          disabled={isSavingWord}
        >
          {isSavingWord ? (
            <div className={getClassName('bookmarkSpinner')} />
          ) : (
            <Bookmark size={18} strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div 
        className={getClassName('mainContent')}
        style={activeTab === 'grammar' && !isLoading && !errorMessage && !synonyms.length && !antonyms.length && !translations.length ? { minHeight: 0 } : undefined}
      >
        {isLoading ? (
          <div className={getClassName('loadingState')}>
            <div className={getClassName('spinner')} />
            <span>Loading explanation...</span>
          </div>
        ) : errorMessage ? (
          <div className={getClassName('errorState')}>{errorMessage}</div>
        ) : activeTab === 'grammar' ? (
          // Grammar tab - show synonyms, antonyms, translations (no loading states in content)
          <div className={getClassName('grammarContent')}>
            {synonyms.length > 0 && (
              <div className={getClassName('section')}>
                <strong className={getClassName('sectionTitle')}>Synonyms:</strong>
                <div className={getClassName('commaSeparated')}>
                  {synonyms.join(', ')}
                </div>
              </div>
            )}
            
            {antonyms.length > 0 && (
              <div className={getClassName('section')}>
                <strong className={getClassName('sectionTitle')}>Antonyms:</strong>
                <div className={getClassName('commaSeparated')}>
                  {antonyms.join(', ')}
                </div>
              </div>
            )}
            
            {translations.length > 0 && (
              <div className={getClassName('section')}>
                <strong className={getClassName('sectionTitle')}>
                  Translation{translations.length > 1 ? 's' : ''}({translations.map(t => t.language).join(', ')}):
                </strong>
                <div className={getClassName('commaSeparated')}>
                  {translations.map((trans, idx) => (
                    <span key={idx}>
                      {trans.translated_content}
                      {idx < translations.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {synonyms.length === 0 && antonyms.length === 0 && translations.length === 0 && (
              <div className={getClassName('placeholderState')}>
                Click the buttons below to explore more about this word
              </div>
            )}
          </div>
        ) : content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <div className={getClassName('placeholderState')}>
            No explanation available
          </div>
        )}
      </div>

      {/* Utility Actions */}
      <div className={getClassName('utilityActions')}>
        {activeTab === 'contextual' ? (
          <>
            <div className={getClassName('utilityButtonWrapper')}>
              <button 
                className={`${getClassName('utilityButton')} ${(isLoadingExamples || !shouldAllowFetchMoreExamples) ? getClassName('utilityButtonDisabled') : ''}`}
                onClick={handleGetMoreExamples}
                onMouseEnter={() => setActiveTooltip('examples')}
                onMouseLeave={() => setActiveTooltip(null)}
                aria-label="Get more examples"
                disabled={isLoadingExamples || !shouldAllowFetchMoreExamples}
              >
                {isLoadingExamples ? (
                  <div className={getClassName('buttonSpinner')} />
                ) : (
                  <Lightbulb size={20} strokeWidth={2.5} />
                )}
              </button>
              {activeTooltip === 'examples' && !isLoadingExamples && (
                <div className={getClassName('utilityTooltip')}>
                  {shouldAllowFetchMoreExamples ? 'Get more examples' : 'No more examples'}
                </div>
              )}
            </div>
            <div className={getClassName('utilityButtonWrapper')}>
              <button 
                ref={askAIButtonRef}
                className={getClassName('utilityButton')} 
                onClick={handleAskAI}
                onMouseEnter={() => setActiveTooltip('askAI')}
                onMouseLeave={() => setActiveTooltip(null)}
                aria-label="Ask AI"
              >
                <MessageCircle size={20} strokeWidth={2.5} />
              </button>
              {activeTooltip === 'askAI' && (
                <div className={getClassName('utilityTooltip')}>
                  Ask AI
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={getClassName('utilityButtonWrapper')}>
              <button 
                className={`${getClassName('utilityButton')} ${isLoadingSynonyms ? getClassName('utilityButtonDisabled') : ''}`}
                onClick={handleGetSynonyms}
                onMouseEnter={() => setActiveTooltip('synonyms')}
                onMouseLeave={() => setActiveTooltip(null)}
                aria-label="Get synonyms"
                disabled={isLoadingSynonyms}
              >
                {isLoadingSynonyms ? (
                  <div className={getClassName('buttonSpinner')} />
                ) : (
                  <BookOpen size={20} strokeWidth={2.5} />
                )}
              </button>
              {activeTooltip === 'synonyms' && !isLoadingSynonyms && (
                <div className={getClassName('utilityTooltip')}>
                  Get synonyms
                </div>
              )}
            </div>
            <div className={getClassName('utilityButtonWrapper')}>
              <button 
                className={`${getClassName('utilityButton')} ${isLoadingAntonyms ? getClassName('utilityButtonDisabled') : ''}`}
                onClick={handleGetOpposite}
                onMouseEnter={() => setActiveTooltip('opposite')}
                onMouseLeave={() => setActiveTooltip(null)}
                aria-label="Get opposite"
                disabled={isLoadingAntonyms}
              >
                {isLoadingAntonyms ? (
                  <div className={getClassName('buttonSpinner')} />
                ) : (
                  <ArrowLeftRight size={20} strokeWidth={2.5} />
                )}
              </button>
              {activeTooltip === 'opposite' && !isLoadingAntonyms && (
                <div className={getClassName('utilityTooltip')}>
                  Get opposite
                </div>
              )}
            </div>
            <div className={getClassName('utilityButtonWrapper')}>
              <button 
                className={`${getClassName('utilityButton')} ${isLoadingTranslation ? getClassName('utilityButtonDisabled') : ''}`}
                onClick={handleTranslate}
                onMouseEnter={() => setActiveTooltip('translate')}
                onMouseLeave={() => setActiveTooltip(null)}
                aria-label="Translate"
                disabled={isLoadingTranslation}
              >
                {isLoadingTranslation ? (
                  <div className={getClassName('buttonSpinner')} />
                ) : (
                  <Languages size={20} strokeWidth={2.5} />
                )}
              </button>
              {activeTooltip === 'translate' && !isLoadingTranslation && (
                <div className={getClassName('utilityTooltip')}>
                  Translate
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer with Tabs */}
      <div className={getClassName('footer')}>
        <ButtonGroup
          buttons={tabButtons}
          activeButtonId={activeTab}
          onButtonChange={handleButtonChange}
          useShadowDom={useShadowDom}
          iconSize={16}
          strokeWidth={2.5}
          gap={8}
        />
      </div>
    </div>
  );
};

WordExplanationPopover.displayName = 'WordExplanationPopover';

