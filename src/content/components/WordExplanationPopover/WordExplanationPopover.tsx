// src/content/components/WordExplanationPopover/WordExplanationPopover.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookText, GraduationCap, Bookmark, Lightbulb, MessageCircle, Equal, ArrowLeftRight, Languages, Sparkles, Copy, Check, Trash2 } from 'lucide-react';
import { ButtonGroup, ButtonItem } from '@/components/ui/ButtonGroup';
import { useEmergeAnimation } from '@/hooks/useEmergeAnimation';
import { MinimizeIcon } from '../ui/MinimizeIcon';
import { OnHoverMessage } from '../OnHoverMessage';
import { Spinner } from '../ui/Spinner/Spinner';
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
  /** Handler for delete icon click (removes word explanation) */
  onDelete?: () => void;
  
  // Handlers for utility buttons
  /** Handler for Get contextual meaning button (re-fetch initial explanation) */
  onGetContextualMeaning?: () => void;
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
  /** Ref to Ask AI side panel to exclude from click outside detection */
  askAISidePanelRef?: React.RefObject<HTMLElement>;
  /** Callback when shrink animation completes */
  onAnimationComplete?: () => void;
}

const tabButtons: ButtonItem[] = [
  { id: 'contextual', icon: BookText, label: 'Contextual' },
  { id: 'grammar', icon: GraduationCap, label: 'Vocabulary' },
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
  onDelete,
  onGetContextualMeaning,
  onGetMoreExamples,
  onGetSynonyms,
  onGetAntonyms,
  onTranslate,
  onAskAI,
  onAskAIButtonMount,
  askAISidePanelRef,
  onAnimationComplete,
}) => {
  const wasVisible = useRef(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const askAIButtonRef = useRef<HTMLButtonElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Refs for header buttons
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const bookmarkButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Refs for utility action buttons
  const moreExamplesButtonRef = useRef<HTMLButtonElement>(null);
  const synonymsButtonRef = useRef<HTMLButtonElement>(null);
  const antonymsButtonRef = useRef<HTMLButtonElement>(null);
  const translateButtonRef = useRef<HTMLButtonElement>(null);
  
  // Ref for main content container (for smooth height transitions)
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // Track when header refs are mounted for OnHoverMessage
  const [headerMounted, setHeaderMounted] = useState(false);
  
  // Track when utility button refs are mounted for OnHoverMessage
  const [utilityButtonsMounted, setUtilityButtonsMounted] = useState(false);
  
  // Set mounted state after initial render
  useEffect(() => {
    setHeaderMounted(true);
  }, []);
  
  // Re-trigger utility buttons mounted state when tab changes to ensure refs are ready
  useEffect(() => {
    setUtilityButtonsMounted(false);
    // Small delay to ensure refs are set after render
    const timer = setTimeout(() => {
      setUtilityButtonsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Smooth height transition when tab changes
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    // Get the current height before content changes
    const currentHeight = mainContent.scrollHeight;
    
    // Set explicit height to current height (to enable transition)
    mainContent.style.height = `${currentHeight}px`;
    
    // Use requestAnimationFrame to allow DOM to update with new content
    requestAnimationFrame(() => {
      // Allow content to render with auto height temporarily
      mainContent.style.height = 'auto';
      
      // Get the new height after content change
      const newHeight = mainContent.scrollHeight;
      
      // Set back to old height (without transition)
      mainContent.style.height = `${currentHeight}px`;
      
      // Force reflow
      mainContent.offsetHeight;
      
      // Now animate to new height
      requestAnimationFrame(() => {
        mainContent.style.height = `${newHeight}px`;
        
        // After transition completes, set back to auto for flexibility
        const transitionEnd = () => {
          mainContent.style.height = 'auto';
          mainContent.removeEventListener('transitionend', transitionEnd);
        };
        mainContent.addEventListener('transitionend', transitionEnd);
      });
    });
  }, [activeTab, content, synonyms, antonyms, translations]);

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

  // Use animation hook's shouldRender - it manages visibility during animations
  const shouldRender = animationShouldRender;

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
    if (visible && sourceRef?.current && elementRef.current) {
      // Calculate position immediately, synchronously
      // This must happen BEFORE the animation starts
      calculatePosition();
    }
  }, [visible, sourceRef, elementRef, calculatePosition]);

  // Recalculate position when animation completes (state becomes 'visible')
  // This ensures position is correct when reopening the popover
  useEffect(() => {
    if (animationState === 'visible' && sourceRef?.current && elementRef.current) {
      // Small delay to ensure element is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calculatePosition();
        });
      });
    }
  }, [animationState, sourceRef, elementRef, calculatePosition]);

  // Set up scroll listeners to keep popover tied to word span
  useEffect(() => {
    if (!visible || !sourceRef?.current) {
      return;
    }

    let rafId: number | null = null;
    
    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        calculatePosition();
      });
    };

    // Find scrollable parents
    const findScrollableParents = (element: Node): HTMLElement[] => {
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
    };

    const scrollableParents = findScrollableParents(sourceRef.current);

    // Add listeners to window, document, and scrollable parents
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    document.addEventListener('scroll', handleScroll, true);
    
    scrollableParents.forEach((parent) => {
      parent.addEventListener('scroll', handleScroll, true);
    });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      
      scrollableParents.forEach((parent) => {
        parent.removeEventListener('scroll', handleScroll, true);
      });
    };
  }, [visible, sourceRef, calculatePosition]);

  // Sync sourceRef with animation hook when element renders
  // Similar to FABDisablePopover pattern
  useEffect(() => {
    if (shouldRender && sourceRef?.current) {
      (animationSourceRef as React.MutableRefObject<HTMLElement | null>).current = sourceRef.current;
      console.log('[WordExplanationPopover] Synced source ref:', {
        sourceElement: sourceRef.current,
        tagName: sourceRef.current.tagName,
        className: sourceRef.current.className,
        textContent: sourceRef.current.textContent,
      });
    }
  }, [sourceRef, animationSourceRef, shouldRender]);

  // Handle visibility changes with animation
  // Pattern similar to FABDisablePopover
  useEffect(() => {
    if (visible && !wasVisible.current) {
      // Opening
      wasVisible.current = true;
      console.log('[WordExplanationPopover] Opening with emerge animation');
      
      // Wait for element to be mounted, then calculate position and animate
      requestAnimationFrame(() => {
        const element = elementRef.current;
        const source = sourceRef?.current;
        
        if (element && source) {
          // Calculate position synchronously
          const sourceRect = source.getBoundingClientRect();
          const popoverRect = element.getBoundingClientRect();
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

          console.log('[WordExplanationPopover] Calculated position synchronously:', { top, left });
          
          // CRITICAL: Apply position directly to DOM BEFORE emerge() reads it
          element.style.top = `${top}px`;
          element.style.left = `${left}px`;
          
          // Also update state for subsequent renders
          setPosition({ top, left });
          
          console.log('[WordExplanationPopover] Position applied to DOM, starting emerge animation');
        }
        
        // Start animation - element is now at its final position
        emerge().catch((error) => {
          console.error('[WordExplanationPopover] Emerge animation error:', error);
        });
      });
    } else if (!visible && wasVisible.current) {
      // Closing
      wasVisible.current = false;
      setPosition(null);
      console.log('[WordExplanationPopover] Closing with shrink animation');
      shrink()
        .then(() => {
          console.log('[WordExplanationPopover] Shrink animation completed, calling onAnimationComplete');
          onAnimationComplete?.();
        })
        .catch((error) => {
          console.error('[WordExplanationPopover] Shrink animation error:', error);
          // Still call onAnimationComplete even on error so the component gets unmounted
          onAnimationComplete?.();
        });
    }
  }, [visible, emerge, shrink, onAnimationComplete, sourceRef, elementRef]);

  // Handle outside click
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Use composedPath to get the full event path including Shadow DOM elements
      const path = event.composedPath();
      
      // Check if our popover or source element is in the event path
      const isInsidePopover = elementRef.current && path.includes(elementRef.current);
      const isInsideSource = sourceRef.current && path.includes(sourceRef.current);
      
      // Query Ask AI panel directly (more reliable than prop ref)
      const panelHost = document.getElementById('xplaino-word-ask-ai-panel-host');
      const panel = panelHost?.shadowRoot?.querySelector('.wordAskAISidePanel');
      const isInsideAskAIPanel = panel && path.includes(panel as Element);

      // Query Folder List Modal (for bookmark save)
      const folderModalHost = document.getElementById('xplaino-folder-list-modal-host');
      const folderModal = folderModalHost?.shadowRoot?.querySelector('.folderListModal');
      const isInsideFolderModal = folderModal && path.includes(folderModal as Element);
      
      // Also check if folder modal host itself is in path (clicks on overlay)
      const isInsideFolderModalHost = folderModalHost && path.includes(folderModalHost as Element);

      // Only close if click is outside popover, source, Ask AI panel, and folder modal
      if (!isInsidePopover && !isInsideSource && !isInsideAskAIPanel && !isInsideFolderModal && !isInsideFolderModalHost) {
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
  }, [visible, onClose, sourceRef, elementRef, askAISidePanelRef]);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  // Helper to highlight target word in text nodes with teal underline
  const highlightTargetWordInText = (text: string, targetWord: string): React.ReactNode => {
    if (!text || !targetWord) return text;
    // Escape special regex characters in the target word
    const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Case-insensitive split
    const regex = new RegExp(`(\\b${escapedWord}\\b)`, 'gi');
    const parts = text.split(regex);
    
    if (parts.length === 1) return text; // No matches found
    
    return parts.map((part, index) => {
      if (part.toLowerCase() === targetWord.toLowerCase()) {
        return (
          <span key={index} className={getClassName('targetWordHighlight')}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleButtonChange = (buttonId: string) => {
    if (buttonId === 'contextual' || buttonId === 'grammar') {
      onTabChange(buttonId);
    }
  };

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
  // Always pass the ref object, even if current is null initially
  // The parent can check .current when needed
  useEffect(() => {
    onAskAIButtonMount?.(askAIButtonRef);
  }, [onAskAIButtonMount, askAIButtonRef]);
  
  // Re-notify parent when button becomes available (for contextual tab)
  useEffect(() => {
    if (utilityButtonsMounted && activeTab === 'contextual' && askAIButtonRef.current) {
      onAskAIButtonMount?.(askAIButtonRef);
    }
  }, [utilityButtonsMounted, activeTab, onAskAIButtonMount, askAIButtonRef]);

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

  // Copy handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(word);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('[WordExplanationPopover] Failed to copy word:', error);
    }
  };

  // Don't render if shouldn't be visible
  if (!shouldRender) {
    console.log('[WordExplanationPopover] Not rendering - shouldRender is false');
    return null;
  }

  console.log('[WordExplanationPopover] Rendering popover container');

  // Combine animation style with position style
  // Combine animation style with position style
  const combinedStyle: React.CSSProperties = {
    ...animationStyle,
    // CRITICAL: Always apply position when available - transform animation is relative to this
    // The Web Animations API needs the element at its final position to calculate correct transforms
    ...(position && {
      top: `${position.top}px`,
      left: `${position.left}px`,
    }),
    // Set visibility based on animation state
    ...(animationState === 'visible' && {
      opacity: 1,
      visibility: 'visible' as const,
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
      {/* Header with Word, Copy Button, and Bookmark */}
      <div className={getClassName('header')}>
        <div className={getClassName('headerLeft')}>
          <span className={getClassName('headerWord')}>{word}</span>
          <button 
            ref={copyButtonRef}
            className={`${getClassName('headerCopyButton')} ${isCopied ? getClassName('headerCopyButtonCopied') : ''}`}
            aria-label="Copy word"
            onClick={handleCopy}
          >
            {isCopied ? (
              <>
                <Check size={18} strokeWidth={2} />
                <span className={getClassName('headerCopiedText')}>Copied</span>
              </>
            ) : (
              <Copy size={18} strokeWidth={2} />
            )}
          </button>
          {headerMounted && !isCopied && copyButtonRef.current && (
            <OnHoverMessage
              message="Copy"
              targetRef={copyButtonRef}
              position="bottom"
              offset={8}
            />
          )}
        </div>
        <div className={getClassName('headerRight')}>
          <button 
            ref={bookmarkButtonRef}
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
          {headerMounted && !isSavingWord && bookmarkButtonRef.current && (
            <OnHoverMessage
              message={isSaved ? "Remove bookmark" : "Bookmark"}
              targetRef={bookmarkButtonRef}
              position="bottom"
              offset={8}
            />
          )}
          {onDelete && (
            <>
              <button 
                ref={deleteButtonRef}
                className={getClassName('headerDelete')}
                aria-label="Delete word explanation"
                onClick={onDelete}
              >
                <Trash2 size={18} strokeWidth={2} />
              </button>
              {headerMounted && deleteButtonRef.current && (
                <OnHoverMessage
                  message="Remove"
                  targetRef={deleteButtonRef}
                  position="bottom"
                  offset={8}
                />
              )}
            </>
          )}
          <MinimizeIcon
            onClick={onClose}
            size={18}
            useShadowDom={useShadowDom}
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        ref={mainContentRef}
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
          // Vocabulary tab - show synonyms, antonyms, translations in grid layout
          <div className={getClassName('grammarContent')}>
            {(synonyms.length > 0 || antonyms.length > 0 || translations.length > 0) ? (
              <div className={getClassName('vocabularyGrid')}>
                {/* Row 1: Synonyms - only show if has data */}
                {synonyms.length > 0 && (
                  <div className={getClassName('vocabularyRow')}>
                    <div className={getClassName('vocabularyLabel')}>
                      <strong className={getClassName('sectionTitle')}>Synonyms</strong>
                    </div>
                    <div className={getClassName('vocabularyValue')}>
                      <div className={getClassName('commaSeparated')}>
                        {synonyms.join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Row 2: Antonyms - only show if has data */}
                {antonyms.length > 0 && (
                  <div className={getClassName('vocabularyRow')}>
                    <div className={getClassName('vocabularyLabel')}>
                      <strong className={getClassName('sectionTitle')}>Antonyms</strong>
                    </div>
                    <div className={getClassName('vocabularyValue')}>
                      <div className={getClassName('commaSeparated')}>
                        {antonyms.join(', ')}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Row 3: Translations - only show if has data */}
                {translations.length > 0 && (
                  <div className={getClassName('vocabularyRow')}>
                    <div className={getClassName('vocabularyLabel')}>
                      <strong className={getClassName('sectionTitle')}>
                        Translation{translations.length > 1 ? 's' : ''}
                      </strong>
                    </div>
                    <div className={getClassName('vocabularyValue')}>
                      <div className={getClassName('commaSeparated')}>
                        {translations.map((trans, idx) => (
                          <span key={idx}>
                            {trans.translated_content}
                            {idx < translations.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={getClassName('placeholderState')}>
                Click the buttons below to explore more about this word
              </div>
            )}
          </div>
        ) : content ? (
          <ReactMarkdown
            components={{
              p: ({ children, ...props }) => {
                const processChildren = (nodes: React.ReactNode): React.ReactNode => {
                  return React.Children.map(nodes, (child) => {
                    if (typeof child === 'string') {
                      return highlightTargetWordInText(child, word);
                    }
                    return child;
                  });
                };
                return <p {...props}>{processChildren(children)}</p>;
              },
              li: ({ children, ...props }) => {
                const processChildren = (nodes: React.ReactNode): React.ReactNode => {
                  return React.Children.map(nodes, (child) => {
                    if (typeof child === 'string') {
                      return highlightTargetWordInText(child, word);
                    }
                    return child;
                  });
                };
                return <li {...props}>{processChildren(children)}</li>;
              }
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <div className={getClassName('noExplanationContainer')}>
            <button 
              className={getClassName('getContextualMeaningButton')}
              onClick={onGetContextualMeaning}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className={getClassName('buttonSpinner')} />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} strokeWidth={2.5} />
                  <span>Get contextual meaning</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Utility Actions */}
      <div className={getClassName('utilityActions')}>
        {activeTab === 'contextual' ? (
          // Only show utility buttons if there's content
          content ? (
            <>
              {isLoadingExamples ? (
                <Spinner size="md" useShadowDom={useShadowDom} />
              ) : shouldAllowFetchMoreExamples ? (
                <div className={getClassName('utilityButtonWrapper')}>
                  <button 
                    ref={moreExamplesButtonRef}
                    className={getClassName('utilityButton')}
                    onClick={handleGetMoreExamples}
                    aria-label="Get more examples"
                  >
                    <Lightbulb size={20} strokeWidth={2.5} />
                  </button>
                  {utilityButtonsMounted && moreExamplesButtonRef.current && (
                    <OnHoverMessage
                      message="Get more examples"
                      targetRef={moreExamplesButtonRef}
                      position="bottom"
                      offset={8}
                    />
                  )}
                </div>
              ) : null}
              <div className={getClassName('utilityButtonWrapper')}>
                <button 
                  ref={askAIButtonRef}
                  className={getClassName('utilityButton')} 
                  onClick={handleAskAI}
                  aria-label="Ask AI"
                >
                  <MessageCircle size={20} strokeWidth={2.5} />
                </button>
                {utilityButtonsMounted && askAIButtonRef.current && (
                  <OnHoverMessage
                    message="Ask AI"
                    targetRef={askAIButtonRef}
                    position="bottom"
                    offset={8}
                  />
                )}
              </div>
            </>
          ) : null
        ) : (
          <>
            {synonyms.length === 0 && (
              <div className={getClassName('utilityButtonWrapper')}>
                <button 
                  ref={synonymsButtonRef}
                  className={`${getClassName('utilityButton')} ${isLoadingSynonyms ? getClassName('utilityButtonDisabled') : ''}`}
                  onClick={handleGetSynonyms}
                  aria-label="Get synonyms"
                  disabled={isLoadingSynonyms}
                >
                  {isLoadingSynonyms ? (
                    <div className={getClassName('buttonSpinner')} />
                  ) : (
                    <Equal size={20} strokeWidth={2.5} />
                  )}
                </button>
                {utilityButtonsMounted && !isLoadingSynonyms && synonymsButtonRef.current && (
                  <OnHoverMessage
                    message="Get synonyms"
                    targetRef={synonymsButtonRef}
                    position="bottom"
                    offset={8}
                  />
                )}
              </div>
            )}
            {antonyms.length === 0 && (
              <div className={getClassName('utilityButtonWrapper')}>
                <button 
                  ref={antonymsButtonRef}
                  className={`${getClassName('utilityButton')} ${isLoadingAntonyms ? getClassName('utilityButtonDisabled') : ''}`}
                  onClick={handleGetOpposite}
                  aria-label="Get opposite"
                  disabled={isLoadingAntonyms}
                >
                  {isLoadingAntonyms ? (
                    <div className={getClassName('buttonSpinner')} />
                  ) : (
                    <ArrowLeftRight size={20} strokeWidth={2.5} />
                  )}
                </button>
                {utilityButtonsMounted && !isLoadingAntonyms && antonymsButtonRef.current && (
                  <OnHoverMessage
                    message="Get opposite"
                    targetRef={antonymsButtonRef}
                    position="bottom"
                    offset={8}
                  />
                )}
              </div>
            )}
            {translations.length === 0 && (
              <div className={getClassName('utilityButtonWrapper')}>
                <button 
                  ref={translateButtonRef}
                  className={`${getClassName('utilityButton')} ${isLoadingTranslation ? getClassName('utilityButtonDisabled') : ''}`}
                  onClick={handleTranslate}
                  aria-label="Translate"
                  disabled={isLoadingTranslation}
                >
                  {isLoadingTranslation ? (
                    <div className={getClassName('buttonSpinner')} />
                  ) : (
                    <Languages size={20} strokeWidth={2.5} />
                  )}
                </button>
                {utilityButtonsMounted && !isLoadingTranslation && translateButtonRef.current && (
                  <OnHoverMessage
                    message="Translate"
                    targetRef={translateButtonRef}
                    position="bottom"
                    offset={8}
                  />
                )}
              </div>
            )}
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

