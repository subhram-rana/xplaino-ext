// src/content/components/TextExplanationSidePanel/TextExplanationView.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Trash2, Plus, Square, Loader2, Check } from 'lucide-react';
import { Dropdown, type DropdownOption } from '../SidePanel/Dropdown';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import styles from './TextExplanationView.module.css';

export interface TextExplanationViewProps {
  /** Whether to use Shadow DOM styling */
  useShadowDom?: boolean;
  /** Callback when login is required */
  onLoginRequired?: () => void;
  /** Streaming text content */
  streamingText?: string;
  /** View mode: 'contextual' or 'translation' */
  viewMode?: 'contextual' | 'translation';
  /** Possible questions from API */
  possibleQuestions?: string[];
  /** Handler for question clicks */
  onQuestionClick?: (question: string) => void;
  /** Handler for input submission */
  onInputSubmit?: (text: string) => void;
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
}

export const TextExplanationView: React.FC<TextExplanationViewProps> = ({
  useShadowDom = false,
  streamingText = '',
  viewMode = 'contextual',
  possibleQuestions = [],
  onQuestionClick,
  onInputSubmit,
  chatMessages = [],
  messageQuestions = {},
  onClearChat,
  onStopRequest,
  isRequesting = false,
  shouldAllowSimplifyMore = false,
  onSimplify,
  isSimplifying = false,
  pendingQuestion: _pendingQuestion,
  firstChunkReceived = false,
  translations = [],
  onTranslate,
  isTranslating = false,
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const translationsContainerRef = useRef<HTMLDivElement>(null);
  const [loadingDotCount, setLoadingDotCount] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);
  const [showSuccessCheckmark, setShowSuccessCheckmark] = useState(false);
  const previousTranslationsLengthRef = useRef<number>(0);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Language options - same as SettingsView
  const languageOptions: DropdownOption[] = [
    { value: 'English', label: 'English' },
    { value: 'Español', label: 'Español' },
    { value: 'Français', label: 'Français' },
    { value: 'Deutsch', label: 'Deutsch' },
    { value: 'Italiano', label: 'Italiano' },
    { value: 'Português', label: 'Português' },
    { value: 'Русский', label: 'Русский' },
    { value: '中文', label: '中文' },
    { value: '日本語', label: '日本語' },
    { value: '한국어', label: '한국어' },
    { value: 'العربية', label: 'العربية' },
    { value: 'हिन्दी', label: 'हिन्दी' },
    { value: 'Nederlands', label: 'Nederlands' },
    { value: 'Türkçe', label: 'Türkçe' },
    { value: 'Polski', label: 'Polski' },
    { value: 'Svenska', label: 'Svenska' },
    { value: 'Norsk', label: 'Norsk' },
    { value: 'Dansk', label: 'Dansk' },
    { value: 'Suomi', label: 'Suomi' },
    { value: 'Ελληνικά', label: 'Ελληνικά' },
    { value: 'Čeština', label: 'Čeština' },
    { value: 'Magyar', label: 'Magyar' },
    { value: 'Română', label: 'Română' },
    { value: 'Български', label: 'Български' },
    { value: 'Hrvatski', label: 'Hrvatski' },
    { value: 'Srpski', label: 'Srpski' },
    { value: 'Slovenčina', label: 'Slovenčina' },
    { value: 'Slovenščina', label: 'Slovenščina' },
    { value: 'Українська', label: 'Українська' },
    { value: 'עברית', label: 'עברית' },
    { value: 'فارسی', label: 'فارسی' },
    { value: 'اردو', label: 'اردو' },
    { value: 'বাংলা', label: 'বাংলা' },
    { value: 'தமிழ்', label: 'தமிழ்' },
    { value: 'తెలుగు', label: 'తెలుగు' },
    { value: 'मराठी', label: 'मराठी' },
    { value: 'ગુજરાતી', label: 'ગુજરાતી' },
    { value: 'ಕನ್ನಡ', label: 'ಕನ್ನಡ' },
    { value: 'മലയാളം', label: 'മലയാളം' },
    { value: 'ਪੰਜਾਬੀ', label: 'ਪੰਜਾਬੀ' },
    { value: 'ଓଡ଼ିଆ', label: 'ଓଡ଼ିଆ' },
    { value: 'नेपाली', label: 'नेपाली' },
    { value: 'සිංහල', label: 'සිංහල' },
    { value: 'ไทย', label: 'ไทย' },
    { value: 'Tiếng Việt', label: 'Tiếng Việt' },
    { value: 'Bahasa Indonesia', label: 'Bahasa Indonesia' },
    { value: 'Bahasa Melayu', label: 'Bahasa Melayu' },
    { value: 'Filipino', label: 'Filipino' },
    { value: 'Tagalog', label: 'Tagalog' },
    { value: 'မြန်မာ', label: 'မြန်မာ' },
    { value: 'ភាសាខ្មែរ', label: 'ភាសាខ្មែរ' },
    { value: 'Lao', label: 'Lao' },
    { value: 'Монгол', label: 'Монгол' },
    { value: 'ქართული', label: 'ქართული' },
    { value: 'Հայերեն', label: 'Հայերեն' },
    { value: 'Azərbaycan', label: 'Azərbaycan' },
    { value: 'Қазақ', label: 'Қазақ' },
    { value: 'Oʻzbek', label: 'Oʻzbek' },
    { value: 'Türkmen', label: 'Türkmen' },
    { value: 'Kyrgyz', label: 'Kyrgyz' },
    { value: 'Afrikaans', label: 'Afrikaans' },
    { value: 'Swahili', label: 'Swahili' },
    { value: 'Zulu', label: 'Zulu' },
    { value: 'Xhosa', label: 'Xhosa' },
    { value: 'Amharic', label: 'Amharic' },
    { value: 'Yoruba', label: 'Yoruba' },
    { value: 'Igbo', label: 'Igbo' },
    { value: 'Hausa', label: 'Hausa' },
  ];

  // Load native language setting when view mode is translation
  useEffect(() => {
    if (viewMode === 'translation') {
      const loadNativeLanguage = async () => {
        try {
          const lang = await ChromeStorage.getUserSettingNativeLanguage();
          
          // If native language is set and not "As per website", auto-select it
          if (lang && lang !== 'As per website' && lang.trim() !== '') {
            setSelectedLanguage(lang);
          } else {
            setSelectedLanguage(undefined);
          }
        } catch (error) {
          console.error('[TextExplanationView] Error loading native language:', error);
        }
      };
      loadNativeLanguage();
    }
  }, [viewMode]);

  // Check if translate button should be enabled
  // Button should be enabled if:
  // 1. A language is selected
  // 2. Translation for that language doesn't already exist
  const translationExists = selectedLanguage 
    ? translations.some(t => t.language === selectedLanguage)
    : false;
  const isTranslateEnabled = selectedLanguage !== undefined && 
                             selectedLanguage !== null && 
                             selectedLanguage.trim() !== '' && 
                             !translationExists;

  const getClassName = useCallback((baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    return styles[baseClass as keyof typeof styles] || baseClass;
  }, [useShadowDom]);

  // Memoize ReactMarkdown components to prevent infinite re-renders
  const markdownComponents = React.useMemo(() => ({
    h1: ({ children }: any) => <h1 className={getClassName('markdownH1')}>{children}</h1>,
    h2: ({ children }: any) => <h2 className={getClassName('markdownH2')}>{children}</h2>,
    h3: ({ children }: any) => <h3 className={getClassName('markdownH3')}>{children}</h3>,
    p: ({ children }: any) => <p className={getClassName('markdownP')}>{children}</p>,
    ul: ({ children }: any) => <ul className={getClassName('markdownUl')}>{children}</ul>,
    ol: ({ children }: any) => <ol className={getClassName('markdownOl')}>{children}</ol>,
    li: ({ children }: any) => <li className={getClassName('markdownLi')}>{children}</li>,
    strong: ({ children }: any) => <strong className={getClassName('markdownStrong')}>{children}</strong>,
    em: ({ children }: any) => <em className={getClassName('markdownEm')}>{children}</em>,
    code: ({ children }: any) => <code className={getClassName('markdownCode')}>{children}</code>,
  }), [getClassName]);

  // Animated dots for loading state
  useEffect(() => {
    if (!streamingText || streamingText.trim().length === 0) {
      const interval = setInterval(() => {
        setLoadingDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [streamingText]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (chatContainerRef.current && (streamingText || chatMessages.length > 0)) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [streamingText, chatMessages]);

  // Show success checkmark when translation completes
  useEffect(() => {
    // Check if a new translation was just added (length increased and not currently translating)
    if (!isTranslating && translations.length > previousTranslationsLengthRef.current) {
      // Show checkmark when translation finishes
      setShowSuccessCheckmark(true);
      const timer = setTimeout(() => {
        setShowSuccessCheckmark(false);
      }, 2000); // Show for 2 seconds
      // Update the ref to current length
      previousTranslationsLengthRef.current = translations.length;
      return () => clearTimeout(timer);
    } else if (!isTranslating) {
      // Update ref even if no new translation (to track current state)
      previousTranslationsLengthRef.current = translations.length;
    }
  }, [isTranslating, translations.length]);

  // Auto-scroll to bottom when new translation is added
  useEffect(() => {
    if (translationsContainerRef.current && translations.length > 0) {
      // Use requestAnimationFrame to ensure DOM has fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (translationsContainerRef.current) {
            translationsContainerRef.current.scrollTop = translationsContainerRef.current.scrollHeight;
          }
        });
      });
    }
  }, [translations.length]);

  // Handle input submission - use ref to avoid dependency on onInputSubmit
  const onInputSubmitRef = React.useRef(onInputSubmit);
  useEffect(() => {
    onInputSubmitRef.current = onInputSubmit;
  }, [onInputSubmit]);

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isSubmitting) return;
    
    setInputValue('');
    setIsSubmitting(true);
    
    // Call the callback using ref to avoid dependency
    onInputSubmitRef.current?.(trimmedValue);
    
    // Reset submitting state after a short delay to allow the callback to process
    setTimeout(() => {
      setIsSubmitting(false);
    }, 100);
  }, [inputValue, isSubmitting]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Handle question click - use ref to avoid dependency
  const onQuestionClickRef = React.useRef(onQuestionClick);
  useEffect(() => {
    onQuestionClickRef.current = onQuestionClick;
  }, [onQuestionClick]);

  const handleQuestionClick = useCallback((question: string) => {
    onQuestionClickRef.current?.(question);
  }, []);

  // Process text based on view mode - use useMemo instead of useCallback
  const displayText = React.useMemo(() => {
    if (!streamingText) return '';
    
    // For now, both views show the same content
    // In the future, this could filter/transform based on viewMode
    return streamingText;
  }, [streamingText, viewMode]);
  
  // Check if streamingText is a new response (not matching last assistant message)
  const isNewStreamingResponse = React.useMemo(() => {
    if (!streamingText || streamingText.trim().length === 0) return false;
    if (chatMessages.length === 0) return true; // No chat history, so it's new
    
    // Find the last assistant message
    const lastAssistantMessage = [...chatMessages].reverse().find(msg => msg.role === 'assistant');
    if (!lastAssistantMessage) return true; // No assistant message, so it's new
    
    // Check if streamingText is different from the last assistant message
    // During streaming, it might be a prefix, so we check if it's different
    return streamingText !== lastAssistantMessage.content;
  }, [streamingText, chatMessages]);
  
  const hasContent = chatMessages.length > 0 || !!displayText || (streamingText && streamingText.trim().length > 0);
  const showQuestions = possibleQuestions.length > 0 && isNewStreamingResponse;
  const hasChatHistory = chatMessages.length > 0;

  // Translation view - show language dropdown and Translate button, plus translations
  if (viewMode === 'translation') {
    return (
      <div className={getClassName('textExplanationView')}>
        <div className={getClassName('translationView')}>
          {/* Translation Controls */}
          <div className={getClassName('translationControls')}>
            <div className={getClassName('languageDropdownWrapper')}>
              <Dropdown
                options={languageOptions}
                value={selectedLanguage}
                onChange={(value) => setSelectedLanguage(value)}
                placeholder="Select language"
                label="Choose target language"
                useShadowDom={useShadowDom}
              />
            </div>
            <div className={getClassName('translateButtonWrapper')}>
              <button
                className={getClassName('translateButton')}
                onClick={() => {
                  if (selectedLanguage && onTranslate) {
                    onTranslate(selectedLanguage);
                  }
                }}
                disabled={!isTranslateEnabled || isTranslating}
              >
                {isTranslating ? (
                  <>
                    <Loader2 size={14} className={getClassName('translateButtonSpinner')} />
                    Translating...
                  </>
                ) : (
                  'Translate'
                )}
              </button>
              {showSuccessCheckmark && (
                <Check
                  size={20}
                  className={getClassName('successCheckmark')}
                />
              )}
            </div>
          </div>

          {/* Translations Display */}
          {translations.length > 0 && (
            <div ref={translationsContainerRef} className={getClassName('translationsContainer')}>
              {translations.map((translation, index) => (
                <div key={index} className={getClassName('translationItem')}>
                  <h3 className={getClassName('translationLanguage')}>{translation.language}</h3>
                  <div className={getClassName('translationContent')}>
                    <ReactMarkdown components={markdownComponents}>
                      {translation.translated_content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Contextual view - show chat history or explanation with questions and input
  return (
    <div className={getClassName('textExplanationView')}>
      {/* Scrollable Content Area */}
      <div ref={chatContainerRef} className={getClassName('chatContainer')}>

        {/* Show initial explanation separately only when no chat history exists */}
        {!hasChatHistory && displayText && displayText.trim().length > 0 && (
          <>
            <div className={getClassName('explanationContent')}>
              <ReactMarkdown components={markdownComponents}>
                {displayText}
              </ReactMarkdown>
            </div>

            {/* Possible Questions for initial explanation */}
            {possibleQuestions.length > 0 && (
              <div className={getClassName('suggestedQuestions')}>
                {possibleQuestions.map((question, index) => (
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
          </>
        )}

        {/* Show chat messages when available */}
        {hasChatHistory && (
          <div className={getClassName('messages')}>
            {chatMessages.map((message, index) => (
              <React.Fragment key={index}>
                <div
                  className={`${getClassName('message')} ${getClassName(message.role === 'user' ? 'userMessage' : 'assistantMessage')}`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
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
            {/* Show streaming assistant response only if it's a new response */}
            {isNewStreamingResponse && streamingText && streamingText.trim().length > 0 && (
              <div className={`${getClassName('message')} ${getClassName('assistantMessage')}`}>
                <ReactMarkdown components={markdownComponents}>
                  {streamingText}
                </ReactMarkdown>
                <span className={getClassName('cursor')}>|</span>
              </div>
            )}
            {/* Show loading dots after last message when API request is active but no chunks received yet */}
            {isRequesting && !firstChunkReceived && streamingText.trim().length === 0 && (
              <div className={getClassName('loadingContainer')}>
                <div className={getClassName('loadingDots')}>
                  {'.'.repeat(loadingDotCount)}
                </div>
              </div>
            )}
            {/* Show questions for streaming response */}
            {isNewStreamingResponse && showQuestions && (
              <div className={getClassName('suggestedQuestions')}>
                {possibleQuestions.map((question, index) => (
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
          </div>
        )}
      </div>

      {/* Simplify Button - Show above input when shouldAllowSimplifyMore is true or when there's no content */}
      {(shouldAllowSimplifyMore || (chatMessages.length === 0 && streamingText.trim().length === 0 && !displayText)) && (
        <div className={getClassName('simplifyButtonContainer')}>
          <button
            className={getClassName('simplifyButton')}
            onClick={onSimplify}
            aria-label="Simplify explanation"
            type="button"
            disabled={isSimplifying || isRequesting}
          >
            {isSimplifying && streamingText.trim().length === 0 ? (
              <>
                <Loader2 size={14} className={getClassName('simplifyButtonSpinner')} />
                Simplify
              </>
            ) : (
              'Simplify'
            )}
          </button>
        </div>
      )}

      {/* User Input Bar */}
      <div className={getClassName('inputBar')}>
        <div className={getClassName('inputWrapper')}>
          <input
            type="text"
            className={getClassName('input')}
            placeholder="Ask about the explanation"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting || isRequesting}
          />
        </div>
        
        {/* Stop Button - Show when request is in progress */}
        {isRequesting ? (
          <button
            ref={sendButtonRef}
            className={getClassName('stopButton')}
            onClick={onStopRequest}
            aria-label="Stop request"
            type="button"
          >
            <Square size={18} />
          </button>
        ) : (
          /* Send Button - Disabled after API completes if no input */
          <button
            ref={sendButtonRef}
            className={getClassName('sendButton')}
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isSubmitting}
            aria-label="Ask question"
            type="button"
          >
            <ArrowUp size={18} />
          </button>
        )}

        {/* Delete/Clear Button - Show when there is chat history or content */}
        {hasContent && (
          <button
            ref={deleteButtonRef}
            className={getClassName('deleteButton')}
            onClick={() => {
              if (hasChatHistory && onClearChat) {
                onClearChat();
              } else {
                setInputValue('');
              }
            }}
            aria-label={hasChatHistory ? "Clear chat" : "Clear input"}
            type="button"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

TextExplanationView.displayName = 'TextExplanationView';
