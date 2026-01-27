// src/content/components/SidePanel/SummaryView.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowUp, Trash2, Plus, Square } from 'lucide-react';
import { useAtom } from 'jotai';
import ReactMarkdown from 'react-markdown';
import styles from './SummaryView.module.css';
import { SummariseService } from '@/api-services/SummariseService';
import { AskService, ChatMessage } from '@/api-services/AskService';
import { getLanguageCode } from '@/api-services/TranslateService';
import { extractAndStorePageContent, getStoredPageContent } from '@/content/utils/pageContentExtractor';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { OnHoverMessage } from '../OnHoverMessage/OnHoverMessage';
import { LoadingDots } from './LoadingDots';
import {
  pageReadingStateAtom,
  summariseStateAtom,
  askingStateAtom,
  summaryAtom,
  streamingTextAtom,
  askStreamingTextAtom,
  chatMessagesAtom,
  messageQuestionsAtom,
  summaryErrorAtom,
  hasContentAtom,
} from '@/store/summaryAtoms';
import { findMatchingElement } from '@/content/utils/referenceMatcher';
import { COLORS, colorWithOpacity } from '@/constants/colors';

export interface SummaryViewProps {
  /** Whether to use Shadow DOM styling */
  useShadowDom?: boolean;
  /** Callback when login is required */
  onLoginRequired?: () => void;
}

// Reference link pattern: [[[ ref text ]]]
const REF_LINK_PATTERN = /\[\[\[\s*(.+?)\s*\]\]\]/g;

export const SummaryView: React.FC<SummaryViewProps> = ({
  useShadowDom = false,
  onLoginRequired,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Jotai atoms for persistent state
  const [pageReadingState, setPageReadingState] = useAtom(pageReadingStateAtom);
  const [summariseState, setSummariseState] = useAtom(summariseStateAtom);
  const [askingState, setAskingState] = useAtom(askingStateAtom);
  const [summary, setSummary] = useAtom(summaryAtom);
  const [streamingText, setStreamingText] = useAtom(streamingTextAtom);
  const [askStreamingText, setAskStreamingText] = useAtom(askStreamingTextAtom);
  const [chatMessages, setChatMessages] = useAtom(chatMessagesAtom);
  const [messageQuestions, setMessageQuestions] = useAtom(messageQuestionsAtom);
  const [errorMessage, setErrorMessage] = useAtom(summaryErrorAtom);
  const [hasContent] = useAtom(hasContentAtom);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Store reference link mappings: refText -> HTMLElement
  const referenceMappingsRef = useRef<Map<string, HTMLElement>>(new Map());
  
  // Store currently highlighted element
  const highlightedElementRef = useRef<HTMLElement | undefined>(undefined);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track currently active reference (for button highlighting)
  const [activeRefText, setActiveRefText] = useState<string | null>(null);
  
  // Track element to keep scrolled to during streaming
  const activeScrollTargetRef = useRef<HTMLElement | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  

  // Animated dots state for "Reading page..."
  const [dotCount, setDotCount] = useState(1);
  
  // Animated dots state for loading animation before first chunk (summary)
  const [summaryLoadingDotCount, setSummaryLoadingDotCount] = useState(1);
  
  // Animated dots state for loading animation before first chunk (ask)
  const [askLoadingDotCount, setAskLoadingDotCount] = useState(1);

  // Hover state for tooltips
  const [hoveredIcon, setHoveredIcon] = useState<'send' | 'delete' | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for tooltip positioning
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const getClassName = useCallback((baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    return styles[baseClass as keyof typeof styles] || baseClass;
  }, [useShadowDom]);

  // Handle tooltip hover
  useEffect(() => {
    if (hoveredIcon) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 1000);
    } else {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setShowTooltip(false);
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [hoveredIcon]);

  // Animate dots for loading state
  useEffect(() => {
    if (pageReadingState !== 'reading') return;

    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [pageReadingState]);

  // Animate dots for summarising loading state (before first chunk)
  useEffect(() => {
    if (summariseState !== 'summarising' || streamingText.length > 0) return;

    const interval = setInterval(() => {
      setSummaryLoadingDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [summariseState, streamingText]);

  // Animate dots for ask loading state (before first chunk)
  useEffect(() => {
    if (askingState !== 'asking' || askStreamingText.length > 0) return;

    const interval = setInterval(() => {
      setAskLoadingDotCount((prev) => (prev % 3) + 1);
    }, 400);

    return () => clearInterval(interval);
  }, [askingState, askStreamingText]);

  // CRITICAL: Continuously scroll to active element during streaming
  // This prevents the scroll from being interrupted by re-renders
  useEffect(() => {
    const isStreaming = summariseState === 'summarising' || askingState === 'asking';
    
    if (isStreaming && activeScrollTargetRef.current) {
      console.log('[SummaryView] Starting continuous scroll during streaming');
      
      // Clear any existing interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
      
      // Keep scrolling to the element every 200ms during streaming
      scrollIntervalRef.current = setInterval(() => {
        if (activeScrollTargetRef.current && activeScrollTargetRef.current.isConnected) {
          try {
            activeScrollTargetRef.current.scrollIntoView({ 
              behavior: 'instant' as ScrollBehavior, 
              block: 'center',
              inline: 'nearest'
            });
          } catch (error) {
            console.error('[SummaryView] Error in continuous scroll:', error);
          }
        }
      }, 200);
      
      return () => {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
          console.log('[SummaryView] Stopped continuous scroll');
        }
      };
    } else {
      // Streaming stopped, clear the interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
        console.log('[SummaryView] Cleared scroll interval (streaming ended)');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summariseState, askingState]);


  // Extract page content on mount (only if not already done)
  useEffect(() => {
    if (pageReadingState !== 'reading') return;

    const initPageContent = async () => {
      try {
        // Check if content already exists
        const existingContent = await getStoredPageContent();
        if (existingContent) {
          setPageReadingState('ready');
          return;
        }

        // Extract and store content
        const content = await extractAndStorePageContent();
        if (content) {
          setPageReadingState('ready');
        } else {
          setPageReadingState('error');
          setErrorMessage('Could not extract page content');
        }
      } catch (error) {
        console.error('[SummaryView] Error extracting page content:', error);
        setPageReadingState('error');
        setErrorMessage('Failed to read page content');
      }
    };

    initPageContent();
  }, [pageReadingState, setPageReadingState, setErrorMessage]);

  // Scroll detection logic
  const SCROLL_THRESHOLD = 5; // pixels from bottom to consider "at bottom"
  
  const checkIfAtBottom = useCallback((element: HTMLDivElement): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollTop >= scrollHeight - clientHeight - SCROLL_THRESHOLD;
  }, []);

  // Handle scroll events to detect user scrolling
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (checkIfAtBottom(container)) {
        // User scrolled to bottom - re-enable auto-scroll
        setShouldAutoScroll(true);
      } else {
        // User scrolled up - disable auto-scroll
        setShouldAutoScroll(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkIfAtBottom]);

  // Auto-scroll to bottom when content changes (only if shouldAutoScroll is true)
  useEffect(() => {
    if (chatContainerRef.current && shouldAutoScroll) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [summary, streamingText, askStreamingText, chatMessages, shouldAutoScroll]);

  // Helper function to smoothly remove highlight
  const clearHighlightSmoothly = useCallback((element: HTMLElement) => {
    // Ensure transition is set for smooth fade out
    element.style.transition = 'background-color 0.3s ease, border-radius 0.3s ease, padding 0.3s ease';
    
    // Fade out background color smoothly to transparent
    element.style.backgroundColor = 'transparent';
    element.style.borderRadius = '';
    element.style.paddingLeft = '';
    element.style.paddingRight = '';
    
    // After transition completes, clear all styles
    setTimeout(() => {
      if (element && element.style) {
        element.style.backgroundColor = '';
        element.style.borderRadius = '';
        element.style.paddingLeft = '';
        element.style.paddingRight = '';
        element.style.transition = '';
      }
    }, 300); // Match transition duration (0.3s = 300ms)
  }, []);

  // Handle reference link click - scroll and highlight
  const handleReferenceClick = useCallback((refText: string) => {
    console.log('========================================');
    console.log('[SummaryView] ===== REFERENCE LINK CLICKED =====');
    console.log('[SummaryView] Reference text:', refText);
    console.log('[SummaryView] Reference text length:', refText.length);
    console.log('[SummaryView] Reference text trimmed:', refText.trim());
    console.log('[SummaryView] Currently active ref:', activeRefText);
    console.log('[SummaryView] Reference mappings size:', referenceMappingsRef.current.size);
    console.log('[SummaryView] Reference mappings keys:', Array.from(referenceMappingsRef.current.keys()));
    console.log('[SummaryView] Reference mappings entries:', Array.from(referenceMappingsRef.current.entries()).map(([key, el]) => ({
      key,
      keyLength: key.length,
      tagName: el.tagName,
      textSnippet: el.textContent?.substring(0, 50),
    })));
    
    // Check if clicking the same ref (toggle off)
    if (activeRefText === refText && highlightedElementRef.current) {
      console.log('[SummaryView] Toggling off - same ref clicked');
      // Clear highlight smoothly
      const elementToClear = highlightedElementRef.current;
      clearHighlightSmoothly(elementToClear);
      highlightedElementRef.current = undefined;
      setActiveRefText(null);
      // Clear scroll target
      activeScrollTargetRef.current = null;
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      console.log('========================================');
      return;
    }
    
    // Clear previous highlight (different ref clicked)
    if (highlightedElementRef.current) {
      console.log('[SummaryView] Step 1: Clearing previous highlight on element:', highlightedElementRef.current.tagName);
      const elementToClear = highlightedElementRef.current;
      clearHighlightSmoothly(elementToClear);
      highlightedElementRef.current = undefined;
    } else {
      console.log('[SummaryView] Step 1: No previous highlight to clear');
    }
    // Clear previous scroll target
    activeScrollTargetRef.current = null;
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
      console.log('[SummaryView] Step 1: Cleared previous timeout');
    }

    // Find or get stored element
    console.log('[SummaryView] Step 2: Looking up element in storage...');
    let element = referenceMappingsRef.current.get(refText);
    console.log('[SummaryView] Step 2 result - Element from storage:', element ? 'FOUND' : 'NOT FOUND');
    if (element) {
      console.log('[SummaryView] Element details from storage:', {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContentSnippet: element.textContent?.substring(0, 100),
        isConnected: element.isConnected,
        offsetParent: element.offsetParent !== null,
        boundingRect: element.getBoundingClientRect(),
      });
    }
    
    if (!element) {
      console.log('[SummaryView] Step 3: Element not in storage, searching for match...');
      console.log('[SummaryView] Calling findMatchingElement with:', refText);
      // Try to find it now
      const foundElement = findMatchingElement(refText);
      console.log('[SummaryView] Step 3 result - Search result:', foundElement ? 'FOUND' : 'NOT FOUND');
      if (foundElement) {
        console.log('[SummaryView] Found element details:', {
          tagName: foundElement.tagName,
          id: foundElement.id,
          className: foundElement.className,
          textContentSnippet: foundElement.textContent?.substring(0, 100),
          isConnected: foundElement.isConnected,
          offsetParent: foundElement.offsetParent !== null,
          boundingRect: foundElement.getBoundingClientRect(),
        });
        referenceMappingsRef.current.set(refText, foundElement);
        element = foundElement;
        console.log('[SummaryView] Element stored in mappings');
      } else {
        console.warn('[SummaryView] findMatchingElement returned null/undefined');
      }
    }

    if (element) {
      console.log('[SummaryView] Step 4: Element found, proceeding with scroll and highlight');
      console.log('[SummaryView] Element final details:', {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContentSnippet: element.textContent?.substring(0, 100),
        isConnected: element.isConnected,
        offsetParent: element.offsetParent !== null,
        boundingRect: element.getBoundingClientRect(),
        scrollTop: window.scrollY,
        scrollLeft: window.scrollX,
      });
      
      // Scroll to element - use requestAnimationFrame to ensure element is ready
      console.log('[SummaryView] Step 5: Preparing to scroll to element...');
      requestAnimationFrame(() => {
        try {
          // Verify element is still connected
          if (!element.isConnected) {
            console.warn('[SummaryView] Element is not connected to DOM, cannot scroll');
            return;
          }

          // Get element position
          const rect = element.getBoundingClientRect();
          console.log('[SummaryView] Element position before scroll:', {
            top: rect.top,
            left: rect.left,
            windowScrollY: window.scrollY,
            windowScrollX: window.scrollX,
            viewportHeight: window.innerHeight,
          });
          
          // Try scrollIntoView first (most reliable)
          try {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            console.log('[SummaryView] Step 5: scrollIntoView called successfully');
          } catch (scrollIntoViewError) {
            console.warn('[SummaryView] scrollIntoView failed, trying manual scroll:', scrollIntoViewError);
            // Fallback: manual scroll calculation
            const scrollY = window.scrollY + rect.top - window.innerHeight / 2;
            const scrollX = window.scrollX + rect.left - window.innerWidth / 2;
            
            // Scroll window
            window.scrollTo({ 
              top: Math.max(0, scrollY), 
              left: Math.max(0, scrollX), 
              behavior: 'smooth' 
            });
            console.log('[SummaryView] Manual window scroll executed');
            
            // Also try scrolling document.documentElement if available
            if (document.documentElement) {
              document.documentElement.scrollTo({
                top: Math.max(0, scrollY),
                left: Math.max(0, scrollX),
                behavior: 'smooth'
              });
            }
          }
        } catch (error) {
          console.error('[SummaryView] Step 5: Error in scroll operation:', error);
        }
      });

      // Highlight element
      console.log('[SummaryView] Step 6: Applying highlight styles...');
      try {
        const originalStyles = {
          backgroundColor: element.style.backgroundColor,
          borderRadius: element.style.borderRadius,
          paddingLeft: element.style.paddingLeft,
          paddingRight: element.style.paddingRight,
        };
        console.log('[SummaryView] Original element styles:', originalStyles);
        
        element.style.backgroundColor = colorWithOpacity(COLORS.PRIMARY_VERY_LIGHT, 0.5);
        element.style.borderRadius = '5px';
        element.style.paddingLeft = '4px';
        element.style.paddingRight = '4px';
        element.style.transition = 'background-color 0.3s ease, border-radius 0.3s ease, padding 0.3s ease';
        
        console.log('[SummaryView] Step 6: Highlight styles applied');
        console.log('[SummaryView] Element computed styles after highlight:', {
          backgroundColor: window.getComputedStyle(element).backgroundColor,
          borderRadius: window.getComputedStyle(element).borderRadius,
        });
        
        highlightedElementRef.current = element;
        setActiveRefText(refText);
        // Set as active scroll target for continuous scrolling during streaming
        activeScrollTargetRef.current = element;
        console.log('[SummaryView] Step 6: Highlight reference stored, will persist until toggled or another ref clicked');
        console.log('[SummaryView] Active scroll target set for continuous scrolling during streaming');
      } catch (error) {
        console.error('[SummaryView] Step 6: Error applying highlight:', error);
      }
    } else {
      console.error('[SummaryView] ===== ELEMENT NOT FOUND =====');
      console.error('[SummaryView] Could not find element for reference:', refText);
      console.error('[SummaryView] Available mappings:', Array.from(referenceMappingsRef.current.entries()).map(([key, el]) => ({
        key,
        keyLength: key.length,
        keyMatches: key === refText,
        keyTrimmedMatches: key.trim() === refText.trim(),
        tagName: el.tagName,
        textSnippet: el.textContent?.substring(0, 50),
      })));
      console.error('[SummaryView] ===== END ERROR =====');
    }
    console.log('========================================');
  }, [activeRefText, clearHighlightSmoothly]);

  // Parse summary text and replace reference links with numbered buttons
  // Also stores reference mappings for later use
  const parseReferences = useCallback((text: string): { parsedText: string; references: string[] } => {
    const references: string[] = [];
    let refIndex = 0;

    // Replace reference patterns with a unique placeholder that won't break markdown parsing
    // Using a code-like syntax that ReactMarkdown will render inline
    const parsedText = text.replace(REF_LINK_PATTERN, (_match, refText) => {
      refIndex++;
      const trimmedRefText = refText.trim();
      references.push(trimmedRefText);
      
      console.log(`[SummaryView] Parsing reference ${refIndex}:`, trimmedRefText);
      
      // Find and store matching element
      console.log(`[SummaryView] Searching for element matching: "${trimmedRefText}"`);
      const element = findMatchingElement(trimmedRefText);
      if (element) {
        console.log(`[SummaryView] Found matching element for ref ${refIndex}:`, {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContentSnippet: element.textContent?.substring(0, 100),
          isConnected: element.isConnected,
          offsetParent: element.offsetParent !== null,
        });
        referenceMappingsRef.current.set(trimmedRefText, element as HTMLElement);
        console.log(`[SummaryView] Stored reference mapping: "${trimmedRefText}" -> element`);
      } else {
        console.warn(`[SummaryView] No matching element found for reference ${refIndex}: "${trimmedRefText}"`);
      }
      
      // Use a unique placeholder that looks like inline code to ReactMarkdown
      return `\`REF_${refIndex}_PLACEHOLDER\``;
    });
    
    console.log(`[SummaryView] parseReferences completed. Found ${references.length} references.`);
    console.log(`[SummaryView] Reference mappings stored:`, Array.from(referenceMappingsRef.current.keys()));

    return { parsedText, references };
  }, []);

  // Render summary with markdown and reference links
  const renderSummaryContent = (text: string) => {
    const { parsedText, references } = parseReferences(text);
    
    if (references.length === 0) {
      return (
        <ReactMarkdown
          components={{
            // Custom styling for markdown elements
            h1: ({ children }) => <h1 className={getClassName('markdownH1')}>{children}</h1>,
            h2: ({ children }) => <h2 className={getClassName('markdownH2')}>{children}</h2>,
            h3: ({ children }) => <h3 className={getClassName('markdownH3')}>{children}</h3>,
            p: ({ children }) => <p className={getClassName('markdownP')}>{children}</p>,
            ul: ({ children }) => <ul className={getClassName('markdownUl')}>{children}</ul>,
            ol: ({ children }) => <ol className={getClassName('markdownOl')}>{children}</ol>,
            li: ({ children }) => <li className={getClassName('markdownLi')}>{children}</li>,
            strong: ({ children }) => <strong className={getClassName('markdownStrong')}>{children}</strong>,
            em: ({ children }) => <em className={getClassName('markdownEm')}>{children}</em>,
            code: ({ children }) => {
              // Check if this is a reference placeholder
              const codeText = String(children);
              const refMatch = codeText.match(/^REF_(\d+)_PLACEHOLDER$/);
              if (refMatch) {
                const refNum = parseInt(refMatch[1], 10);
                const refText = references[refNum - 1];
                const isActive = activeRefText === refText;
                return (
                  <button
                    className={`${getClassName('refButton')} ${isActive ? getClassName('refButtonActive') : ''}`}
                    title={refText}
                    onClick={() => handleReferenceClick(refText)}
                  >
                    {refNum}
                  </button>
                );
              }
              // Regular code element
              return <code className={getClassName('markdownCode')}>{children}</code>;
            },
          }}
        >
          {parsedText}
        </ReactMarkdown>
      );
    }

    // If there are references, render with custom code component handler
    return (
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className={getClassName('markdownH1')}>{children}</h1>,
          h2: ({ children }) => <h2 className={getClassName('markdownH2')}>{children}</h2>,
          h3: ({ children }) => <h3 className={getClassName('markdownH3')}>{children}</h3>,
          p: ({ children }) => <p className={getClassName('markdownP')}>{children}</p>,
          ul: ({ children }) => <ul className={getClassName('markdownUl')}>{children}</ul>,
          ol: ({ children }) => <ol className={getClassName('markdownOl')}>{children}</ol>,
          li: ({ children }) => <li className={getClassName('markdownLi')}>{children}</li>,
          strong: ({ children }) => <strong className={getClassName('markdownStrong')}>{children}</strong>,
          em: ({ children }) => <em className={getClassName('markdownEm')}>{children}</em>,
          code: ({ children }) => {
            // Check if this is a reference placeholder
            const codeText = String(children);
            const refMatch = codeText.match(/^REF_(\d+)_PLACEHOLDER$/);
            if (refMatch) {
              const refNum = parseInt(refMatch[1], 10);
              const refText = references[refNum - 1];
              return (
                <button
                  className={getClassName('refButton')}
                  title={refText}
                  onClick={() => handleReferenceClick(refText)}
                >
                  {refNum}
                </button>
              );
            }
            // Regular code element
            return <code className={getClassName('markdownCode')}>{children}</code>;
          },
        }}
      >
        {parsedText}
      </ReactMarkdown>
    );
  };

  const handleSummarise = async () => {
    if (pageReadingState !== 'ready') return;
    
    // If already summarising, stop the request (this is the "Stop" button)
    if (summariseState === 'summarising') {
      console.log('[SummaryView] Stop button clicked - aborting summarise request');
      
      // Abort the actual network request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Save accumulated text to summary
      if (streamingText) {
        console.log(`[SummaryView] Saved ${streamingText.length} characters to summary`);
        setSummary(streamingText);
        setSummariseState('done');
        setStreamingText('');
      } else {
        console.log('[SummaryView] No content received yet, returning to idle');
        setSummariseState('idle');
      }
      return;
    }

    // If done, allow re-summarizing (will overwrite existing summary)
    // No need to clear - just start a new summarisation

    setSummariseState('summarising');
    setStreamingText('');
    setSummary('');
    // Clear summary questions (keep chat message questions)
    setMessageQuestions((prev) => {
      const { [-1]: _, ...rest } = prev;
      return rest;
    });
    setErrorMessage('');

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const pageContent = await getStoredPageContent();
      if (!pageContent) {
        setSummariseState('error');
        setErrorMessage('Page content not available');
        return;
      }

      // Get language code from user settings
      const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;

      await SummariseService.summarise(
        {
          text: pageContent,
          context_type: 'PAGE',
          languageCode,
        },
        {
          onChunk: (_chunk, accumulated) => {
            setStreamingText(accumulated);
          },
          onComplete: (finalSummary, questions) => {
            // Log the complete API response for debugging
            console.log('[SummaryView] Complete API response:', finalSummary);
            setSummary(finalSummary);
            setStreamingText('');
            // Store questions for summary (use -1 as key for summary)
            if (questions.length > 0) {
              setMessageQuestions((prev) => ({
                ...prev,
                [-1]: questions,
              }));
            }
            setSummariseState('done');
          },
          onError: (errorCode, errorMsg) => {
            console.error('[SummaryView] Summarise error:', errorCode, errorMsg);
            setSummariseState('error');
            setErrorMessage(errorMsg);
          },
          onLoginRequired: () => {
            setSummariseState('idle');
            onLoginRequired?.();
          },
        },
        abortControllerRef.current
      );
    } catch (error) {
      console.error('[SummaryView] Summarise exception:', error);
      setSummariseState('error');
      setErrorMessage('An error occurred while summarising');
    }
  };

  const handleAskQuestion = async (question: string) => {
    if (!question.trim() || askingState === 'asking') return;

    console.log('[SummaryView] Ask question started:', question);

    const userMessage: ChatMessage = {
      role: 'user',
      content: question.trim(),
    };

    // Add user message immediately for instant UI feedback
    setChatMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setAskingState('asking');
    setAskStreamingText('');
    console.log('[SummaryView] State set to asking, waiting for first chunk...');

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const pageContent = await getStoredPageContent();

      // Get language code from user settings
      const nativeLanguageForAsk = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCodeForAsk = nativeLanguageForAsk ? (getLanguageCode(nativeLanguageForAsk) || undefined) : undefined;

      await AskService.ask(
        {
          question: question.trim(),
          // Send OLD chat history without the new user message
          // API will add the user message from the 'question' field
          chat_history: chatMessages,
          initial_context: pageContent || undefined,
          context_type: 'PAGE',
          languageCode: languageCodeForAsk,
        },
        {
          onChunk: (_chunk, accumulated) => {
            console.log('[SummaryView] First chunk received, hiding loading dots');
            setAskStreamingText(accumulated);
          },
          onComplete: (updatedChatHistory, questions) => {
            // Log the complete API response for debugging
            const lastMessage = updatedChatHistory[updatedChatHistory.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              console.log('[SummaryView] Complete Ask API response:', lastMessage.content);
            }
            // Replace with authoritative server response
            setChatMessages(updatedChatHistory);
            // Store questions for the last assistant message (by index)
            if (questions.length > 0) {
              const assistantMessageIndex = updatedChatHistory.findIndex(
                (msg, idx) => msg.role === 'assistant' && idx === updatedChatHistory.length - 1
              );
              if (assistantMessageIndex >= 0) {
                setMessageQuestions((prev) => ({
                  ...prev,
                  [assistantMessageIndex]: questions,
                }));
              }
            }
            setAskStreamingText('');
            setAskingState('idle');
          },
          onError: (errorCode, errorMsg) => {
            console.error('[SummaryView] Ask error:', errorCode, errorMsg);
            setAskingState('error');
            setErrorMessage(errorMsg);
            setAskStreamingText('');
          },
          onLoginRequired: () => {
            setAskingState('idle');
            setAskStreamingText('');
            onLoginRequired?.();
          },
        },
        abortControllerRef.current
      );
    } catch (error) {
      console.error('[SummaryView] Ask exception:', error);
      setAskingState('error');
      setErrorMessage('An error occurred while asking');
      setAskStreamingText('');
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    handleAskQuestion(inputValue.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const handleClearChat = () => {
    setChatMessages([]);
    setSummary('');
    setStreamingText('');
    setAskStreamingText('');
    setMessageQuestions({});
    setSummariseState('idle');
    setAskingState('idle');
    setErrorMessage('');
    // Clear reference mappings
    referenceMappingsRef.current.clear();
    // Clear active ref and highlight smoothly
    if (highlightedElementRef.current) {
      const elementToClear = highlightedElementRef.current;
      clearHighlightSmoothly(elementToClear);
      highlightedElementRef.current = undefined;
    }
    setActiveRefText(null);
    // Clear scroll target
    activeScrollTargetRef.current = null;
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  const handleQuestionClick = (question: string) => {
    // Call API directly - question will be displayed immediately by handleAskQuestion
    handleAskQuestion(question);
  };

  const handleStopRequest = () => {
    console.log('[SummaryView] Stop request clicked');
    
    if (!abortControllerRef.current) {
      console.warn('[SummaryView] No abort controller available');
      return;
    }
    
    // Abort the actual network request
    console.log('[SummaryView] Aborting API request...');
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    
    // Stop summarise if in progress
    if (summariseState === 'summarising') {
      console.log('[SummaryView] Stopping summarise - saving accumulated content');
      
      // Save whatever content was streamed so far
      if (streamingText) {
        console.log(`[SummaryView] Saved ${streamingText.length} characters to summary`);
        setSummary(streamingText);
        setStreamingText('');
        setSummariseState('done');
      } else {
        console.log('[SummaryView] No content received yet, returning to idle');
        setSummariseState('idle');
      }
    }
    
    // Stop ask if in progress
    if (askingState === 'asking') {
      console.log('[SummaryView] Stopping ask - saving accumulated content');
      
      // Save whatever content was streamed so far
      if (askStreamingText) {
        console.log(`[SummaryView] Saved ${askStreamingText.length} characters to chat`);
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: askStreamingText,
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
        setAskStreamingText('');
      } else {
        console.log('[SummaryView] No content received yet');
      }
      setAskingState('idle');
    }
  };

  // Get button text and icon based on state
  const getButtonContent = () => {
    if (pageReadingState === 'reading') {
      return { text: `Reading page${'.'.repeat(dotCount)}`, icon: null };
    }
    if (summariseState === 'summarising') {
      return { text: 'Stop', icon: <Square size={14} /> };
    }
    // When done, show "Summarise page" to allow re-summarizing
    if (summariseState === 'done') {
      return { text: 'Summarise page', icon: null };
    }
    return { text: 'Summarise page', icon: null };
  };

  const { text: buttonText, icon: buttonIcon } = getButtonContent();
  const isButtonDisabled = pageReadingState !== 'ready';

  // Get tooltip message based on hovered icon
  const getTooltipMessage = () => {
    switch (hoveredIcon) {
      case 'send':
        return 'Ask question';
      case 'delete':
        return 'Clear chat';
      default:
        return '';
    }
  };

  const getTooltipRef = () => {
    switch (hoveredIcon) {
      case 'send':
        return sendButtonRef;
      case 'delete':
        return deleteButtonRef;
      default:
        return null;
    }
  };

  return (
    <div className={getClassName('summaryView')}>
      {/* Scrollable Content Area */}
      <div className={getClassName('chatContainer')} ref={chatContainerRef}>
        {/* 3-Dot Loading Animation - Show when summarising and no chunks received yet */}
        {summariseState === 'summarising' && streamingText.length === 0 && (
          <LoadingDots dotCount={summaryLoadingDotCount} getClassName={getClassName} />
        )}

        {/* Summary Content */}
        {(summary || streamingText) && (
          <div className={getClassName('summaryContent')}>
            <div className={getClassName('summaryText')}>
              {renderSummaryContent(summary || streamingText)}
              {summariseState === 'summarising' && (
                <span className={getClassName('cursor')}>|</span>
              )}
            </div>
          </div>
        )}

        {/* Suggested Questions for Summary */}
        {messageQuestions[-1] && messageQuestions[-1].length > 0 && (
          <div className={getClassName('suggestedQuestions')}>
            {messageQuestions[-1].map((question, index) => (
              <button
                key={index}
                className={getClassName('questionItem')}
                onClick={() => handleQuestionClick(question)}
              >
                <Plus size={14} className={getClassName('questionIcon')} />
                <span className={getClassName('questionText')}>{question}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        {chatMessages.length > 0 && (
          <div className={getClassName('messages')}>
            {chatMessages.map((message, index) => (
              <React.Fragment key={index}>
                <div
                  className={`${getClassName('message')} ${getClassName(message.role === 'user' ? 'userMessage' : 'assistantMessage')}`}
                >
                  {message.role === 'assistant' ? (
                    renderSummaryContent(message.content)
                  ) : (
                    message.content
                  )}
                </div>
                {/* Show questions for this assistant message */}
                {message.role === 'assistant' && messageQuestions[index] && messageQuestions[index].length > 0 && (
                  <div className={getClassName('suggestedQuestions')}>
                    {messageQuestions[index].map((question, qIndex) => (
                      <button
                        key={qIndex}
                        className={getClassName('questionItem')}
                        onClick={() => handleQuestionClick(question)}
                      >
                        <Plus size={14} className={getClassName('questionIcon')} />
                        <span className={getClassName('questionText')}>{question}</span>
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
            {/* 3-Dot Loading Animation - Show when asking and no chunks received yet */}
            {askingState === 'asking' && askStreamingText.length === 0 && (
              <div className={getClassName('loadingContainer')}>
                <LoadingDots dotCount={askLoadingDotCount} getClassName={getClassName} />
              </div>
            )}
            {/* Show streaming assistant response */}
            {askStreamingText && (
              <div className={`${getClassName('message')} ${getClassName('assistantMessage')}`}>
                {renderSummaryContent(askStreamingText)}
                <span className={getClassName('cursor')}>|</span>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!summary && !streamingText && chatMessages.length === 0 && summariseState === 'idle' && (
          <div className={getClassName('emptyState')}>
            <p>
              Click "Summarise page" to get started<br />
              or<br />
              Ask AI anything about the page
            </p>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className={getClassName('errorState')}>
            <p>{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Summarise Button Row - Only show when summary is not done */}
      {summariseState !== 'done' && (
        <div className={getClassName('summariseButtonRow')}>
          <button
            className={`${getClassName('summariseButton')} ${summariseState === 'summarising' ? getClassName('stopVariant') : ''}`}
            onClick={handleSummarise}
            disabled={isButtonDisabled}
          >
            {buttonIcon}
            {buttonText}
          </button>
        </div>
      )}

      {/* User Input Bar */}
      <div className={getClassName('inputBar')}>
        <div className={getClassName('inputWrapper')}>
          <input
            type="text"
            className={getClassName('input')}
            placeholder="Ask AI about the page"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        
        {/* Stop Button - Show when asking (not summarising) */}
        {askingState === 'asking' ? (
          <button
            ref={sendButtonRef}
            className={getClassName('stopButton')}
            onClick={handleStopRequest}
            onMouseEnter={() => setHoveredIcon('send')}
            onMouseLeave={() => setHoveredIcon(null)}
            aria-label="Stop request"
            type="button"
          >
            <Square size={18} />
          </button>
        ) : summariseState === 'summarising' ? (
          /* During summarising, show disabled send button */
          <button
            ref={sendButtonRef}
            className={getClassName('sendButton')}
            disabled={true}
            onMouseEnter={() => setHoveredIcon('send')}
            onMouseLeave={() => setHoveredIcon(null)}
            aria-label="Ask question"
            type="button"
          >
            <ArrowUp size={18} />
          </button>
        ) : (
          /* Send Button - Show when not requesting */
          <button
            ref={sendButtonRef}
            className={getClassName('sendButton')}
            onClick={handleSend}
            onMouseEnter={() => setHoveredIcon('send')}
            onMouseLeave={() => setHoveredIcon(null)}
            disabled={!inputValue.trim()}
            aria-label="Ask question"
            type="button"
          >
            <ArrowUp size={18} />
          </button>
        )}

        {/* Delete/Clear Button - Only show when there is content */}
        {hasContent && (
          <button
            ref={deleteButtonRef}
            className={getClassName('deleteButton')}
            onClick={handleClearChat}
            onMouseEnter={() => setHoveredIcon('delete')}
            onMouseLeave={() => setHoveredIcon(null)}
            aria-label="Clear chat"
            type="button"
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Tooltip */}
        {showTooltip && hoveredIcon && getTooltipRef()?.current && (
          <OnHoverMessage
            message={getTooltipMessage()}
            targetRef={getTooltipRef()!}
            position="top"
            offset={8}
          />
        )}
      </div>
    </div>
  );
};

SummaryView.displayName = 'SummaryView';
