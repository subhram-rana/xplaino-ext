// src/content/index.ts
// Chrome extension content script - Minimal orchestration layer

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createStore, Provider } from 'jotai';

// Import components
import { FAB } from './components/FAB';
import { SidePanel } from './components/SidePanel';
import { ContentActionsTrigger } from './components/ContentActions';
import { DisableNotificationModal } from './components/DisableNotificationModal';
import { LoginModal } from './components/LoginModal';
import { TextExplanationSidePanel } from './components/TextExplanationSidePanel';
import { TextExplanationIconContainer } from './components/TextExplanationIcon';

// Import Shadow DOM utilities
import {
  createShadowHost,
  injectStyles,
  removeShadowHost,
  shadowHostExists,
} from './utils/shadowDom';

// Import Shadow DOM styles as inline strings
import fabStyles from './styles/fab.shadow.css?inline';
import sidePanelStyles from './styles/sidePanel.shadow.css?inline';
import contentActionsStyles from './styles/contentActions.shadow.css?inline';
import disableNotificationModalStyles from './styles/disableNotificationModal.shadow.css?inline';
import loginModalStyles from './styles/loginModal.shadow.css?inline';
import textExplanationSidePanelStyles from './styles/textExplanationSidePanel.shadow.css?inline';
import textExplanationIconStyles from './styles/textExplanationIcon.shadow.css?inline';

// Import color CSS variables
import { FAB_COLOR_VARIABLES } from '../constants/colors.css.js';

// Import services and utilities
import { SummariseService } from '../api-services/SummariseService';
import { SimplifyService } from '../api-services/SimplifyService';
import { AskService } from '../api-services/AskService';
import { extractAndStorePageContent, getStoredPageContent } from './utils/pageContentExtractor';
import { addTextUnderline, removeTextUnderline, pulseTextBackground, type UnderlineState } from './utils/textSelectionUnderline';
import {
  summariseStateAtom,
  streamingTextAtom,
  summaryAtom,
  summaryErrorAtom,
  messageQuestionsAtom,
  pageReadingStateAtom,
} from '../store/summaryAtoms';
import { showLoginModalAtom } from '../store/uiAtoms';

console.log('[Content Script] Initialized');

// =============================================================================
// CONSTANTS
// =============================================================================

const FAB_HOST_ID = 'xplaino-fab-host';
const SIDE_PANEL_HOST_ID = 'xplaino-side-panel-host';
const CONTENT_ACTIONS_HOST_ID = 'xplaino-content-actions-host';
const DISABLE_MODAL_HOST_ID = 'xplaino-disable-modal-host';
const LOGIN_MODAL_HOST_ID = 'xplaino-login-modal-host';
const TEXT_EXPLANATION_PANEL_HOST_ID = 'xplaino-text-explanation-panel-host';
const TEXT_EXPLANATION_ICON_HOST_ID = 'xplaino-text-explanation-icon-host';

/**
 * Domain status enum (must match src/types/domain.ts)
 */
enum DomainStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  BANNED = 'BANNED',
  INVALID = 'INVALID',
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// React root references
let fabRoot: ReactDOM.Root | null = null;
let sidePanelRoot: ReactDOM.Root | null = null;
let contentActionsRoot: ReactDOM.Root | null = null;
let disableModalRoot: ReactDOM.Root | null = null;
let loginModalRoot: ReactDOM.Root | null = null;
let textExplanationPanelRoot: ReactDOM.Root | null = null;
let textExplanationIconRoot: ReactDOM.Root | null = null;

// Modal state
let modalVisible = false;

// Shared state for side panel
let sidePanelOpen = false;

// Jotai store for managing atoms outside React
const store = createStore();

// FAB loading state
let isSummarising = false;
let summariseAbortController: AbortController | null = null;
let firstChunkReceived = false;
let canHideFABActions = true;

// Text explanation state
interface TextExplanationState {
  id: string;
  selectedText: string;
  range: Range | null;
  iconPosition: { x: number; y: number };
  isSpinning: boolean;
  streamingText: string;
  underlineState: UnderlineState | null;
  abortController: AbortController | null;
  firstChunkReceived: boolean;
  iconRef: React.MutableRefObject<HTMLElement | null> | null;
  possibleQuestions: string[];
  textStartIndex: number;
  textLength: number;
  pendingQuestion?: string; // Track the question being asked for stop handler
  shouldAllowSimplifyMore: boolean; // Whether Simplify button should be shown
  previousSimplifiedTexts: string[]; // Array of previous simplified texts for context
  simplifiedExplanationCount: number; // Count of simplified explanations (1, 2, 3, etc.)
  isSimplifyRequest?: boolean; // Track if current request is a Simplify request (not Ask request)
}

let textExplanationState: TextExplanationState | null = null;
let textExplanationPanelOpen = false;
let textExplanationViewMode: 'contextual' | 'translation' = 'contextual';

// Chat history for text explanations (keyed by text explanation ID)
interface TextExplanationChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const textExplanationChatHistory: Map<string, TextExplanationChatMessage[]> = new Map();
const textExplanationMessageQuestions: Map<string, Record<number, string[]>> = new Map();

/**
 * Toggle side panel open/closed state
 */
function setSidePanelOpen(open: boolean, initialTab?: 'summary' | 'settings' | 'my'): void {
  sidePanelOpen = open;
  updateSidePanel(initialTab);
}

// =============================================================================
// DOMAIN UTILITIES
// =============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Check if extension is allowed to run on current page
 */
async function isExtensionAllowed(): Promise<boolean> {
  try {
    const currentDomain = extractDomain(window.location.href);
    
    if (!currentDomain) {
      console.log('[Content Script] Could not extract domain');
      return false;
    }

    // Get settings from chrome.storage.local
    const result = await chrome.storage.local.get('extension_settings');
    const settings = result.extension_settings || {
      globalDisabled: false,
      domainSettings: {},
    };

    // Check if globally disabled
    if (settings.globalDisabled) {
      console.log('[Content Script] Extension is globally disabled');
      return false;
    }

    // Check domain status
    const domainStatus = settings.domainSettings[currentDomain];
    
    if (domainStatus !== DomainStatus.ENABLED) {
      console.log(`[Content Script] Domain "${currentDomain}" is not ENABLED (status: ${domainStatus || 'not set'})`);
      return false;
    }

    console.log(`[Content Script] Extension allowed for domain: ${currentDomain}`);
    return true;
  } catch (error) {
    console.error('[Content Script] Error checking permissions:', error);
    return false;
  }
}

// =============================================================================
// FAB INJECTION
// =============================================================================

/**
 * Inject FAB into the page with Shadow DOM
 */
function injectFAB(): void {
  // Check if already injected
  if (shadowHostExists(FAB_HOST_ID)) {
    console.log('[Content Script] FAB already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: FAB_HOST_ID,
    zIndex: 2147483645,
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, fabStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  fabRoot = ReactDOM.createRoot(mountPoint);
  updateFAB();

  console.log('[Content Script] FAB injected successfully');
}

/**
 * Remove FAB from the page
 */
function removeFAB(): void {
  removeShadowHost(FAB_HOST_ID, fabRoot);
  fabRoot = null;
  console.log('[Content Script] FAB removed');
  removeSidePanel();
}

// =============================================================================
// SIDE PANEL INJECTION
// =============================================================================

/**
 * Handle summarise button click
 */
async function handleSummariseClick(): Promise<void> {
  console.log('[Content Script] Summarise clicked from FAB');
  
  // Check if summary already exists
  const existingSummary = store.get(summaryAtom);
  const hasSummary = !!existingSummary && existingSummary.trim().length > 0;
  
  // If summary exists, just open the side panel
  if (hasSummary) {
    console.log('[Content Script] Summary exists, opening side panel');
    setSidePanelOpen(true, 'summary');
    return;
  }
  
  // If already summarising, abort and reset
  if (isSummarising && summariseAbortController) {
    summariseAbortController.abort();
    summariseAbortController = null;
    isSummarising = false;
    firstChunkReceived = false;
    canHideFABActions = true;
    store.set(summariseStateAtom, 'idle');
    updateFAB();
    return;
  }

  // Set loading state
  isSummarising = true;
  firstChunkReceived = false;
  canHideFABActions = false; // Prevent hiding actions during loading
  store.set(summariseStateAtom, 'summarising');
  store.set(streamingTextAtom, '');
  store.set(summaryAtom, '');
  store.set(summaryErrorAtom, '');
  store.set(messageQuestionsAtom, {});
  updateFAB();

  try {
    // Extract page content if not already available
    let pageContent = await getStoredPageContent();
    if (!pageContent) {
      console.log('[Content Script] Extracting page content...');
      store.set(pageReadingStateAtom, 'reading');
      pageContent = await extractAndStorePageContent();
      if (!pageContent) {
        throw new Error('Could not extract page content');
      }
      store.set(pageReadingStateAtom, 'ready');
    }

    // Create abort controller
    summariseAbortController = new AbortController();

    // Call summarise API
    await SummariseService.summarise(
      {
        text: pageContent,
        context_type: 'PAGE',
      },
      {
        onChunk: (_chunk, accumulated) => {
          // Update streaming text first
          store.set(streamingTextAtom, accumulated);
          
          // On first chunk, open side panel with summary tab and allow FAB actions to hide
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            canHideFABActions = true; // Allow actions to hide after first event
            isSummarising = false; // Stop showing spinner, revert to icon
            console.log('[Content Script] First chunk received, opening side panel');
            setSidePanelOpen(true, 'summary');
            // Update FAB after setting streaming text so hasSummary will be true
            updateFAB(); // Update FAB to reflect changes (spinner -> icon, canHideActions, hasSummary)
          }
        },
        onComplete: (finalSummary, questions) => {
          console.log('[Content Script] Summarise complete');
          store.set(summaryAtom, finalSummary);
          store.set(streamingTextAtom, '');
          store.set(summariseStateAtom, 'done');
          
          // Store questions for summary (use -1 as key for summary)
          if (questions.length > 0) {
            const currentQuestions = store.get(messageQuestionsAtom);
            store.set(messageQuestionsAtom, {
              ...currentQuestions,
              [-1]: questions,
            });
          }
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
        onError: (errorCode, errorMsg) => {
          console.error('[Content Script] Summarise error:', errorCode, errorMsg);
          store.set(summariseStateAtom, 'error');
          store.set(summaryErrorAtom, errorMsg);
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for summarise');
          store.set(summariseStateAtom, 'idle');
          store.set(showLoginModalAtom, true);
          
          // Reset loading state
          isSummarising = false;
          summariseAbortController = null;
          firstChunkReceived = false;
          canHideFABActions = true;
          updateFAB();
        },
      },
      summariseAbortController
    );
  } catch (error) {
    console.error('[Content Script] Summarise exception:', error);
    store.set(summariseStateAtom, 'error');
    store.set(summaryErrorAtom, error instanceof Error ? error.message : 'An error occurred while summarising');
    
    // Reset loading state
    isSummarising = false;
    summariseAbortController = null;
    firstChunkReceived = false;
    canHideFABActions = true;
    updateFAB();
  }
}

/**
 * Update FAB state
 */
function updateFAB(): void {
  if (fabRoot) {
    // Check if summary exists (either in summaryAtom or streamingTextAtom)
    const summary = store.get(summaryAtom);
    const streamingText = store.get(streamingTextAtom);
    const hasSummary = (!!summary && summary.trim().length > 0) || (!!streamingText && streamingText.trim().length > 0);
    
    fabRoot.render(
      React.createElement(Provider, { store },
        React.createElement(FAB, {
          useShadowDom: true,
          onSummarise: handleSummariseClick,
          onTranslate: () => console.log('[FAB] Translate clicked'),
          onOptions: () => setSidePanelOpen(true),
          isSummarising: isSummarising,
          hasSummary: hasSummary,
          canHideActions: canHideFABActions,
          onShowModal: showDisableModal,
        })
      )
    );
  }
}

/**
 * Update side panel state
 */
function updateSidePanel(initialTab?: 'summary' | 'settings' | 'my'): void {
  if (sidePanelRoot) {
    sidePanelRoot.render(
      React.createElement(Provider, { store },
        React.createElement(SidePanel, {
          isOpen: sidePanelOpen,
          useShadowDom: true,
          onClose: () => setSidePanelOpen(false),
          initialTab: initialTab,
        })
      )
    );
  }
  // Also update FAB to reflect side panel state
  updateFAB();
}

/**
 * Inject Side Panel into the page with Shadow DOM
 */
function injectSidePanel(): void {
  // Check if already injected
  if (shadowHostExists(SIDE_PANEL_HOST_ID)) {
    updateSidePanel();
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: SIDE_PANEL_HOST_ID,
    zIndex: 2147483646,
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, sidePanelStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  sidePanelRoot = ReactDOM.createRoot(mountPoint);
  sidePanelRoot.render(
    React.createElement(Provider, { store },
      React.createElement(SidePanel, {
        isOpen: sidePanelOpen,
        useShadowDom: true,
        onClose: () => setSidePanelOpen(false),
        initialTab: 'summary',
      })
    )
  );

  console.log('[Content Script] Side Panel injected successfully');
}

/**
 * Remove Side Panel from the page
 */
function removeSidePanel(): void {
  removeShadowHost(SIDE_PANEL_HOST_ID, sidePanelRoot);
  sidePanelRoot = null;
  console.log('[Content Script] Side Panel removed');
}

// =============================================================================
// CONTENT ACTIONS INJECTION
// =============================================================================

/**
 * Inject Content Actions into the page with Shadow DOM
 */
function injectContentActions(): void {
  // Check if already injected
  if (shadowHostExists(CONTENT_ACTIONS_HOST_ID)) {
    console.log('[Content Script] Content Actions already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: CONTENT_ACTIONS_HOST_ID,
    zIndex: 2147483647, // Highest z-index for selection popup
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, contentActionsStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  contentActionsRoot = ReactDOM.createRoot(mountPoint);
  contentActionsRoot.render(
    React.createElement(ContentActionsTrigger, {
      useShadowDom: true,
      onExplain: handleExplainClick,
      onGrammar: (text: string) => console.log('[ContentActions] Grammar:', text),
      onTranslate: (text: string) => console.log('[ContentActions] Translate:', text),
      onBookmark: (text: string) => console.log('[ContentActions] Bookmark:', text),
      onShowModal: showDisableModal,
    })
  );

  console.log('[Content Script] Content Actions injected successfully');
}

/**
 * Remove Content Actions from the page
 */
function removeContentActions(): void {
  removeShadowHost(CONTENT_ACTIONS_HOST_ID, contentActionsRoot);
  contentActionsRoot = null;
  console.log('[Content Script] Content Actions removed');
}

// =============================================================================
// TEXT EXPLANATION HANDLING
// =============================================================================

/**
 * Calculate textStartIndex - the character position of the selection start within the document
 */
function calculateTextStartIndex(range: Range): number {
  const rangeClone = range.cloneRange();
  rangeClone.setStart(document.body, 0);
  return rangeClone.toString().length;
}

/**
 * Handle Explain button click from ContentActionsTrigger
 */
async function handleExplainClick(
  selectedText: string,
  range?: Range,
  iconPosition?: { x: number; y: number }
): Promise<void> {
  console.log('[Content Script] Explain clicked:', selectedText);
  
  if (!range || !iconPosition) {
    console.warn('[Content Script] Missing range or iconPosition for Explain');
    return;
  }

  // If there's an existing explanation, abort it
  if (textExplanationState?.abortController) {
    textExplanationState.abortController.abort();
  }

  // Calculate textStartIndex and textLength
  const textStartIndex = calculateTextStartIndex(range);
  const textLength = selectedText.length;

  // Create new explanation state
  const explanationId = `explanation-${Date.now()}`;
  const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
  
  textExplanationState = {
    id: explanationId,
    selectedText,
    range: range.cloneRange(), // Clone to avoid issues
    iconPosition,
    isSpinning: true,
    streamingText: '',
    underlineState: null,
    abortController: new AbortController(),
    firstChunkReceived: false,
    iconRef,
    possibleQuestions: [],
    textStartIndex,
    textLength,
    shouldAllowSimplifyMore: false,
    previousSimplifiedTexts: [],
    simplifiedExplanationCount: 0, // Will be set to 1 after first explanation completes
    isSimplifyRequest: true, // Initial explanation is a simplify request
  };

  // Reset view mode to contextual
  textExplanationViewMode = 'contextual';

  // Inject icon container and panel if not already injected
  injectTextExplanationIconContainer();
  injectTextExplanationPanel();

  // Update icon container to show spinner
  updateTextExplanationIconContainer();

  try {
    // Call v2/simplify API
    await SimplifyService.simplify(
      [
        {
          textStartIndex,
          textLength,
          text: selectedText,
          previousSimplifiedTexts: [],
        },
      ],
      {
        onChunk: (_chunk, accumulated) => {
          if (!textExplanationState) return;
          
          textExplanationState.streamingText = accumulated;
          
          // On first chunk: switch to green icon, add underline, open panel
          if (!textExplanationState.firstChunkReceived) {
            textExplanationState.firstChunkReceived = true;
            textExplanationState.isSpinning = false;
            
            // Add underline to selected text
            if (textExplanationState.range) {
              const underlineState = addTextUnderline(textExplanationState.range);
              textExplanationState.underlineState = underlineState;
            }
            
            // Open panel
            textExplanationPanelOpen = true;
            updateTextExplanationPanel();
            
            // Update icon container
            updateTextExplanationIconContainer();
          } else {
            // Update panel with new content
            updateTextExplanationPanel();
          }
        },
        onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
          console.log('[Content Script] Text explanation complete');
          if (!textExplanationState) return;
          
          // Add initial explanation to chat history if not already there
          const explanationId = textExplanationState.id;
          if (!textExplanationChatHistory.has(explanationId)) {
            textExplanationChatHistory.set(explanationId, []);
          }
          const chatHistory = textExplanationChatHistory.get(explanationId)!;
          
          // Only add if this is the first explanation (no messages yet)
          if (chatHistory.length === 0) {
            // Set count to 1 for the first explanation
            textExplanationState.simplifiedExplanationCount = 1;
            const explanationNumber = textExplanationState.simplifiedExplanationCount;
            
            // Create message with heading "Simplified explanation 1"
            const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${simplifiedText}`;
            chatHistory.push({ role: 'assistant', content: messageWithHeading });
            
            // Only add questions if they don't already exist for this message
            if (possibleQuestions && possibleQuestions.length > 0) {
              if (!textExplanationMessageQuestions.has(explanationId)) {
                textExplanationMessageQuestions.set(explanationId, {});
              }
              const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
              // Only set if not already set to prevent duplicates
              if (!messageQuestions[0]) {
                messageQuestions[0] = possibleQuestions; // First message (index 0)
                textExplanationMessageQuestions.set(explanationId, messageQuestions);
              }
            }
          }
          
          // Update state with simplify button visibility and previous simplified texts
          textExplanationState.shouldAllowSimplifyMore = shouldAllowSimplifyMore;
          // Add current simplified text to previousSimplifiedTexts array
          textExplanationState.previousSimplifiedTexts = [...textExplanationState.previousSimplifiedTexts, simplifiedText];
          
          // Clear streamingText after adding to chat history to prevent duplicate display
          textExplanationState.streamingText = '';
          textExplanationState.possibleQuestions = possibleQuestions || [];
          
          // Clear abort controller to indicate request is complete
          textExplanationState.abortController = null;
          textExplanationState.firstChunkReceived = false;
          textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
          
          updateTextExplanationPanel();
        },
        onError: (errorCode, errorMsg) => {
          console.error('[Content Script] Text explanation error:', errorCode, errorMsg);
          // Reset state on error
          if (textExplanationState) {
            textExplanationState.isSpinning = false;
            updateTextExplanationIconContainer();
          }
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for text explanation');
          store.set(showLoginModalAtom, true);
          if (textExplanationState) {
            textExplanationState.isSpinning = false;
            updateTextExplanationIconContainer();
          }
        },
      },
      textExplanationState.abortController || undefined
    );
  } catch (error) {
    console.error('[Content Script] Text explanation exception:', error);
    if (textExplanationState) {
      textExplanationState.isSpinning = false;
      updateTextExplanationIconContainer();
    }
  }
}

/**
 * Toggle text explanation panel open/closed
 */
function toggleTextExplanationPanel(): void {
  textExplanationPanelOpen = !textExplanationPanelOpen;
  updateTextExplanationPanel();
}

// Stable callback functions to prevent infinite re-renders
let handleQuestionClickCallback: ((question: string) => Promise<void>) | null = null;
let handleInputSubmitCallback: ((inputText: string) => Promise<void>) | null = null;
let handleViewModeChangeCallback: ((mode: 'contextual' | 'translation') => void) | null = null;
let handleCloseCallback: (() => void) | null = null;
let handleSimplifyCallback: (() => Promise<void>) | null = null;

// Guard to prevent infinite update loops
let isUpdatingPanel = false;
let pendingUpdate = false;

/**
 * Update text explanation panel state
 */
function updateTextExplanationPanel(): void {
  if (!textExplanationPanelRoot) return;
  
  // Prevent infinite loops
  if (isUpdatingPanel) {
    pendingUpdate = true;
    return;
  }
  
  isUpdatingPanel = true;
  pendingUpdate = false;
  
  const streamingText = textExplanationState?.streamingText || '';
  const possibleQuestions = textExplanationState?.possibleQuestions || [];
  const shouldAllowSimplifyMore = textExplanationState?.shouldAllowSimplifyMore || false;
  const pendingQuestion = textExplanationState?.pendingQuestion;
  const firstChunkReceived = textExplanationState?.firstChunkReceived || false;
  
  // Get chat history for current explanation
  const explanationId = textExplanationState?.id || '';
  const chatMessages = textExplanationChatHistory.get(explanationId) || [];
  const messageQuestions = textExplanationMessageQuestions.get(explanationId) || {};
  
  // Check if simplify is in progress (has abortController, no first chunk yet, and it's actually a Simplify request)
  const isSimplifying = textExplanationState ? 
    (!!textExplanationState.abortController && !textExplanationState.firstChunkReceived && shouldAllowSimplifyMore && textExplanationState.isSimplifyRequest === true) : false;
  
  // Check if content is empty (no chat messages, no streaming text) - hide header icons if empty
  const hasContent = chatMessages.length > 0 || streamingText.trim().length > 0;
  const showHeaderIcons = hasContent;
  
  // Create clear chat handler
  const handleClearChatCallback = () => {
    if (explanationId) {
      textExplanationChatHistory.delete(explanationId);
      textExplanationMessageQuestions.delete(explanationId);
      if (textExplanationState) {
        textExplanationState.streamingText = '';
        textExplanationState.possibleQuestions = [];
        // Clear abortController and pendingQuestion to prevent loading dots from showing
        if (textExplanationState.abortController) {
          textExplanationState.abortController.abort();
          textExplanationState.abortController = null;
        }
        textExplanationState.pendingQuestion = undefined;
        textExplanationState.firstChunkReceived = false;
        // Clear simplified explanation state so Simplify button starts fresh
        textExplanationState.previousSimplifiedTexts = [];
        textExplanationState.simplifiedExplanationCount = 0;
        // Reset shouldAllowSimplifyMore based on whether there's an initial explanation
        // If there's no initial explanation, we might want to keep it false
        // But if there is, we should allow simplifying again
        // For now, we'll keep the current value or set it based on whether there's content
        // Actually, if we cleared chat, we should allow simplifying the original text again
        textExplanationState.shouldAllowSimplifyMore = true;
      }
      updateTextExplanationPanel();
    }
  };

  // Create stop request handler
  const handleStopRequestCallback = () => {
    if (!textExplanationState) return;
    
    const explanationId = textExplanationState.id;
    const currentStreamingText = textExplanationState.streamingText;
    const pendingQuestion = textExplanationState.pendingQuestion;
    
    // Abort the current request
    if (textExplanationState.abortController) {
      textExplanationState.abortController.abort();
      textExplanationState.abortController = null;
    }
    
    // If we have received some streaming text, save it to chat history
    if (currentStreamingText && currentStreamingText.trim().length > 0 && textExplanationState.firstChunkReceived && pendingQuestion) {
      // Get current chat history
      if (!textExplanationChatHistory.has(explanationId)) {
        textExplanationChatHistory.set(explanationId, []);
      }
      const currentChatHistory = textExplanationChatHistory.get(explanationId)!;
      const updatedChatHistory = [...currentChatHistory];
      
      // Add the user message if not already present
      const lastMessage = updatedChatHistory[updatedChatHistory.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== pendingQuestion) {
        updatedChatHistory.push({ role: 'user', content: pendingQuestion });
      }
      
      // Add the partial assistant response
      updatedChatHistory.push({ role: 'assistant', content: currentStreamingText });
      
      textExplanationChatHistory.set(explanationId, updatedChatHistory);
    }
    
    // Clear streaming state
    textExplanationState.streamingText = '';
    textExplanationState.firstChunkReceived = false;
    textExplanationState.possibleQuestions = [];
    textExplanationState.pendingQuestion = undefined;
    textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
    
    updateTextExplanationPanel();
  };

  // Check if a request is in progress
  // Request is in progress if there's an abortController (regardless of firstChunkReceived)
  const isRequesting = textExplanationState ? 
    !!textExplanationState.abortController : false;
  
  // Create stable callbacks if they don't exist
  if (!handleCloseCallback) {
    handleCloseCallback = () => {
      textExplanationPanelOpen = false;
      updateTextExplanationPanel();
    };
  }
  
  if (!handleViewModeChangeCallback) {
    handleViewModeChangeCallback = (mode: 'contextual' | 'translation') => {
      textExplanationViewMode = mode;
      updateTextExplanationPanel();
    };
  }
  
  if (!handleQuestionClickCallback) {
    handleQuestionClickCallback = async (question: string) => {
      if (!textExplanationState) return;
      
      const explanationId = textExplanationState.id;
      const selectedText = textExplanationState.selectedText;
      
      // Get current chat history
      if (!textExplanationChatHistory.has(explanationId)) {
        textExplanationChatHistory.set(explanationId, []);
      }
      const currentChatHistory = textExplanationChatHistory.get(explanationId)!;
      
      // Add user message to chat history for API call
      const userMessage = { role: 'user' as const, content: question };
      const chatHistoryForAPI = [...currentChatHistory, userMessage];
      
      // Optimistically add user message to chat history for immediate display
      textExplanationChatHistory.set(explanationId, chatHistoryForAPI);
      
      // Abort current request if any
      if (textExplanationState.abortController) {
        textExplanationState.abortController.abort();
      }
      
      // Create new state for the question
      const newAbortController = new AbortController();
      textExplanationState.abortController = newAbortController;
      textExplanationState.streamingText = '';
      textExplanationState.firstChunkReceived = false;
      textExplanationState.possibleQuestions = []; // Clear previous questions to prevent duplicates
      textExplanationState.pendingQuestion = question; // Store the question for stop handler
      textExplanationState.isSimplifyRequest = false; // This is an Ask request, not Simplify
      
      // Update panel immediately to show user message and loading state
      updateTextExplanationPanel();
      
      try {
        await AskService.ask(
          {
            question: question.trim(),
            chat_history: chatHistoryForAPI,
            initial_context: selectedText,
            context_type: 'TEXT',
          },
          {
            onChunk: (_chunk, accumulated) => {
              if (!textExplanationState) return;
              textExplanationState.streamingText = accumulated;
              if (!textExplanationState.firstChunkReceived) {
                textExplanationState.firstChunkReceived = true;
              }
              updateTextExplanationPanel();
            },
            onComplete: (updatedChatHistory, questions) => {
              if (!textExplanationState) return;
              
              // Get current chat history (already has user message from line 878)
              const currentChatHistory = textExplanationChatHistory.get(explanationId) || [];
              
              // Extract only the assistant message from updatedChatHistory
              // updatedChatHistory structure: [...previousMessages, userMessage, assistantMessage]
              // We already have: [...previousMessages, userMessage] in currentChatHistory
              // So we just need the last message (assistant message) from updatedChatHistory
              const assistantMessage = updatedChatHistory[updatedChatHistory.length - 1];
              
              // Verify it's an assistant message
              if (assistantMessage && assistantMessage.role === 'assistant') {
                // Append only the assistant message to existing chat history
                const updatedHistory = [...currentChatHistory, assistantMessage];
                textExplanationChatHistory.set(explanationId, updatedHistory);
                
                // Store questions for the last assistant message (new message index)
                if (questions && questions.length > 0) {
                  if (!textExplanationMessageQuestions.has(explanationId)) {
                    textExplanationMessageQuestions.set(explanationId, {});
                  }
                  const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
                  // The assistant message is at the last index of updatedHistory
                  const assistantMessageIndex = updatedHistory.length - 1;
                  messageQuestions[assistantMessageIndex] = questions;
                  textExplanationMessageQuestions.set(explanationId, messageQuestions);
                }
              } else {
                // Fallback: if structure is unexpected, use updatedChatHistory but deduplicate
                // Remove duplicate user messages matching pendingQuestion
                const pendingQuestion = textExplanationState.pendingQuestion;
                const deduplicated = updatedChatHistory.filter((msg, idx) => {
                  if (msg.role === 'user' && pendingQuestion && msg.content === pendingQuestion) {
                    // Keep only the first occurrence
                    return updatedChatHistory.findIndex(m => m.role === 'user' && m.content === pendingQuestion) === idx;
                  }
                  return true;
                });
                textExplanationChatHistory.set(explanationId, deduplicated);
                
                // Store questions for the last assistant message
                if (questions && questions.length > 0) {
                  if (!textExplanationMessageQuestions.has(explanationId)) {
                    textExplanationMessageQuestions.set(explanationId, {});
                  }
                  const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
                  const assistantMessageIndex = deduplicated.findIndex(
                    (msg, idx) => msg.role === 'assistant' && idx === deduplicated.length - 1
                  );
                  if (assistantMessageIndex >= 0) {
                    messageQuestions[assistantMessageIndex] = questions;
                    textExplanationMessageQuestions.set(explanationId, messageQuestions);
                  }
                }
              }
              
              // Clear streamingText since response is complete and in chat history
              textExplanationState.streamingText = '';
              textExplanationState.possibleQuestions = questions || [];
              textExplanationState.pendingQuestion = undefined; // Clear pending question
              
              // Clear abort controller to indicate request is complete
              textExplanationState.abortController = null;
              textExplanationState.firstChunkReceived = false;
              textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
              
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Question error:', errorCode, errorMsg);
              // Clear abort controller on error as well
              if (textExplanationState) {
                textExplanationState.abortController = null;
                textExplanationState.firstChunkReceived = false;
                textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
              }
            },
            onLoginRequired: () => {
              store.set(showLoginModalAtom, true);
            },
          },
          newAbortController
        );
      } catch (error) {
        console.error('[Content Script] Question exception:', error);
      }
    };
  }
  
  if (!handleSimplifyCallback) {
    handleSimplifyCallback = async () => {
      if (!textExplanationState) return;
      
      const explanationId = textExplanationState.id;
      const selectedText = textExplanationState.selectedText;
      const previousSimplifiedTexts = textExplanationState.previousSimplifiedTexts || [];
      
      // Abort current request if any
      if (textExplanationState.abortController) {
        textExplanationState.abortController.abort();
      }
      
      // Create new state for the simplify request
      const newAbortController = new AbortController();
      textExplanationState.abortController = newAbortController;
      textExplanationState.streamingText = '';
      textExplanationState.firstChunkReceived = false;
      textExplanationState.possibleQuestions = [];
      textExplanationState.isSimplifyRequest = true; // This is a Simplify request
      
      // Update panel to show loading state
      updateTextExplanationPanel();
      
      try {
        await SimplifyService.simplify(
          [
            {
              textStartIndex: textExplanationState.textStartIndex,
              textLength: textExplanationState.textLength,
              text: selectedText,
              previousSimplifiedTexts: previousSimplifiedTexts,
            },
          ],
          {
            onChunk: (_chunk, accumulated) => {
              if (!textExplanationState) return;
              textExplanationState.streamingText = accumulated;
              if (!textExplanationState.firstChunkReceived) {
                textExplanationState.firstChunkReceived = true;
              }
              updateTextExplanationPanel();
            },
            onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
              if (!textExplanationState) return;
              
              // Get current chat history
              if (!textExplanationChatHistory.has(explanationId)) {
                textExplanationChatHistory.set(explanationId, []);
              }
              const chatHistory = textExplanationChatHistory.get(explanationId)!;
              
              // Increment simplified explanation count
              textExplanationState.simplifiedExplanationCount += 1;
              const explanationNumber = textExplanationState.simplifiedExplanationCount;
              
              // Create message with heading "Simplified explanation N"
              const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${simplifiedText}`;
              
              // Add new simplified explanation as a new message (don't replace previous ones)
              chatHistory.push({ role: 'assistant', content: messageWithHeading });
              
              // Update state
              textExplanationState.shouldAllowSimplifyMore = shouldAllowSimplifyMore;
              textExplanationState.previousSimplifiedTexts = [...previousSimplifiedTexts, simplifiedText];
              textExplanationState.streamingText = '';
              textExplanationState.possibleQuestions = possibleQuestions || [];
              textExplanationState.abortController = null;
              textExplanationState.firstChunkReceived = false;
              textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
              
              // Update questions for this new message if provided
              if (possibleQuestions && possibleQuestions.length > 0) {
                if (!textExplanationMessageQuestions.has(explanationId)) {
                  textExplanationMessageQuestions.set(explanationId, {});
                }
                const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
                // Use the index of the new message (last message in array)
                const messageIndex = chatHistory.length - 1;
                messageQuestions[messageIndex] = possibleQuestions;
                textExplanationMessageQuestions.set(explanationId, messageQuestions);
              }
              
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Simplify error:', errorCode, errorMsg);
            },
            onLoginRequired: () => {
              store.set(showLoginModalAtom, true);
            },
          },
          newAbortController
        );
      } catch (error) {
        console.error('[Content Script] Simplify exception:', error);
      }
    };
  }
  
  if (!handleInputSubmitCallback) {
    handleInputSubmitCallback = async (inputText: string) => {
      if (!textExplanationState || !inputText.trim()) return;
      
      const explanationId = textExplanationState.id;
      const selectedText = textExplanationState.selectedText;
      
      // Get current chat history
      if (!textExplanationChatHistory.has(explanationId)) {
        textExplanationChatHistory.set(explanationId, []);
      }
      const currentChatHistory = textExplanationChatHistory.get(explanationId)!;
      
      // Add user message to chat history for API call
      const userMessage = { role: 'user' as const, content: inputText.trim() };
      const chatHistoryForAPI = [...currentChatHistory, userMessage];
      
      // Optimistically add user message to chat history for immediate display
      textExplanationChatHistory.set(explanationId, chatHistoryForAPI);
      
      // Abort current request if any
      if (textExplanationState.abortController) {
        textExplanationState.abortController.abort();
      }
      
      // Create new state for the input
      const newAbortController = new AbortController();
      textExplanationState.abortController = newAbortController;
      textExplanationState.streamingText = '';
      textExplanationState.firstChunkReceived = false;
      textExplanationState.possibleQuestions = [];
      textExplanationState.isSimplifyRequest = false; // This is an Ask request, not Simplify
      
      // Update panel immediately to show user message
      updateTextExplanationPanel();
      
      try {
        await AskService.ask(
          {
            question: inputText.trim(),
            chat_history: chatHistoryForAPI,
            initial_context: selectedText,
            context_type: 'TEXT',
          },
          {
            onChunk: (_chunk, accumulated) => {
              if (!textExplanationState) return;
              textExplanationState.streamingText = accumulated;
              if (!textExplanationState.firstChunkReceived) {
                textExplanationState.firstChunkReceived = true;
              }
              updateTextExplanationPanel();
            },
            onComplete: (updatedChatHistory, questions) => {
              if (!textExplanationState) return;
              
              // Get current chat history (already has user message from line 1073)
              const currentChatHistory = textExplanationChatHistory.get(explanationId) || [];
              
              // Extract only the assistant message from updatedChatHistory
              // updatedChatHistory structure: [...previousMessages, userMessage, assistantMessage]
              // We already have: [...previousMessages, userMessage] in currentChatHistory
              // So we just need the last message (assistant message) from updatedChatHistory
              const assistantMessage = updatedChatHistory[updatedChatHistory.length - 1];
              
              // Verify it's an assistant message
              if (assistantMessage && assistantMessage.role === 'assistant') {
                // Append only the assistant message to existing chat history
                const updatedHistory = [...currentChatHistory, assistantMessage];
                textExplanationChatHistory.set(explanationId, updatedHistory);
                
                // Store questions for the last assistant message (new message index)
                if (questions && questions.length > 0) {
                  if (!textExplanationMessageQuestions.has(explanationId)) {
                    textExplanationMessageQuestions.set(explanationId, {});
                  }
                  const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
                  // The assistant message is at the last index of updatedHistory
                  const assistantMessageIndex = updatedHistory.length - 1;
                  // Only set if not already set to prevent duplicates
                  if (!messageQuestions[assistantMessageIndex]) {
                    messageQuestions[assistantMessageIndex] = questions;
                    textExplanationMessageQuestions.set(explanationId, messageQuestions);
                  }
                }
              } else {
                // Fallback: if structure is unexpected, use updatedChatHistory but deduplicate
                // Remove duplicate user messages matching the last user message in currentChatHistory
                const lastUserMessage = currentChatHistory.filter(m => m.role === 'user').pop();
                const deduplicated = updatedChatHistory.filter((msg, idx) => {
                  if (msg.role === 'user' && lastUserMessage && msg.content === lastUserMessage.content) {
                    // Keep only the first occurrence
                    return updatedChatHistory.findIndex(m => m.role === 'user' && m.content === lastUserMessage.content) === idx;
                  }
                  return true;
                });
                textExplanationChatHistory.set(explanationId, deduplicated);
                
                // Store questions for the last assistant message
                const assistantMessageIndex = deduplicated.findIndex(
                  (msg, idx) => msg.role === 'assistant' && idx === deduplicated.length - 1
                );
                if (assistantMessageIndex >= 0 && questions && questions.length > 0) {
                  if (!textExplanationMessageQuestions.has(explanationId)) {
                    textExplanationMessageQuestions.set(explanationId, {});
                  }
                  const messageQuestions = textExplanationMessageQuestions.get(explanationId)!;
                  // Only set if not already set to prevent duplicates
                  if (!messageQuestions[assistantMessageIndex]) {
                    messageQuestions[assistantMessageIndex] = questions;
                    textExplanationMessageQuestions.set(explanationId, messageQuestions);
                  }
                }
              }
              
              // Clear streamingText since response is complete and in chat history
              textExplanationState.streamingText = '';
              textExplanationState.possibleQuestions = questions || [];
              textExplanationState.pendingQuestion = undefined; // Clear pending question
              
              // Clear abort controller to indicate request is complete
              textExplanationState.abortController = null;
              textExplanationState.firstChunkReceived = false;
              textExplanationState.isSimplifyRequest = undefined; // Clear simplify request flag
              
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Input error:', errorCode, errorMsg);
            },
            onLoginRequired: () => {
              store.set(showLoginModalAtom, true);
            },
          },
          newAbortController
        );
      } catch (error) {
        console.error('[Content Script] Input exception:', error);
      }
    };
  }
  
  // Create handlers for header actions
  const handleRemoveCallback = () => {
    removeTextExplanation();
  };

  const handleViewOriginalCallback = () => {
    if (!textExplanationState) {
      console.log('[Content Script] No text explanation state available for view original');
      return;
    }
    scrollToAndHighlightText(textExplanationState.range, textExplanationState.underlineState);
    // Pulse the background color three times with green
    if (textExplanationState.underlineState) {
      pulseTextBackground(textExplanationState.underlineState);
    }
  };

  const handleBookmarkCallback = () => {
    // TODO: Implement bookmark functionality
    console.log('[Content Script] Bookmark clicked');
  };

  try {
    textExplanationPanelRoot.render(
      React.createElement(Provider, { store },
      React.createElement(TextExplanationSidePanel, {
        isOpen: textExplanationPanelOpen,
        useShadowDom: true,
        onClose: handleCloseCallback,
        streamingText,
        viewMode: textExplanationViewMode,
        possibleQuestions,
        onViewModeChange: handleViewModeChangeCallback,
        onQuestionClick: handleQuestionClickCallback,
        onInputSubmit: handleInputSubmitCallback,
        onRemove: handleRemoveCallback,
        onViewOriginal: handleViewOriginalCallback,
        onBookmark: handleBookmarkCallback,
        chatMessages,
        messageQuestions,
        onClearChat: handleClearChatCallback,
        onStopRequest: handleStopRequestCallback,
        isRequesting,
        shouldAllowSimplifyMore,
        onSimplify: handleSimplifyCallback,
        isSimplifying,
        showHeaderIcons,
        pendingQuestion,
        firstChunkReceived,
      })
      )
    );
  } finally {
    isUpdatingPanel = false;
    // If there was a pending update, process it now
    if (pendingUpdate) {
      // Use setTimeout to break the call stack
      setTimeout(() => {
        updateTextExplanationPanel();
      }, 0);
    }
  }
}

/**
 * Inject Text Explanation Panel into the page with Shadow DOM
 */
function injectTextExplanationPanel(): void {
  if (shadowHostExists(TEXT_EXPLANATION_PANEL_HOST_ID)) {
    updateTextExplanationPanel();
    return;
  }

  const { host, shadow, mountPoint } = createShadowHost({
    id: TEXT_EXPLANATION_PANEL_HOST_ID,
    zIndex: 2147483645, // Below main side panel
  });

  // Inject component styles first (they define variables after all:initial)
  injectStyles(shadow, textExplanationSidePanelStyles);
  // Then inject color variables to override/ensure they're set
  injectStyles(shadow, FAB_COLOR_VARIABLES);

  document.body.appendChild(host);

  textExplanationPanelRoot = ReactDOM.createRoot(mountPoint);
  updateTextExplanationPanel();

  console.log('[Content Script] Text Explanation Panel injected successfully');
}

/**
 * Remove Text Explanation Panel from the page
 */
function removeTextExplanationPanel(): void {
  removeShadowHost(TEXT_EXPLANATION_PANEL_HOST_ID, textExplanationPanelRoot);
  textExplanationPanelRoot = null;
  console.log('[Content Script] Text Explanation Panel removed');
}

/**
 * Update text explanation icon container
 */
function updateTextExplanationIconContainer(): void {
  if (!textExplanationIconRoot || !textExplanationState) return;
  
  const icons = [{
    id: textExplanationState.id,
    position: textExplanationState.iconPosition,
    selectionRange: textExplanationState.range,
    isSpinning: textExplanationState.isSpinning,
    onTogglePanel: toggleTextExplanationPanel,
    isPanelOpen: textExplanationPanelOpen,
    iconRef: (element: HTMLElement | null) => {
      if (textExplanationState && textExplanationState.iconRef) {
        textExplanationState.iconRef.current = element;
      }
    },
  }];
  
  textExplanationIconRoot.render(
    React.createElement(TextExplanationIconContainer, {
      icons,
      useShadowDom: true,
    })
  );
}

/**
 * Inject Text Explanation Icon Container into the page with Shadow DOM
 */
function injectTextExplanationIconContainer(): void {
  if (shadowHostExists(TEXT_EXPLANATION_ICON_HOST_ID)) {
    updateTextExplanationIconContainer();
    return;
  }

  const { host, shadow, mountPoint } = createShadowHost({
    id: TEXT_EXPLANATION_ICON_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  injectStyles(shadow, FAB_COLOR_VARIABLES);
  injectStyles(shadow, textExplanationIconStyles);

  document.body.appendChild(host);

  textExplanationIconRoot = ReactDOM.createRoot(mountPoint);
  updateTextExplanationIconContainer();

  console.log('[Content Script] Text Explanation Icon Container injected successfully');
}

/**
 * Remove Text Explanation Icon Container from the page
 */
function removeTextExplanationIconContainer(): void {
  removeShadowHost(TEXT_EXPLANATION_ICON_HOST_ID, textExplanationIconRoot);
  textExplanationIconRoot = null;
  console.log('[Content Script] Text Explanation Icon Container removed');
}

/**
 * Remove text explanation completely (icon, underline, and close panel)
 */
function removeTextExplanation(): void {
  if (!textExplanationState) {
    console.log('[Content Script] No text explanation state to remove');
    return;
  }

  // Remove underline from text
  if (textExplanationState.underlineState) {
    removeTextUnderline(textExplanationState.underlineState);
    textExplanationState.underlineState = null;
  }

  // Remove icon container
  removeTextExplanationIconContainer();

  // Close panel
  textExplanationPanelOpen = false;
  removeTextExplanationPanel();

  // Clear state
  textExplanationState = null;

  console.log('[Content Script] Text explanation removed completely');
}

/**
 * Scroll to selected text and pulse highlight 3 times
 */
function scrollToAndHighlightText(range: Range | null, underlineState?: UnderlineState | null): void {
  let element: HTMLElement | null = null;

  // First, try to use the underlineState wrapperElement if available (most reliable)
  if (underlineState?.wrapperElement) {
    const wrapper = underlineState.wrapperElement;
    // Check if wrapper is still in the document
    if (document.contains(wrapper)) {
      element = wrapper;
    }
  }

  // Fallback to using the range if wrapperElement is not available
  if (!element && range) {
    try {
      // Check if range nodes are still in the document
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      
      if (!document.contains(startContainer) || !document.contains(endContainer)) {
        console.log('[Content Script] Range nodes are no longer in the document');
        return;
      }

      if (range.collapsed) {
        console.log('[Content Script] Range is collapsed');
        return;
      }

      // Get the common ancestor container
      const container = range.commonAncestorContainer;

      // If container is a text node, get its parent
      if (container.nodeType === Node.TEXT_NODE) {
        element = container.parentElement;
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        element = container as HTMLElement;
      }
    } catch (error) {
      console.error('[Content Script] Error accessing range:', error);
      return;
    }
  }

  if (!element) {
    console.log('[Content Script] Could not find element from range or underlineState');
    return;
  }

  try {

    // Scroll to element
    try {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
    } catch (error) {
      console.error('[Content Script] Error scrolling to element:', error);
      // Fallback: manual scroll
      const rect = element.getBoundingClientRect();
      const scrollY = window.scrollY + rect.top - window.innerHeight / 2;
      window.scrollTo({ top: scrollY, behavior: 'smooth' });
    }

    // Store original styles
    const originalBackgroundColor = element.style.backgroundColor;
    const originalBorderRadius = element.style.borderRadius;
    const originalTransition = element.style.transition;

    // Apply initial highlight
    element.style.backgroundColor = 'rgba(144, 238, 144, 0.3)';
    element.style.borderRadius = '4px';
    element.style.transition = 'background-color 0.3s ease';

    // Pulse 3 times
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      pulseCount++;
      
      if (pulseCount % 2 === 0) {
        // Even pulse: highlight
        element!.style.backgroundColor = 'rgba(144, 238, 144, 0.5)';
      } else {
        // Odd pulse: less highlight
        element!.style.backgroundColor = 'rgba(144, 238, 144, 0.3)';
      }

      if (pulseCount >= 6) {
        // After 3 full pulses (6 toggles), remove highlight
        clearInterval(pulseInterval);
        element!.style.backgroundColor = originalBackgroundColor;
        element!.style.borderRadius = originalBorderRadius;
        element!.style.transition = originalTransition;
      }
    }, 500); // 500ms per pulse

  } catch (error) {
    console.error('[Content Script] Error in scrollToAndHighlightText:', error);
  }
}

// =============================================================================
// DISABLE NOTIFICATION MODAL INJECTION
// =============================================================================

/**
 * Inject Disable Notification Modal into the page with Shadow DOM
 */
function injectDisableModal(): void {
  // Check if already injected
  if (shadowHostExists(DISABLE_MODAL_HOST_ID)) {
    console.log('[Content Script] Disable Modal already injected');
    updateDisableModal();
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: DISABLE_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, disableNotificationModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  disableModalRoot = ReactDOM.createRoot(mountPoint);
  updateDisableModal();

  console.log('[Content Script] Disable Modal injected successfully');
}

/**
 * Update modal visibility based on state
 */
async function updateDisableModal(): Promise<void> {
  if (!disableModalRoot) return;

  // Check if modal should be shown (not dismissed)
  const { ChromeStorage } = await import('../storage/chrome-local/ChromeStorage');
  const dismissed = await ChromeStorage.getDisableModalDismissed();

  disableModalRoot.render(
    React.createElement(DisableNotificationModal, {
      visible: modalVisible && !dismissed,
      onUnderstood: handleModalUnderstood,
      onDontShowAgain: handleModalDontShowAgain,
    })
  );
}

/**
 * Show the disable notification modal
 */
export function showDisableModal(): void {
  modalVisible = true;
  injectDisableModal();
}

/**
 * Hide the disable notification modal
 */
function hideDisableModal(): void {
  modalVisible = false;
  updateDisableModal();
}

/**
 * Handle "I understood" button click
 */
function handleModalUnderstood(): void {
  hideDisableModal();
}

/**
 * Handle "Don't show me again" button click
 */
async function handleModalDontShowAgain(): Promise<void> {
  const { ChromeStorage } = await import('../storage/chrome-local/ChromeStorage');
  await ChromeStorage.setDisableModalDismissed(true);
  hideDisableModal();
}

// =============================================================================
// LOGIN MODAL INJECTION
// =============================================================================

/**
 * Inject Login Modal into the page with Shadow DOM
 */
function injectLoginModal(): void {
  // Check if already injected
  if (shadowHostExists(LOGIN_MODAL_HOST_ID)) {
    console.log('[Content Script] Login Modal already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: LOGIN_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index for modal
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, loginModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  loginModalRoot = ReactDOM.createRoot(mountPoint);
  loginModalRoot.render(
    React.createElement(Provider, { store },
      React.createElement(LoginModal, {
        useShadowDom: true,
      })
    )
  );

  console.log('[Content Script] Login Modal injected successfully');
}

/**
 * Remove Login Modal from the page
 */
function removeLoginModal(): void {
  removeShadowHost(LOGIN_MODAL_HOST_ID, loginModalRoot);
  loginModalRoot = null;
  console.log('[Content Script] Login Modal removed');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main content script logic
 */
async function initContentScript(): Promise<void> {
  const allowed = await isExtensionAllowed();
  
  if (allowed) {
    console.log('[Content Script] Running content script functionality...');
    injectFAB();
    injectSidePanel();
    injectContentActions();
    injectLoginModal();
  } else {
    console.log('[Content Script] Not running - extension not allowed on this page');
    removeFAB();
    removeSidePanel();
    removeContentActions();
    removeLoginModal();
    removeTextExplanationPanel();
    removeTextExplanationIconContainer();
  }
}

/**
 * Listen for storage changes to dynamically enable/disable
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.extension_settings) {
    console.log('[Content Script] Settings changed, re-checking permissions...');
    initContentScript();
  }
  
  // Listen for login modal trigger
  if (areaName === 'local' && changes.xplaino_show_login_modal) {
    if (changes.xplaino_show_login_modal.newValue === true) {
      console.log('[Content Script] Login modal triggered via storage');
      store.set(showLoginModalAtom, true);
      // Clear the flag
      chrome.storage.local.remove('xplaino_show_login_modal');
    }
  }
});

// Listen for custom login required event
window.addEventListener('xplaino:login-required', () => {
  console.log('[Content Script] Login required event received');
  store.set(showLoginModalAtom, true);
});

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

export {};
