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
import { SubscriptionModal } from './components/SubscriptionModal/SubscriptionModal';
import { TextExplanationSidePanel } from './components/TextExplanationSidePanel';
import { TextExplanationIconContainer } from './components/TextExplanationIcon';
import { WordExplanationPopover, type TabType } from './components/WordExplanationPopover';
import { WordAskAISidePanel } from './components/WordAskAISidePanel';
import { FolderListModal } from './components/FolderListModal';
import { SavedParagraphIcon } from './components/SavedParagraphIcon';

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
import subscriptionModalStyles from './styles/subscriptionModal.shadow.css?inline';
import textExplanationSidePanelStyles from './styles/textExplanationSidePanel.shadow.css?inline';
import textExplanationIconStyles from './styles/textExplanationIcon.shadow.css?inline';
import wordExplanationPopoverStyles from './styles/wordExplanationPopover.shadow.css?inline';
import wordAskAISidePanelStyles from './styles/wordAskAISidePanel.shadow.css?inline';
import folderListModalStyles from './styles/folderListModal.shadow.css?inline';
import savedParagraphIconStyles from './styles/savedParagraphIcon.shadow.css?inline';

// Import color CSS variables
import { FAB_COLOR_VARIABLES } from '../constants/colors.css.js';

// Import services and utilities
import { SummariseService } from '../api-services/SummariseService';
import { SimplifyService } from '../api-services/SimplifyService';
import { TranslateService, getLanguageCode, TranslateTextItem } from '../api-services/TranslateService';
import { AskService } from '../api-services/AskService';
import { ApiErrorHandler } from '../api-services/ApiErrorHandler';
import { WordsExplanationV2Service, type WordInfo } from '../api-services/WordsExplanationV2Service';
import { MoreExamplesService } from '../api-services/MoreExamplesService';
import { WordSynonymsService } from '../api-services/WordSynonymsService';
import { WordAntonymsService } from '../api-services/WordAntonymsService';
import { WordAskService } from '../api-services/WordAskService';
import { SavedWordsService } from '../api-services/SavedWordsService';
import { FolderService } from '../api-services/FolderService';
import { SavedParagraphService } from '../api-services/SavedParagraphService';
import type { FolderWithSubFoldersResponse } from '../api-services/dto/FolderDTO';
import { extractAndStorePageContent, getStoredPageContent } from './utils/pageContentExtractor';
import { addTextUnderline, removeTextUnderline, pulseTextBackground, changeUnderlineColor, type UnderlineState } from './utils/textSelectionUnderline';
import { PageTranslationManager } from './utils/pageTranslationManager';
import {
  summariseStateAtom,
  streamingTextAtom,
  summaryAtom,
  summaryErrorAtom,
  messageQuestionsAtom,
  pageReadingStateAtom,
} from '../store/summaryAtoms';
import { showLoginModalAtom, showSubscriptionModalAtom, userAuthInfoAtom } from '../store/uiAtoms';
import {
  textExplanationsAtom,
  activeTextExplanationIdAtom,
  textExplanationPanelOpenAtom,
  activeTextExplanationAtom,
  type TextExplanationState,
} from '../store/textExplanationAtoms';
import {
  wordExplanationsAtom,
  activeWordIdAtom,
  wordAskAISidePanelOpenAtom,
  wordAskAISidePanelWordIdAtom,
  type WordExplanationState as WordExplanationAtomState,
  type ChatMessage,
} from '../store/wordExplanationAtoms';
import { ChromeStorage } from '../storage/chrome-local/ChromeStorage';

console.log('[Content Script] Initialized');

// =============================================================================
// CONSTANTS
// =============================================================================

const FAB_HOST_ID = 'xplaino-fab-host';
const SIDE_PANEL_HOST_ID = 'xplaino-side-panel-host';
const CONTENT_ACTIONS_HOST_ID = 'xplaino-content-actions-host';
const DISABLE_MODAL_HOST_ID = 'xplaino-disable-modal-host';
const LOGIN_MODAL_HOST_ID = 'xplaino-login-modal-host';
const SUBSCRIPTION_MODAL_HOST_ID = 'xplaino-subscription-modal-host';
const TEXT_EXPLANATION_PANEL_HOST_ID = 'xplaino-text-explanation-panel-host';
const TEXT_EXPLANATION_ICON_HOST_ID = 'xplaino-text-explanation-icon-host';
const WORD_EXPLANATION_POPOVER_HOST_ID = 'xplaino-word-explanation-popover-host';
const WORD_ASK_AI_PANEL_HOST_ID = 'xplaino-word-ask-ai-panel-host';
const TOAST_HOST_ID = 'xplaino-toast-host';
const FOLDER_LIST_MODAL_HOST_ID = 'xplaino-folder-list-modal-host';

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
let subscriptionModalRoot: ReactDOM.Root | null = null;
let textExplanationPanelRoot: ReactDOM.Root | null = null;
let textExplanationIconRoot: ReactDOM.Root | null = null;
let wordExplanationPopoverRoot: ReactDOM.Root | null = null;
let wordAskAISidePanelRoot: ReactDOM.Root | null = null;
let wordAskAICloseHandler: (() => void) | null = null;
let toastRoot: ReactDOM.Root | null = null;

// Modal state
let modalVisible = false;

// Shared state for side panel
let sidePanelOpen = false;

// Toast state
let toastMessage: string | null = null;
let toastType: 'success' | 'error' = 'success';
let toastClosing: boolean = false;
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Folder List Modal state
let folderListModalRoot: ReactDOM.Root | null = null;
let folderModalOpen = false;
let folderModalFolders: FolderWithSubFoldersResponse[] = [];
let folderModalText = '';
let folderModalSourceUrl = '';
let folderModalSaving = false;
let folderModalCreatingFolder = false;
let folderModalSelectedFolderId: string | null = null;
let folderModalExpandedFolders: Set<string> = new Set();
let folderModalRange: Range | null = null; // Store the selection range for bookmark
let folderModalRememberChecked: boolean = false; // Track remember folder checkbox state

// Saved Paragraph Icons state
let savedParagraphIconRoot: ReactDOM.Root | null = null;
const SAVED_PARAGRAPH_ICON_HOST_ID = 'xplaino-saved-paragraph-icon-host';
interface SavedParagraphState {
  id: string;
  paragraphId: string;
  selectedText: string;
  range: Range | null;
  iconPosition: { x: number; y: number };
  underlineState: UnderlineState | null;
  iconRef: React.MutableRefObject<HTMLElement | null>;
}
const savedParagraphs = new Map<string, SavedParagraphState>();

// Jotai store for managing atoms outside React
const store = createStore();

// FAB loading state
let isSummarising = false;
let summariseAbortController: AbortController | null = null;
let firstChunkReceived = false;
let canHideFABActions = true;

// Text explanation view mode (not stored in atoms as it's UI state)
let textExplanationViewMode: 'contextual' | 'translation' = 'contextual';
let isTranslating = false;

// Page translation state
let pageTranslationManager: import('./utils/pageTranslationManager').PageTranslationManager | null = null;
let pageTranslationState: 'idle' | 'translating' | 'partially-translated' | 'fully-translated' = 'idle';
let pageViewMode: 'original' | 'translated' = 'translated';
let translationStatePollingInterval: number | null = null;

// Chat history for text explanations (keyed by text explanation ID)
interface TextExplanationChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const textExplanationChatHistory: Map<string, TextExplanationChatMessage[]> = new Map();
const textExplanationMessageQuestions: Map<string, Record<number, string[]>> = new Map();

// Word explanation state management
interface WordExplanationLocalState {
  word: string;
  wordSpanElement: HTMLElement | null;
  spinnerElement: HTMLElement | null;
  popoverVisible: boolean;
  streamedContent: string;
  activeTab: TabType;
  abortController: AbortController | null;
  firstEventReceived: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  range: Range | null;
  sourceRef: React.MutableRefObject<HTMLElement | null>;
}

const wordExplanationsMap = new Map<string, WordExplanationLocalState>();

/**
 * Initialize authentication state from Chrome storage
 * Loads auth info and sets the userAuthInfoAtom
 */
async function initializeAuthState(): Promise<void> {
  try {
    console.log('[Content Script] Initializing auth state...');
    
    // Register global LOGIN_REQUIRED error handler
    ApiErrorHandler.registerLoginRequiredHandler(() => {
      console.log('[Content Script] LOGIN_REQUIRED handler triggered, showing login modal');
      store.set(showLoginModalAtom, true);
    });
    console.log('[Content Script] Registered LOGIN_REQUIRED error handler');
    ApiErrorHandler.registerSubscriptionRequiredHandler(() => {
      console.log('[Content Script] SUBSCRIPTION_REQUIRED handler triggered, showing subscription modal');
      store.set(showSubscriptionModalAtom, true);
    });
    console.log('[Content Script] Registered SUBSCRIPTION_REQUIRED error handler');
    
    const authInfo = await ChromeStorage.getAuthInfo();
    
    if (authInfo) {
      console.log('[Content Script] Auth info loaded from storage:', {
        hasAccessToken: !!authInfo.accessToken,
        hasRefreshToken: !!authInfo.refreshToken,
        hasUser: !!authInfo.user,
        userId: authInfo.user?.id,
        userEmail: authInfo.user?.email,
        userName: authInfo.user?.name,
        userPicture: authInfo.user?.picture,
        accessTokenExpiresAt: authInfo.accessTokenExpiresAt,
      });
      store.set(userAuthInfoAtom, authInfo);
      console.log('[Content Script] userAuthInfoAtom initialized with auth data');
    } else {
      console.log('[Content Script] No auth info found in storage');
      store.set(userAuthInfoAtom, null);
    }
  } catch (error) {
    console.error('[Content Script] Error initializing auth state:', error);
    store.set(userAuthInfoAtom, null);
  }
}

/**
 * Setup global storage listener for auth changes
 * This ensures auth state is updated even when components are unmounted
 */
function setupGlobalAuthListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[ChromeStorage.KEYS.XPLAINO_AUTH_INFO]) {
      const change = changes[ChromeStorage.KEYS.XPLAINO_AUTH_INFO];
      const newValue = change.newValue;
      
      console.log('[Content Script] Auth info changed in storage:', {
        hasNewValue: !!newValue,
        hasAccessToken: !!newValue?.accessToken,
        hasUser: !!newValue?.user,
        userPicture: newValue?.user?.picture,
      });
      
      store.set(userAuthInfoAtom, newValue || null);
      console.log('[Content Script] userAuthInfoAtom updated from storage change');
    }
  });
  
  console.log('[Content Script] Global auth storage listener setup complete');
}

/**
 * Toggle side panel open/closed state
 */
async function setSidePanelOpen(open: boolean, initialTab?: 'summary' | 'settings' | 'my'): Promise<void> {
  // If opening side panel and text explanation panel is open, close it first with shrink animation
  if (open && store.get(textExplanationPanelOpenAtom)) {
    console.log('[Content Script] Closing text explanation panel before opening side panel');
    
    if (textExplanationPanelCloseHandler) {
      // Use the animated close handler (triggers shrink animation)
      textExplanationPanelCloseHandler();
      // Wait for shrink animation to complete (400ms duration)
      await new Promise(resolve => setTimeout(resolve, 450));
    } else {
      // Fallback: immediate close if handler not available
      console.warn('[Content Script] Text explanation panel close handler not available, using immediate close');
      store.set(textExplanationPanelOpenAtom, false);
      updateTextExplanationPanel();
      updateTextExplanationIconContainer();
    }
  }
  
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
    zIndex: 2147483640,
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
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for summarise');
          store.set(summariseStateAtom, 'idle');
          store.set(showSubscriptionModalAtom, true);
          
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
 * Start polling translation state from manager
 */
function startTranslationStatePolling(): void {
  // Clear any existing polling
  stopTranslationStatePolling();
  
  translationStatePollingInterval = window.setInterval(() => {
    if (pageTranslationManager) {
      const newState = pageTranslationManager.getTranslationState();
      
      if (newState !== pageTranslationState) {
        console.log('[Content Script] Translation state changed:', pageTranslationState, '->', newState);
        pageTranslationState = newState;
        updateFAB();
      }
      
      // Stop polling if no longer translating
      if (newState !== 'translating') {
        stopTranslationStatePolling();
      }
    }
  }, 500); // Poll every 500ms
}

/**
 * Stop polling translation state
 */
function stopTranslationStatePolling(): void {
  if (translationStatePollingInterval !== null) {
    clearInterval(translationStatePollingInterval);
    translationStatePollingInterval = null;
  }
}

/**
 * Handle translate page button click
 */
async function handleTranslateClick(): Promise<void> {
  console.log('[Content Script] Translate page clicked from FAB');

  // Only allow translation when idle or translating (to stop)
  if (pageTranslationState !== 'idle') {
    console.log('[Content Script] Cannot start translation - state is:', pageTranslationState);
    return;
  }

  try {
    // Get settings from Chrome storage
    const translationView = await ChromeStorage.getUserSettingPageTranslationView() || 'append';
    const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();

    console.log('[Content Script] Translation settings:', { translationView, nativeLanguage });

    if (!nativeLanguage) {
      console.error('[Content Script] No native language set');
      alert('Please set your native language in the extension settings before translating.');
      return;
    }

    const targetLanguageCode = getLanguageCode(nativeLanguage);

    if (!targetLanguageCode) {
      console.error('[Content Script] Could not get language code for:', nativeLanguage);
      alert('Invalid language setting. Please check your extension settings.');
      return;
    }

    console.log('[Content Script] Starting page translation to:', targetLanguageCode);

    // Initialize translation manager
    pageTranslationManager = new PageTranslationManager();
    pageTranslationState = 'translating';
    updateFAB();
    
    // Start polling to sync state
    startTranslationStatePolling();
    
    // Start translation (this will update internal state)
    await pageTranslationManager.translatePage(targetLanguageCode, translationView);

    // Final state update
    pageTranslationState = pageTranslationManager.getTranslationState();
    console.log('[Content Script] Page translation complete, state:', pageTranslationState);
    updateFAB();
  } catch (error) {
    console.error('[Content Script] Translation error:', error);

    // Handle login required
    if (error instanceof Error && error.message === 'LOGIN_REQUIRED') {
      console.log('[Content Script] Login required for translation');
      store.set(showLoginModalAtom, true);
    } else if (error instanceof Error && error.message === 'SUBSCRIPTION_REQUIRED') {
      console.log('[Content Script] Subscription required for translation');
      store.set(showSubscriptionModalAtom, true);
    } else {
      // Show error to user
      alert('Translation failed. Please try again.');
    }

    // Clean up on error
    if (pageTranslationManager) {
      pageTranslationManager.clearTranslations();
      pageTranslationManager = null;
    }
    pageTranslationState = 'idle';
    stopTranslationStatePolling();
    updateFAB();
  }
}

/**
 * Handle stop translation button click
 */
function handleStopTranslation(): void {
  console.log('[Content Script] Stop translation clicked');
  
  if (pageTranslationManager) {
    pageTranslationManager.stopTranslation();
    pageTranslationState = pageTranslationManager.getTranslationState();
    stopTranslationStatePolling();
    updateFAB();
  }
}

/**
 * Handle toggle view button click
 */
function handleToggleView(mode: 'original' | 'translated'): void {
  console.log('[Content Script] Toggle view clicked:', mode);
  
  if (pageTranslationManager) {
    pageTranslationManager.toggleView(mode);
    pageViewMode = mode;
    updateFAB();
  }
}

/**
 * Handle clear translations button click
 */
function handleClearTranslations(): void {
  console.log('[Content Script] Clear translations clicked');
  
  if (pageTranslationManager) {
    pageTranslationManager.clearTranslations();
    pageTranslationManager = null;
  }
  
  pageTranslationState = 'idle';
  pageViewMode = 'translated';
  stopTranslationStatePolling();
  updateFAB();
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
    
    // Check if any panel is open
    const isAnyPanelOpen = sidePanelOpen || store.get(textExplanationPanelOpenAtom);
    
    fabRoot.render(
      React.createElement(Provider, { store },
        React.createElement(FAB, {
          useShadowDom: true,
          onSummarise: handleSummariseClick,
          onTranslate: handleTranslateClick,
          onStopTranslation: handleStopTranslation,
          onToggleView: handleToggleView,
          onClearTranslations: handleClearTranslations,
          onOptions: () => setSidePanelOpen(true, 'settings'),
          isSummarising: isSummarising,
          hasSummary: hasSummary,
          canHideActions: canHideFABActions,
          onShowModal: showDisableModal,
          isPanelOpen: isAnyPanelOpen,
          translationState: pageTranslationState,
          viewMode: pageViewMode,
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
    zIndex: 2147483641,
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
      onTranslate: (text: string) => {
        // Route to appropriate handler based on word vs text selection
        if (isWordSelection(text)) {
          handleWordTranslateClick(text);
        } else {
          handleTextTranslateClick(text);
        }
      },
      onBookmark: handleContentActionsBookmarkClick,
      onSynonym: handleSynonymClick,
      onOpposite: handleAntonymClick,
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
 * Helper function to update an explanation in the map
 */
function updateExplanationInMap(
  explanationId: string,
  updater: (state: TextExplanationState) => TextExplanationState
): void {
  const explanations = store.get(textExplanationsAtom);
  const currentState = explanations.get(explanationId);
  if (currentState) {
    const updatedState = updater(currentState);
    const newMap = new Map(explanations);
    newMap.set(explanationId, updatedState);
    store.set(textExplanationsAtom, newMap);
  }
}

/**
 * Recursively find if a folder ID exists in the folder tree (including subfolders)
 */
function findFolderInTree(folders: FolderWithSubFoldersResponse[], folderId: string): boolean {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return true;
    }
    if (folder.subFolders && folder.subFolders.length > 0) {
      if (findFolderInTree(folder.subFolders, folderId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a selection is a single word (no spaces, reasonable length)
 */
function isWordSelection(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && !trimmed.includes(' ') && trimmed.length <= 50;
}

/**
 * Handle Bookmark button click from ContentActionsTrigger
 */
async function handleContentActionsBookmarkClick(selectedText: string): Promise<void> {
  console.log('[Content Script] ===== ContentActions Bookmark clicked =====');
  console.log('[Content Script] Selected text:', selectedText);
  console.log('[Content Script] Selected text length:', selectedText?.length);
  
  // Trim the selected text
  const text = selectedText.trim();
  
  if (!text) {
    console.warn('[Content Script] Empty selection for bookmark');
    showToast('Please select text to bookmark', 'error');
    return;
  }
  
  // Capture the current selection range before it's cleared
  const selection = window.getSelection();
  let range: Range | null = null;
  if (selection && selection.rangeCount > 0) {
    range = selection.getRangeAt(0).cloneRange();
  }
  folderModalRange = range;
  
  console.log('[Content Script] Calling FolderService.getAllFolders');
  
  // Get folders and show modal
  FolderService.getAllFolders(
    'PARAGRAPH',
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Folders loaded successfully:', response.folders.length, 'folders');
        folderModalFolders = response.folders;
        folderModalText = text;
        folderModalSourceUrl = window.location.href;
        
        // Check for stored preference folder ID
        const storedFolderId = await ChromeStorage.getParagraphBookmarkPreferenceFolderId();
        if (storedFolderId && findFolderInTree(response.folders, storedFolderId)) {
          folderModalSelectedFolderId = storedFolderId;
          console.log('[Content Script] Auto-selected preferred folder:', storedFolderId);
        } else {
          folderModalSelectedFolderId = null;
          console.log('[Content Script] No valid preferred folder found, clearing selection');
        }
        
        folderModalOpen = true;
        injectFolderListModal();
        updateFolderListModal();
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to load folders:', errorCode, message);
        showToast(`Failed to load folders: ${message}`, 'error');
        folderModalRange = null; // Clear range on error
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to load folders');
        folderModalRange = null; // Clear range on login required
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to load folders');
        folderModalRange = null; // Clear range on subscription required
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
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

  // Check if this is a word selection
  const isWord = isWordSelection(selectedText);
  
  if (isWord) {
    // Handle word explanation with popover
    await handleWordExplain(selectedText, range, iconPosition);
    return;
  }

  // Otherwise, handle text explanation with side panel (existing behavior)

  // Get current explanations and active ID
  const explanations = store.get(textExplanationsAtom);
  const activeId = store.get(activeTextExplanationIdAtom);
  
  // If there's an active explanation, abort it and close its panel
  if (activeId) {
    const activeExplanation = explanations.get(activeId);
    if (activeExplanation?.abortController) {
      activeExplanation.abortController.abort();
    }
    // Close the panel for the previous active explanation
    store.set(textExplanationPanelOpenAtom, false);
  }

  // Calculate textStartIndex and textLength
  const textStartIndex = calculateTextStartIndex(range);
  const textLength = selectedText.length;

  // Create new explanation state
  const explanationId = `explanation-${Date.now()}`;
  const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
  
  const newExplanation: TextExplanationState = {
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
    translations: [], // Array of translations for this selected text
  };

  // Add to map
  const newMap = new Map(explanations);
  newMap.set(explanationId, newExplanation);
  store.set(textExplanationsAtom, newMap);
  
  // Set as active
  store.set(activeTextExplanationIdAtom, explanationId);

  // Reset view mode to contextual
  textExplanationViewMode = 'contextual';

  // Inject icon container and panel if not already injected
  injectTextExplanationIconContainer();
  injectTextExplanationPanel();

  // Update icon container to show spinner
  updateTextExplanationIconContainer();

  // Clear text selection immediately to hide purple action button
  window.getSelection()?.removeAllRanges();

  // Set up 30-second timeout - if no first chunk received, revert everything
  const timeoutId = setTimeout(() => {
    const currentState = store.get(textExplanationsAtom).get(explanationId);
    
    // Check if first chunk was received
    if (currentState && !currentState.firstChunkReceived) {
      console.log('[Content Script] No response after 30 seconds, canceling request and reverting...');
      
      // Abort the API request
      if (currentState.abortController) {
        currentState.abortController.abort();
      }
      
      // Show timeout error toast
      showToast('Request timed out after 30 seconds. Please try again.', 'error');
      
      // Remove the spinning icon
      const newMap = new Map(store.get(textExplanationsAtom));
      newMap.delete(explanationId);
      store.set(textExplanationsAtom, newMap);
      
      // Clear active explanation
      if (store.get(activeTextExplanationIdAtom) === explanationId) {
        store.set(activeTextExplanationIdAtom, null);
        store.set(textExplanationPanelOpenAtom, false);
      }
      
      // Update icon container (will hide if no explanations left)
      updateTextExplanationIconContainer();
      
      // Remove icon container if no explanations left
      if (newMap.size === 0) {
        removeTextExplanationIconContainer();
      }
      
      // Restore text selection so purple button shows again
      if (range) {
        try {
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (error) {
          console.error('[Content Script] Error restoring selection:', error);
        }
      }
    }
  }, 30000); // 30 seconds

  // Extract surrounding context for the text (15 words before + text + 15 words after)
  const contextText = extractSurroundingContextForText(selectedText, range);
  console.log('[Content Script] Extracted context for Simplify API:', contextText);

  try {
    // Call v2/simplify API
    await SimplifyService.simplify(
      [
        {
          textStartIndex,
          textLength,
          text: contextText, // Pass surrounding context instead of just selected text
          previousSimplifiedTexts: [],
        },
      ],
      {
        onChunk: (_chunk, accumulated) => {
          let isFirstChunk = false;
          
          updateExplanationInMap(explanationId, (state) => {
            const updatedState = { ...state, streamingText: accumulated };
            
            // On first chunk: switch to green icon, add underline, open panel
            if (!updatedState.firstChunkReceived) {
              isFirstChunk = true;
              updatedState.firstChunkReceived = true;
              updatedState.isSpinning = false;
              
              // Clear the timeout since we received the first chunk
              clearTimeout(timeoutId);
              
              // Add underline to selected text
              if (updatedState.range) {
                const underlineState = addTextUnderline(updatedState.range);
                updatedState.underlineState = underlineState;
              }
            }
            
            return updatedState;
          });
          
          // Update UI after state is committed to atom
          if (isFirstChunk) {
            // Open panel
            store.set(textExplanationPanelOpenAtom, true);
            updateTextExplanationPanel();
            
            // Update icon container (now reads the updated state with isSpinning = false)
            updateTextExplanationIconContainer();
          } else {
            // Update panel with new content
            updateTextExplanationPanel();
          }
        },
        onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
          console.log('[Content Script] Text explanation complete');
          
          // Clear the timeout since request completed
          clearTimeout(timeoutId);
          
          // Add initial explanation to chat history if not already there
          if (!textExplanationChatHistory.has(explanationId)) {
            textExplanationChatHistory.set(explanationId, []);
          }
          const chatHistory = textExplanationChatHistory.get(explanationId)!;
          
          updateExplanationInMap(explanationId, (state) => {
            // Only add if this is the first explanation (no messages yet)
            if (chatHistory.length === 0) {
              // Set count to 1 for the first explanation
              state.simplifiedExplanationCount = 1;
              const explanationNumber = state.simplifiedExplanationCount;
              
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
            state.shouldAllowSimplifyMore = shouldAllowSimplifyMore;
            // Add current simplified text to previousSimplifiedTexts array
            state.previousSimplifiedTexts = [...state.previousSimplifiedTexts, simplifiedText];
            
            // Clear streamingText after adding to chat history to prevent duplicate display
            state.streamingText = '';
            state.possibleQuestions = possibleQuestions || [];
            
            // Clear abort controller to indicate request is complete
            state.abortController = null;
            state.firstChunkReceived = false;
            state.isSimplifyRequest = undefined; // Clear simplify request flag
            
            return state;
          });
          
          updateTextExplanationPanel();
        },
        onError: (errorCode, errorMsg) => {
          console.error('[Content Script] Text explanation error:', errorCode, errorMsg);
          
          // Clear the timeout on error
          clearTimeout(timeoutId);
          
          // Show error toast
          showToast(errorMsg || 'Failed to explain text. Please try again.', 'error');
          
          // Remove the explanation completely (don't show green icon)
          const newMap = new Map(store.get(textExplanationsAtom));
          newMap.delete(explanationId);
          store.set(textExplanationsAtom, newMap);
          
          // Clear active explanation
          if (store.get(activeTextExplanationIdAtom) === explanationId) {
            store.set(activeTextExplanationIdAtom, null);
            store.set(textExplanationPanelOpenAtom, false);
          }
          
          // Update icon container (will hide if no explanations left)
          updateTextExplanationIconContainer();
          
          // Remove icon container if no explanations left
          if (newMap.size === 0) {
            removeTextExplanationIconContainer();
          }
          
          // Restore text selection so purple button shows again
          if (range) {
            try {
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            } catch (error) {
              console.error('[Content Script] Error restoring selection:', error);
            }
          }
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for text explanation');
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // Remove the text explanation completely (icon, underline, panel)
          removeTextExplanation(explanationId);
          // Show login modal
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for text explanation');
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // Remove the text explanation completely (icon, underline, panel)
          removeTextExplanation(explanationId);
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
      },
      newExplanation.abortController || undefined
    );
  } catch (error) {
    console.error('[Content Script] Text explanation exception:', error);
    
    // Clear the timeout on exception
    clearTimeout(timeoutId);
    
    // Show error toast
    const errorMessage = error instanceof Error ? error.message : 'Failed to explain text. Please try again.';
    showToast(errorMessage, 'error');
    
    // Remove the explanation completely (don't show green icon)
    const newMap = new Map(store.get(textExplanationsAtom));
    newMap.delete(explanationId);
    store.set(textExplanationsAtom, newMap);
    
    // Clear active explanation
    if (store.get(activeTextExplanationIdAtom) === explanationId) {
      store.set(activeTextExplanationIdAtom, null);
      store.set(textExplanationPanelOpenAtom, false);
    }
    
    // Update icon container (will hide if no explanations left)
    updateTextExplanationIconContainer();
    
    // Remove icon container if no explanations left
    if (newMap.size === 0) {
      removeTextExplanationIconContainer();
    }
    
    // Restore text selection so purple button shows again
    if (range) {
      try {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      } catch (error) {
        console.error('[Content Script] Error restoring selection:', error);
      }
    }
  }
}

/**
 * Handle word explanation with popover
 */
async function handleWordExplain(
  word: string,
  range: Range,
  _iconPosition: { x: number; y: number }
): Promise<void> {
  console.log('[Content Script] Word explain triggered:', word);

  // Create unique ID for this word explanation
  const wordId = `word-${Date.now()}`;

  // Clear text selection immediately
  window.getSelection()?.removeAllRanges();

  try {
    // Inject word span styles into main DOM (one-time operation)
    injectWordSpanStyles();
    
    // Create word span wrapper with loading state
    const wordSpan = createWordSpan(word, range);
    if (!wordSpan) {
      console.error('[Content Script] Failed to create word span');
      return;
    }

    // Create purple spinner near the word
    const spinner = createPurpleSpinner(wordSpan);

    // Create source ref for animation
    const sourceRef: React.MutableRefObject<HTMLElement | null> = { current: wordSpan };

    // Initialize word explanation state
    const abortController = new AbortController();
    const wordState: WordExplanationLocalState = {
      word,
      wordSpanElement: wordSpan,
      spinnerElement: spinner,
      popoverVisible: false,
      streamedContent: '',
      activeTab: 'contextual',
      abortController,
      firstEventReceived: false,
      isLoading: true,
      errorMessage: null,
      range: range.cloneRange(),
      sourceRef,
    };

    wordExplanationsMap.set(wordId, wordState);
    
    // Initialize atom state for this word
    const atomState: WordExplanationAtomState = {
      id: wordId,
      word,
      meaning: '',
      examples: [],
      synonyms: [],
      antonyms: [],
      translations: [],
      shouldAllowFetchMoreExamples: true,
      askAI: {
        chatHistory: [],
        streamingText: '',
        messageQuestions: {},
        isRequesting: false,
        abortController: null,
        firstChunkReceived: false,
      },
      popoverVisible: false,
      askAIPopoverVisible: false,
      activeTab: 'contextual',
      wordSpanElement: wordSpan,
      sourceRef,
      askAIButtonRef: null,
      isLoadingExamples: false,
      isLoadingSynonyms: false,
      isLoadingAntonyms: false,
      isLoadingTranslation: false,
      examplesError: null,
      synonymsError: null,
      antonymsError: null,
      translationError: null,
      range: range.cloneRange(),
      spinnerElement: spinner,
      isLoading: true,
      errorMessage: null,
      streamedContent: '',
      firstEventReceived: false,
      abortController,
      isSaved: false,
      savedWordId: null,
      isSavingWord: false,
    };
    
    const atomsMap = new Map(store.get(wordExplanationsAtom));
    atomsMap.set(wordId, atomState);
    store.set(wordExplanationsAtom, atomsMap);
    store.set(activeWordIdAtom, wordId);

    // Set 30-second timeout
    const timeoutId = setTimeout(() => {
      const currentState = wordExplanationsMap.get(wordId);
      if (currentState && !currentState.firstEventReceived) {
        console.log('[Content Script] Word explanation timeout - no response after 30 seconds');
        
        // Abort request
        currentState.abortController?.abort();
        
        // Remove span and spinner
        removeWordExplanation(wordId);
        
        showToast('Request timed out after 30 seconds. Please try again.', 'error');
      }
    }, 30000);

    // Extract surrounding context for the word (7 words before + word + 7 words after)
    const contextText = extractSurroundingContext(word, range);
    console.log('[Content Script] Extracted context for API:', contextText);

    // Call words_explanation_v2 API
    await WordsExplanationV2Service.explainWord(
      word,
      contextText, // Pass surrounding context instead of empty string
      {
        onEvent: (wordInfo: WordInfo) => {
          const state = wordExplanationsMap.get(wordId);
          if (!state) return;

          console.log('[Content Script] Word explanation event:', wordInfo);

          // Parse raw_response to get meaning and examples
          const { meaning, examples } = WordsExplanationV2Service.parseRawResponse(
            wordInfo.raw_response
          );

          // Format content as markdown (without word, as it's now in the header)
          let formattedContent = meaning;
          if (examples.length > 0) {
            formattedContent += '\n\n#### Examples:\n';
            examples.forEach((example, idx) => {
              formattedContent += `${idx + 1}. ${example}\n`;
            });
          }

          // On first event
          if (!state.firstEventReceived) {
            clearTimeout(timeoutId);
            state.firstEventReceived = true;
            state.isLoading = false;
            state.streamedContent = formattedContent;
            
            // Update atom state with meaning and examples
            const atomState = store.get(wordExplanationsAtom).get(wordId);
            if (atomState) {
              const updatedAtomState: WordExplanationAtomState = {
                ...atomState,
                meaning,
                examples,
                shouldAllowFetchMoreExamples: true, // Default to true (wordInfo doesn't have this field)
                activeTab: 'contextual', // Ensure we're on contextual tab
              };
              const atomsMap = new Map(store.get(wordExplanationsAtom));
              atomsMap.set(wordId, updatedAtomState);
              store.set(wordExplanationsAtom, atomsMap);
            }
            
            // Ensure local state's activeTab is also 'contextual'
            if (state.activeTab !== 'contextual') {
              state.activeTab = 'contextual';
            }

            // Remove spinner
            if (state.spinnerElement) {
              state.spinnerElement.remove();
              state.spinnerElement = null;
            }

            // Convert span to green with scale animation
            if (state.wordSpanElement) {
              state.wordSpanElement.classList.remove('word-explanation-loading');
              state.wordSpanElement.classList.add('word-explanation-active');
              
              // Get bookmark state from atom
              const atomState = store.get(wordExplanationsAtom).get(wordId);
              const isSaved = atomState?.isSaved || false;
              
              // Update inline styles to show green background (CSS classes don't work in main DOM)
              state.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
              state.wordSpanElement.style.cursor = 'pointer';
              state.wordSpanElement.style.transition = 'background 0.2s ease';
              
              // Apply green styling with border, bookmark icon, and close button
              applyGreenWordSpanStyling(state.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation with inline styles
              state.wordSpanElement.style.animation = 'none';
              // Force reflow to restart animation
              void state.wordSpanElement.offsetHeight;
              state.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (state.wordSpanElement) {
                  state.wordSpanElement.style.animation = '';
                }
              }, 800);

              // Add hover event listeners for green highlight effect
              state.wordSpanElement.addEventListener('mouseenter', () => {
                if (state.wordSpanElement) {
                  state.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.25)';
                }
              });
              state.wordSpanElement.addEventListener('mouseleave', () => {
                if (state.wordSpanElement) {
                  state.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
                }
              });

              // Add click handler to toggle popover
              state.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show purple icon
              state.wordSpanElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (state.wordSpanElement) {
                  showPurpleXplainoIconForWordRemoval(state.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }

            // Open popover
            state.popoverVisible = true;
            console.log('[Content Script] Opening word explanation popover for wordId:', wordId);
            console.log('[Content Script] Word span element:', state.wordSpanElement);
            console.log('[Content Script] Source ref current:', state.sourceRef.current);
            injectWordExplanationPopover();
            updateWordExplanationPopover();
            console.log('[Content Script] Popover injection and update completed');
          } else {
            // Append to existing content (for multi-word responses)
            state.streamedContent = formattedContent;
            
            // Update atom state
            const atomState = store.get(wordExplanationsAtom).get(wordId);
            if (atomState) {
              const updatedAtomState: WordExplanationAtomState = {
                ...atomState,
                meaning,
                examples,
                shouldAllowFetchMoreExamples: true, // Default to true (wordInfo doesn't have this field)
                activeTab: 'contextual', // Ensure we're on contextual tab
              };
              const atomsMap = new Map(store.get(wordExplanationsAtom));
              atomsMap.set(wordId, updatedAtomState);
              store.set(wordExplanationsAtom, atomsMap);
            }
            
            // Ensure local state's activeTab is also 'contextual'
            if (state.activeTab !== 'contextual') {
              state.activeTab = 'contextual';
            }
            
            updateWordExplanationPopover();
          }
        },
        onComplete: () => {
          clearTimeout(timeoutId);
          console.log('[Content Script] Word explanation complete');
          
          const state = wordExplanationsMap.get(wordId);
          if (state) {
            state.abortController = null;
            state.isLoading = false;
          }
        },
        onError: (errorCode: string, errorMessage: string) => {
          clearTimeout(timeoutId);
          console.error('[Content Script] Word explanation error:', errorCode, errorMessage);
          
          const state = wordExplanationsMap.get(wordId);
          if (state) {
            state.isLoading = false;
            state.errorMessage = errorMessage;
            
            if (!state.firstEventReceived) {
              // No first event received - remove everything
              removeWordExplanation(wordId);
              showToast(errorMessage || 'Failed to explain word. Please try again.', 'error');
            } else {
              // First event received - show error in popover
              updateWordExplanationPopover();
            }
          }
        },
        onLoginRequired: () => {
          clearTimeout(timeoutId);
          console.log('[Content Script] Login required for word explanation');
          
          const state = wordExplanationsMap.get(wordId);
          if (state) {
            state.isLoading = false;
            
            if (!state.firstEventReceived) {
              // No first event received - remove everything
              removeWordExplanation(wordId);
            } else {
              // First event received - just update popover
              updateWordExplanationPopover();
            }
          }
          
          // Show login modal
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          clearTimeout(timeoutId);
          console.log('[Content Script] Subscription required for word explanation');
          
          const state = wordExplanationsMap.get(wordId);
          if (state) {
            state.isLoading = false;
            
            if (!state.firstEventReceived) {
              // No first event received - remove everything
              removeWordExplanation(wordId);
            } else {
              // First event received - just update popover
              updateWordExplanationPopover();
            }
          }
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
      },
      abortController.signal
    );
  } catch (error) {
    console.error('[Content Script] Word explanation exception:', error);
    removeWordExplanation(wordId);
  }
}

/**
 * Handle Synonym button click from ContentActions 3-dot menu
 * Creates word span, shows loading animation, calls API, then opens popover with grammar tab
 */
async function handleSynonymClick(selectedText: string): Promise<void> {
  console.log('[Content Script] Synonym clicked:', selectedText);
  
  // Get current selection range
  const windowSelection = window.getSelection();
  if (!windowSelection || windowSelection.rangeCount === 0) {
    console.warn('[Content Script] No selection available for synonym');
    return;
  }
  
  const range = windowSelection.getRangeAt(0);
  
  // Clear selection immediately
  windowSelection.removeAllRanges();
  
  // Create unique ID for this word explanation
  const wordId = `word-${Date.now()}`;
  
  try {
    // Inject word span styles into main DOM (one-time operation)
    injectWordSpanStyles();
    
    // Create word span wrapper with loading state
    const wordSpan = createWordSpan(selectedText, range);
    if (!wordSpan) {
      console.error('[Content Script] Failed to create word span');
      return;
    }
    
    // Create purple spinner near the word
    const spinner = createPurpleSpinner(wordSpan);
    
    // Create source ref for animation
    const sourceRef: React.MutableRefObject<HTMLElement | null> = { current: wordSpan };
    
    // Initialize word explanation state (without calling word explanation API)
    const wordState: WordExplanationLocalState = {
      word: selectedText,
      wordSpanElement: wordSpan,
      spinnerElement: spinner,
      popoverVisible: false,
      streamedContent: '',
      activeTab: 'grammar', // Set to grammar tab
      abortController: null,
      firstEventReceived: false,
      isLoading: false,
      errorMessage: null,
      range: range.cloneRange(),
      sourceRef,
    };
    
    wordExplanationsMap.set(wordId, wordState);
    
    // Initialize atom state for this word
    const atomState: WordExplanationAtomState = {
      id: wordId,
      word: selectedText,
      meaning: '',
      examples: [],
      synonyms: [],
      antonyms: [],
      translations: [],
      shouldAllowFetchMoreExamples: true,
      askAI: {
        chatHistory: [],
        streamingText: '',
        messageQuestions: {},
        isRequesting: false,
        abortController: null,
        firstChunkReceived: false,
      },
      popoverVisible: false,
      askAIPopoverVisible: false,
      activeTab: 'grammar', // Set to grammar tab
      wordSpanElement: wordSpan,
      sourceRef,
      askAIButtonRef: null,
      isLoadingExamples: false,
      isLoadingSynonyms: true, // Set loading state for synonyms
      isLoadingAntonyms: false,
      isLoadingTranslation: false,
      examplesError: null,
      synonymsError: null,
      antonymsError: null,
      translationError: null,
      range: range.cloneRange(),
      spinnerElement: spinner,
      isLoading: false,
      errorMessage: null,
      streamedContent: '',
      firstEventReceived: false,
      abortController: null,
      isSaved: false,
      savedWordId: null,
      isSavingWord: false,
    };
    
    const atomsMap = new Map(store.get(wordExplanationsAtom));
    atomsMap.set(wordId, atomState);
    store.set(wordExplanationsAtom, atomsMap);
    store.set(activeWordIdAtom, wordId);
    
    // Call synonyms API
    await WordSynonymsService.getSynonyms(
      { words: [selectedText] },
      {
        onSuccess: (response) => {
          console.log('[Content Script] Synonyms received:', response);
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;
          
          // Extract synonyms array from first word result
          const synonymsList = response.synonyms.length > 0 ? response.synonyms[0].synonyms : [];
          
          // Update atom state
          const updated: WordExplanationAtomState = {
            ...currentState,
            synonyms: synonymsList,
            isLoadingSynonyms: false,
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          
          // Update local state
          const localState = wordExplanationsMap.get(wordId);
          if (localState) {
            // Remove spinner
            if (localState.spinnerElement) {
              localState.spinnerElement.remove();
              localState.spinnerElement = null;
            }
            
            // Convert span to green with scale animation
            if (localState.wordSpanElement) {
              localState.wordSpanElement.classList.remove('word-explanation-loading');
              localState.wordSpanElement.classList.add('word-explanation-active');
              
              // Get bookmark state from atom
              const atomState = store.get(wordExplanationsAtom).get(wordId);
              const isSaved = atomState?.isSaved || false;
              
              // Update inline styles to show green background
              localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'background 0.2s ease';
              
              // Apply green styling with border, bookmark icon, and close button
              applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              }, 800);
              
              // Add hover event listeners
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.25)';
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show purple icon
              localState.wordSpanElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  showPurpleXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover
            localState.popoverVisible = true;
            injectWordExplanationPopover();
            updateWordExplanationPopover();
          }
        },
        onError: (code: string, message: string) => {
          console.error('[Content Script] Synonyms error:', code, message);
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show user-friendly message
          const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
            ? 'Synonyms do not exist for this word'
            : (message || 'Failed to fetch synonyms');
          showToast(displayMessage, 'error');
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for synonyms');
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for synonyms - cleaning up UI silently');
          
          // Remove word explanation and selection silently (no error toast)
          removeWordExplanation(wordId);
          
          // Login modal will be shown by global handler
        },
      }
    );
  } catch (error) {
    console.error('[Content Script] Synonym click exception:', error);
    removeWordExplanation(wordId);
    showToast('An error occurred', 'error');
  }
}

/**
 * Handle Antonym/Opposite button click from ContentActions 3-dot menu
 * Creates word span, shows loading animation, calls API, then opens popover with grammar tab
 */
async function handleAntonymClick(selectedText: string): Promise<void> {
  console.log('[Content Script] Antonym clicked:', selectedText);
  
  // Get current selection range
  const windowSelection = window.getSelection();
  if (!windowSelection || windowSelection.rangeCount === 0) {
    console.warn('[Content Script] No selection available for antonym');
    return;
  }
  
  const range = windowSelection.getRangeAt(0);
  
  // Clear selection immediately
  windowSelection.removeAllRanges();
  
  // Create unique ID for this word explanation
  const wordId = `word-${Date.now()}`;
  
  try {
    // Inject word span styles into main DOM (one-time operation)
    injectWordSpanStyles();
    
    // Create word span wrapper with loading state
    const wordSpan = createWordSpan(selectedText, range);
    if (!wordSpan) {
      console.error('[Content Script] Failed to create word span');
      return;
    }
    
    // Create purple spinner near the word
    const spinner = createPurpleSpinner(wordSpan);
    
    // Create source ref for animation
    const sourceRef: React.MutableRefObject<HTMLElement | null> = { current: wordSpan };
    
    // Initialize word explanation state (without calling word explanation API)
    const wordState: WordExplanationLocalState = {
      word: selectedText,
      wordSpanElement: wordSpan,
      spinnerElement: spinner,
      popoverVisible: false,
      streamedContent: '',
      activeTab: 'grammar', // Set to grammar tab
      abortController: null,
      firstEventReceived: false,
      isLoading: false,
      errorMessage: null,
      range: range.cloneRange(),
      sourceRef,
    };
    
    wordExplanationsMap.set(wordId, wordState);
    
    // Initialize atom state for this word
    const atomState: WordExplanationAtomState = {
      id: wordId,
      word: selectedText,
      meaning: '',
      examples: [],
      synonyms: [],
      antonyms: [],
      translations: [],
      shouldAllowFetchMoreExamples: true,
      askAI: {
        chatHistory: [],
        streamingText: '',
        messageQuestions: {},
        isRequesting: false,
        abortController: null,
        firstChunkReceived: false,
      },
      popoverVisible: false,
      askAIPopoverVisible: false,
      activeTab: 'grammar', // Set to grammar tab
      wordSpanElement: wordSpan,
      sourceRef,
      askAIButtonRef: null,
      isLoadingExamples: false,
      isLoadingSynonyms: false,
      isLoadingAntonyms: true, // Set loading state for antonyms
      isLoadingTranslation: false,
      examplesError: null,
      synonymsError: null,
      antonymsError: null,
      translationError: null,
      range: range.cloneRange(),
      spinnerElement: spinner,
      isLoading: false,
      errorMessage: null,
      streamedContent: '',
      firstEventReceived: false,
      abortController: null,
      isSaved: false,
      savedWordId: null,
      isSavingWord: false,
    };
    
    const atomsMap = new Map(store.get(wordExplanationsAtom));
    atomsMap.set(wordId, atomState);
    store.set(wordExplanationsAtom, atomsMap);
    store.set(activeWordIdAtom, wordId);
    
    // Call antonyms API
    await WordAntonymsService.getAntonyms(
      { words: [selectedText] },
      {
        onSuccess: (response) => {
          console.log('[Content Script] Antonyms received:', response);
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;
          
          // Extract antonyms array from first word result
          const antonymsList = response.antonyms.length > 0 ? response.antonyms[0].antonyms : [];
          
          // Update atom state
          const updated: WordExplanationAtomState = {
            ...currentState,
            antonyms: antonymsList,
            isLoadingAntonyms: false,
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          
          // Update local state
          const localState = wordExplanationsMap.get(wordId);
          if (localState) {
            // Remove spinner
            if (localState.spinnerElement) {
              localState.spinnerElement.remove();
              localState.spinnerElement = null;
            }
            
            // Convert span to green with scale animation
            if (localState.wordSpanElement) {
              localState.wordSpanElement.classList.remove('word-explanation-loading');
              localState.wordSpanElement.classList.add('word-explanation-active');
              
              // Get bookmark state from atom
              const atomState = store.get(wordExplanationsAtom).get(wordId);
              const isSaved = atomState?.isSaved || false;
              
              // Update inline styles to show green background
              localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'background 0.2s ease';
              
              // Apply green styling with border, bookmark icon, and close button
              applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              });
              
              // Add hover event listeners
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.25)';
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show purple icon
              localState.wordSpanElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  showPurpleXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover
            localState.popoverVisible = true;
            injectWordExplanationPopover();
            updateWordExplanationPopover();
          }
        },
        onError: (code: string, message: string) => {
          console.error('[Content Script] Antonyms error:', code, message);
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show user-friendly message
          const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
            ? 'Opposite does not exist for this word'
            : (message || 'Failed to fetch antonyms');
          showToast(displayMessage, 'error');
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for antonyms');
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for antonyms - cleaning up UI silently');
          
          // Remove word explanation and selection silently (no error toast)
          removeWordExplanation(wordId);
          
          // Login modal will be shown by global handler
        },
      }
    );
  } catch (error) {
    console.error('[Content Script] Antonym click exception:', error);
    removeWordExplanation(wordId);
    showToast('An error occurred', 'error');
  }
}

/**
 * Handle Translate button click from ContentActions 3-dot menu for WORD selection
 * Creates word span, shows loading animation, calls API, then opens popover with grammar tab
 */
async function handleWordTranslateClick(selectedText: string): Promise<void> {
  console.log('[Content Script] Word translate clicked:', selectedText);
  
  // Get current selection range
  const windowSelection = window.getSelection();
  if (!windowSelection || windowSelection.rangeCount === 0) {
    console.warn('[Content Script] No selection available for word translation');
    return;
  }
  
  const range = windowSelection.getRangeAt(0);
  
  // Clear selection immediately
  windowSelection.removeAllRanges();
  
  // Create unique ID for this word explanation
  const wordId = `word-${Date.now()}`;
  
  try {
    // Get target language from user settings
    const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
    if (!nativeLanguage) {
      console.error('[Content Script] No native language set');
      showToast('Please set your native language in settings', 'error');
      return;
    }
    
    const targetLanguageCode = getLanguageCode(nativeLanguage);
    if (!targetLanguageCode) {
      console.error('[Content Script] Could not get language code for:', nativeLanguage);
      showToast('Invalid language setting', 'error');
      return;
    }
    
    // Inject word span styles into main DOM (one-time operation)
    injectWordSpanStyles();
    
    // Create word span wrapper with loading state
    const wordSpan = createWordSpan(selectedText, range);
    if (!wordSpan) {
      console.error('[Content Script] Failed to create word span');
      return;
    }
    
    // Create purple spinner near the word
    const spinner = createPurpleSpinner(wordSpan);
    
    // Create source ref for animation
    const sourceRef: React.MutableRefObject<HTMLElement | null> = { current: wordSpan };
    
    // Initialize word explanation state (without calling word explanation API)
    const wordState: WordExplanationLocalState = {
      word: selectedText,
      wordSpanElement: wordSpan,
      spinnerElement: spinner,
      popoverVisible: false,
      streamedContent: '',
      activeTab: 'grammar', // Set to grammar tab
      abortController: null,
      firstEventReceived: false,
      isLoading: false,
      errorMessage: null,
      range: range.cloneRange(),
      sourceRef,
    };
    
    wordExplanationsMap.set(wordId, wordState);
    
    // Initialize atom state for this word
    const atomState: WordExplanationAtomState = {
      id: wordId,
      word: selectedText,
      meaning: '',
      examples: [],
      synonyms: [],
      antonyms: [],
      translations: [],
      shouldAllowFetchMoreExamples: true,
      askAI: {
        chatHistory: [],
        streamingText: '',
        messageQuestions: {},
        isRequesting: false,
        abortController: null,
        firstChunkReceived: false,
      },
      popoverVisible: false,
      askAIPopoverVisible: false,
      activeTab: 'grammar', // Set to grammar tab
      wordSpanElement: wordSpan,
      sourceRef,
      askAIButtonRef: null,
      isLoadingExamples: false,
      isLoadingSynonyms: false,
      isLoadingAntonyms: false,
      isLoadingTranslation: true, // Set loading state for translation
      examplesError: null,
      synonymsError: null,
      antonymsError: null,
      translationError: null,
      range: range.cloneRange(),
      spinnerElement: spinner,
      isLoading: false,
      errorMessage: null,
      streamedContent: '',
      firstEventReceived: false,
      abortController: null,
      isSaved: false,
      savedWordId: null,
      isSavingWord: false,
    };
    
    const atomsMap = new Map(store.get(wordExplanationsAtom));
    atomsMap.set(wordId, atomState);
    store.set(wordExplanationsAtom, atomsMap);
    store.set(activeWordIdAtom, wordId);
    
    // Call translate API
    await TranslateService.translate(
      {
        targetLangugeCode: targetLanguageCode,
        texts: [{ id: '1', text: selectedText }],
      },
      {
        onSuccess: (translatedTexts) => {
          console.log('[Content Script] Translation received:', translatedTexts);
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;
          
          // Extract translated text
          const translatedText = translatedTexts[0] || '';
          
          // Update atom state with translation
          const updated: WordExplanationAtomState = {
            ...currentState,
            translations: [{ language: nativeLanguage, translated_content: translatedText }],
            isLoadingTranslation: false,
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          
          // Update local state
          const localState = wordExplanationsMap.get(wordId);
          if (localState) {
            // Remove spinner
            if (localState.spinnerElement) {
              localState.spinnerElement.remove();
              localState.spinnerElement = null;
            }
            
            // Convert span to green with scale animation
            if (localState.wordSpanElement) {
              localState.wordSpanElement.classList.remove('word-explanation-loading');
              localState.wordSpanElement.classList.add('word-explanation-active');
              
              // Get bookmark state from atom
              const atomState = store.get(wordExplanationsAtom).get(wordId);
              const isSaved = atomState?.isSaved || false;
              
              // Update inline styles to show green background
              localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'background 0.2s ease';
              
              // Apply green styling with border, bookmark icon, and close button
              applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              }, 800);
              
              // Add hover event listeners
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.25)';
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'rgba(0, 200, 0, 0.15)';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show purple icon
              localState.wordSpanElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  showPurpleXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover with Grammar tab
            localState.popoverVisible = true;
            injectWordExplanationPopover();
            updateWordExplanationPopover();
          }
        },
        onError: (code: string, message: string) => {
          console.error('[Content Script] Translation error:', code, message);
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show user-friendly message
          const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
            ? 'Translation not available for this word'
            : (message || 'Failed to translate');
          showToast(displayMessage, 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for translation');
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show login modal
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for translation');
          
          // Remove word explanation
          removeWordExplanation(wordId);
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  } catch (error) {
    console.error('[Content Script] Word translate exception:', error);
    removeWordExplanation(wordId);
    showToast('An error occurred', 'error');
  }
}

/**
 * Handle Translate button click from ContentActions 3-dot menu for TEXT selection
 * Opens text explanation side panel with Translation tab showing translated content
 */
async function handleTextTranslateClick(selectedText: string): Promise<void> {
  console.log('[Content Script] Text translate clicked:', selectedText);
  
  // Get current selection range
  const windowSelection = window.getSelection();
  if (!windowSelection || windowSelection.rangeCount === 0) {
    console.warn('[Content Script] No selection available for text translation');
    return;
  }
  
  const range = windowSelection.getRangeAt(0);
  
  try {
    // Get target language from user settings
    const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
    if (!nativeLanguage) {
      console.error('[Content Script] No native language set');
      showToast('Please set your native language in settings', 'error');
      return;
    }
    
    const targetLanguageCode = getLanguageCode(nativeLanguage);
    if (!targetLanguageCode) {
      console.error('[Content Script] Could not get language code for:', nativeLanguage);
      showToast('Invalid language setting', 'error');
      return;
    }
    
    // Get current explanations and active ID
    const explanations = store.get(textExplanationsAtom);
    const activeId = store.get(activeTextExplanationIdAtom);
    
    // If there's an active explanation, abort it and close its panel
    if (activeId) {
      const activeExplanation = explanations.get(activeId);
      if (activeExplanation?.abortController) {
        activeExplanation.abortController.abort();
      }
      // Close the panel for the previous active explanation
      store.set(textExplanationPanelOpenAtom, false);
    }
    
    // Calculate textStartIndex and textLength
    const textStartIndex = calculateTextStartIndex(range);
    const textLength = selectedText.length;
    
    // Create icon position (top-left of selection)
    const selectionRect = range.getBoundingClientRect();
    const iconPosition = {
      x: selectionRect.left - 30,
      y: selectionRect.top,
    };
    
    // Create new explanation state
    const explanationId = `explanation-${Date.now()}`;
    const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
    
    const newExplanation: TextExplanationState = {
      id: explanationId,
      selectedText,
      range: range.cloneRange(),
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
      simplifiedExplanationCount: 0,
      isSimplifyRequest: false, // This is NOT a simplify request
      translations: [], // Will be populated with translation
    };
    
    // Add to map
    const newMap = new Map(explanations);
    newMap.set(explanationId, newExplanation);
    store.set(textExplanationsAtom, newMap);
    
    // Set as active
    store.set(activeTextExplanationIdAtom, explanationId);
    
    // Set view mode to translation
    textExplanationViewMode = 'translation';
    
    // Inject icon container and panel if not already injected
    injectTextExplanationIconContainer();
    injectTextExplanationPanel();
    
    // Update icon container to show spinner
    updateTextExplanationIconContainer();
    
    // Clear text selection immediately
    window.getSelection()?.removeAllRanges();
    
    // Set translating flag
    isTranslating = true;
    
    // Call translate API
    await TranslateService.translate(
      {
        targetLangugeCode: targetLanguageCode,
        texts: [{ id: '1', text: selectedText }],
      },
      {
        onSuccess: (translatedTexts) => {
          console.log('[Content Script] Text translation received:', translatedTexts);
          
          const currentState = store.get(textExplanationsAtom).get(explanationId);
          if (!currentState) return;
          
          // Extract translated text
          const translatedText = translatedTexts[0] || '';
          
          // Update explanation state with translation
          const updated: TextExplanationState = {
            ...currentState,
            isSpinning: false,
            firstChunkReceived: true,
            translations: [{ language: nativeLanguage, translated_content: translatedText }],
          };
          
          const map = new Map(store.get(textExplanationsAtom));
          map.set(explanationId, updated);
          store.set(textExplanationsAtom, map);
          
          // Stop translating flag
          isTranslating = false;
          
          // Add green underline to selected text when panel starts opening
          const currentStateForUnderline = store.get(textExplanationsAtom).get(explanationId);
          if (currentStateForUnderline && currentStateForUnderline.range) {
            const underlineState = addTextUnderline(currentStateForUnderline.range, 'green');
            if (underlineState) {
              // Update explanation state with underline
              const mapWithUnderline = new Map(store.get(textExplanationsAtom));
              const stateWithUnderline = mapWithUnderline.get(explanationId);
              if (stateWithUnderline) {
                mapWithUnderline.set(explanationId, {
                  ...stateWithUnderline,
                  underlineState,
                });
                store.set(textExplanationsAtom, mapWithUnderline);
              }
            }
          }
          
          // Open side panel with Translation tab
          store.set(textExplanationPanelOpenAtom, true);
          
          // Update icon and panel
          updateTextExplanationIconContainer();
          updateTextExplanationPanel();
        },
        onError: (code: string, message: string) => {
          console.error('[Content Script] Text translation error:', code, message);
          
          // Stop translating flag
          isTranslating = false;
          
          // Remove the explanation
          const newMap = new Map(store.get(textExplanationsAtom));
          newMap.delete(explanationId);
          store.set(textExplanationsAtom, newMap);
          
          // Clear active explanation
          if (store.get(activeTextExplanationIdAtom) === explanationId) {
            store.set(activeTextExplanationIdAtom, null);
            store.set(textExplanationPanelOpenAtom, false);
          }
          
          // Update icon container
          updateTextExplanationIconContainer();
          
          // Remove icon container if no explanations left
          if (newMap.size === 0) {
            removeTextExplanationIconContainer();
          }
          
          // Show user-friendly message
          const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
            ? 'Translation not available'
            : (message || 'Failed to translate');
          showToast(displayMessage, 'error');
          
          // Restore text selection
          try {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch (error) {
            console.error('[Content Script] Error restoring selection:', error);
          }
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for text translation');
          
          // Stop translating flag
          isTranslating = false;
          
          // Remove the explanation
          const newMap = new Map(store.get(textExplanationsAtom));
          newMap.delete(explanationId);
          store.set(textExplanationsAtom, newMap);
          
          // Clear active explanation
          if (store.get(activeTextExplanationIdAtom) === explanationId) {
            store.set(activeTextExplanationIdAtom, null);
            store.set(textExplanationPanelOpenAtom, false);
          }
          
          // Update icon container
          updateTextExplanationIconContainer();
          
          // Remove icon container if no explanations left
          if (newMap.size === 0) {
            removeTextExplanationIconContainer();
          }
          
          // Show login modal
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for text translation');
          
          // Stop translating flag
          isTranslating = false;
          
          // Remove the explanation
          const newMap = new Map(store.get(textExplanationsAtom));
          newMap.delete(explanationId);
          store.set(textExplanationsAtom, newMap);
          
          // Clear active explanation
          if (store.get(activeTextExplanationIdAtom) === explanationId) {
            store.set(activeTextExplanationIdAtom, null);
            store.set(textExplanationPanelOpenAtom, false);
          }
          
          // Update icon container
          updateTextExplanationIconContainer();
          
          // Remove icon container if no explanations left
          if (newMap.size === 0) {
            removeTextExplanationIconContainer();
          }
          
          // Show subscription modal
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  } catch (error) {
    console.error('[Content Script] Text translate exception:', error);
    
    // Stop translating flag
    isTranslating = false;
    
    showToast('An error occurred', 'error');
    
    // Restore text selection
    try {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (restoreError) {
      console.error('[Content Script] Error restoring selection:', restoreError);
    }
  }
}

/**
 * Create word span wrapper with loading state
 */
function createWordSpan(word: string, range: Range): HTMLElement | null {
  try {
    // Create span element
    const span = document.createElement('span');
    span.className = 'word-explanation-loading';
    span.textContent = word;
    span.style.cssText = `
      background: rgba(149, 39, 245, 0.1);
      border-radius: 12px;
      padding: 2px 4px;
      cursor: default;
      position: relative;
    `;

    // Wrap the range with the span
    try {
      range.surroundContents(span);
    } catch (error) {
      // If surroundContents fails, use alternative approach
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    return span;
  } catch (error) {
    console.error('[Content Script] Error creating word span:', error);
    return null;
  }
}

/**
 * Create purple spinner near the word span
 */
function createPurpleSpinner(wordSpan: HTMLElement): HTMLElement {
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'purple-spinner-container';
  
  const rect = wordSpan.getBoundingClientRect();
  spinnerContainer.style.cssText = `
    position: fixed;
    left: ${rect.right + 8}px;
    top: ${rect.top + (rect.height / 2) - 9}px;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const spinner = document.createElement('div');
  spinner.className = 'purple-spinner';
  spinner.style.cssText = `
    width: 18px;
    height: 18px;
    border: 2px solid rgba(149, 39, 245, 0.2);
    border-top-color: #9527F5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;

  spinnerContainer.appendChild(spinner);
  document.body.appendChild(spinnerContainer);

  return spinnerContainer;
}

/**
 * Create bookmark icon element for word span
 */
function createBookmarkIcon(): HTMLElement {
  const bookmarkIcon = document.createElement('div');
  bookmarkIcon.className = 'word-explanation-bookmark-icon';
  bookmarkIcon.style.cssText = `
    position: absolute;
    top: -8px;
    left: -8px;
    width: 16px;
    height: 16px;
    z-index: 1;
    pointer-events: none;
  `;
  
  // Create SVG bookmark icon
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', '#9527F5');
  svg.style.cssText = 'width: 100%; height: 100%;';
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z');
  path.setAttribute('fill', '#9527F5');
  
  svg.appendChild(path);
  bookmarkIcon.appendChild(svg);
  
  return bookmarkIcon;
}

/**
 * Create reusable green close button component for word span
 * Size is 3/4 of original (15px instead of 20px)
 */
function createWordSpanCloseButton(wordId: string): HTMLElement {
  const closeButton = document.createElement('button');
  closeButton.className = 'word-explanation-close-button';
  closeButton.setAttribute('aria-label', 'Remove word explanation');
  closeButton.style.cssText = `
    position: absolute;
    top: -6px;
    right: -6px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 1px solid rgba(0, 200, 0, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    z-index: 2;
  `;
  
  // Create SVG X icon (9px instead of 12px - 3/4 size)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '9');
  svg.setAttribute('height', '9');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'rgba(0, 200, 0, 0.8)');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.cssText = 'width: 100%; height: 100%;';
  
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '18');
  line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6');
  line1.setAttribute('y2', '18');
  
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '6');
  line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18');
  line2.setAttribute('y2', '18');
  
  svg.appendChild(line1);
  svg.appendChild(line2);
  closeButton.appendChild(svg);
  
  // Add click handler
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeWordExplanation(wordId);
  });
  
  return closeButton;
}

/**
 * Show purple xplaino icon when word is removed via double-click
 */
function showPurpleXplainoIconForWordRemoval(wordSpanElement: HTMLElement, _wordId: string): void {
  const rect = wordSpanElement.getBoundingClientRect();
  const iconUrl = chrome.runtime.getURL('src/assets/icons/xplaino-purple-icon.ico');
  
  // Create icon container
  const iconContainer = document.createElement('div');
  iconContainer.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2 - 14}px;
    top: ${rect.top + rect.height / 2 - 14}px;
    width: 28px;
    height: 28px;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: word-explanation-icon-fade-out 0.5s ease-out forwards;
  `;
  
  // Create icon image
  const iconImg = document.createElement('img');
  iconImg.src = iconUrl;
  iconImg.style.cssText = `
    width: 28px;
    height: 28px;
    object-fit: contain;
  `;
  
  iconContainer.appendChild(iconImg);
  document.body.appendChild(iconContainer);
  
  // Remove icon after animation
  setTimeout(() => {
    if (iconContainer.parentNode) {
      iconContainer.remove();
    }
  }, 500);
  
  // Add fade-out animation if not already in styles
  if (!document.getElementById('xplaino-word-icon-fade-animation')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'xplaino-word-icon-fade-animation';
    styleElement.textContent = `
      @keyframes word-explanation-icon-fade-out {
        0% {
          opacity: 1;
          transform: scale(1);
        }
        100% {
          opacity: 0;
          transform: scale(0.8);
        }
      }
    `;
    document.head.appendChild(styleElement);
  }
}

/**
 * Apply green styling and decorations to word span
 */
function applyGreenWordSpanStyling(wordSpanElement: HTMLElement, wordId: string, isSaved: boolean): void {
  // Ensure position is relative for absolute positioning of icons
  if (wordSpanElement.style.position !== 'relative' && wordSpanElement.style.position !== 'absolute') {
    wordSpanElement.style.position = 'relative';
  }
  
  // Add green border and border-radius
  wordSpanElement.style.border = '1px solid rgba(0, 200, 0, 0.5)';
  wordSpanElement.style.borderRadius = '12px';
  
  // Remove existing bookmark icon and close button if they exist
  const existingBookmark = wordSpanElement.querySelector('.word-explanation-bookmark-icon');
  if (existingBookmark) {
    existingBookmark.remove();
  }
  const existingClose = wordSpanElement.querySelector('.word-explanation-close-button');
  if (existingClose) {
    existingClose.remove();
  }
  
  // Add bookmark icon if word is saved
  if (isSaved) {
    const bookmarkIcon = createBookmarkIcon();
    wordSpanElement.appendChild(bookmarkIcon);
  }
  
  // Always add close button
  const closeButton = createWordSpanCloseButton(wordId);
  wordSpanElement.appendChild(closeButton);
}

/**
 * Inject word span animation styles into main page DOM
 * (only needs to be done once)
 */
let wordSpanStylesInjected = false;

function injectWordSpanStyles(): void {
  if (wordSpanStylesInjected) return;
  
  const styleId = 'xplaino-word-span-styles';
  if (document.getElementById(styleId)) {
    wordSpanStylesInjected = true;
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = `
    @keyframes word-explanation-scale-bounce {
      0%, 40%, 80%, 100% {
        transform: scale(1);
      }
      20%, 60% {
        transform: scale(1.05);
      }
    }
    
    @keyframes word-explanation-pulsate-purple {
      0%, 100% {
        background-color: rgba(149, 39, 245, 0.1);
      }
      50% {
        background-color: rgba(149, 39, 245, 0.25);
      }
    }
    
    .word-explanation-loading {
      animation: word-explanation-pulsate-purple 1.5s ease-in-out infinite;
      border-radius: 12px;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(styleElement);
  wordSpanStylesInjected = true;
  console.log('[Content Script] Word span styles injected into main DOM');
}

/**
 * Toggle word popover visibility
 */
function toggleWordPopover(wordId: string): void {
  const state = wordExplanationsMap.get(wordId);
  if (!state) return;

  state.popoverVisible = !state.popoverVisible;
  
  if (state.popoverVisible) {
    injectWordExplanationPopover();
  }
  
  updateWordExplanationPopover();
}

/**
 * Remove word explanation (span, spinner, popover)
 */
function removeWordExplanation(wordId: string): void {
  const state = wordExplanationsMap.get(wordId);
  if (!state) return;

  // Remove spinner
  if (state.spinnerElement) {
    state.spinnerElement.remove();
  }

  // Unwrap word span (restore original text)
  if (state.wordSpanElement) {
    const parent = state.wordSpanElement.parentNode;
    if (parent) {
      // Move all child nodes out of the span
      while (state.wordSpanElement.firstChild) {
        parent.insertBefore(state.wordSpanElement.firstChild, state.wordSpanElement);
      }
      // Remove the span
      parent.removeChild(state.wordSpanElement);
    }
  }

  // Remove from map
  wordExplanationsMap.delete(wordId);

  // Update or remove popover
  if (wordExplanationsMap.size === 0) {
    removeWordExplanationPopover();
  } else {
    updateWordExplanationPopover();
  }
}

/**
 * Handler for "Get more examples" utility button
 */
async function handleGetMoreExamples(wordId: string): Promise<void> {
  console.log('[Content Script] handleGetMoreExamples called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Set loading state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    isLoadingExamples: true,
  };
  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordExplanationPopover();

  // Call API
  await MoreExamplesService.getMoreExamples(
    {
      word: wordAtomState.word,
      meaning: wordAtomState.meaning,
      examples: wordAtomState.examples,
    },
    {
      onSuccess: (response) => {
        console.log('[Content Script] More examples received:', response);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          examples: response.examples,
          shouldAllowFetchMoreExamples: response.shouldAllowFetchMoreExamples,
          isLoadingExamples: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        
        // Update local state streamedContent with new examples
        const localState = wordExplanationsMap.get(wordId);
        if (localState) {
          const examplesText = response.examples.map((ex, i) => `${i + 1}. ${ex}`).join('\n');
          localState.streamedContent = `**${wordAtomState.meaning}**\n\n#### Examples:\n${examplesText}`;
        }
        
        updateWordExplanationPopover();
      },
      onError: (code: string, message: string) => {
        console.error('[Content Script] More examples error:', code, message);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingExamples: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        showToast(message || 'Failed to fetch more examples', 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required for more examples');
        store.set(showLoginModalAtom, true);
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingExamples: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required for more examples');
        store.set(showSubscriptionModalAtom, true);
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingExamples: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
    }
  );
}

/**
 * Handler for "Get contextual meaning" button when no explanation exists
 * Re-triggers the initial word explanation API
 */
async function handleGetContextualMeaning(wordId: string): Promise<void> {
  console.log('[Content Script] handleGetContextualMeaning called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Set loading state and ensure we're on contextual tab
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    isLoading: true,
    errorMessage: null,
    streamedContent: '',
    firstEventReceived: false,
    activeTab: 'contextual', // Ensure we're on contextual tab
  };
  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  
  // Also update local state's activeTab, isLoading, and streamedContent
  const localState = wordExplanationsMap.get(wordId);
  if (localState) {
    localState.activeTab = 'contextual';
    localState.isLoading = true;
    localState.streamedContent = '';
    localState.firstEventReceived = false;
    localState.errorMessage = null;
  }
  
  updateWordExplanationPopover();

  // Create abort controller
  const abortController = new AbortController();
  const updatedWithAbort: WordExplanationAtomState = {
    ...updatedState,
    abortController,
  };
  const mapWithAbort = new Map(store.get(wordExplanationsAtom));
  mapWithAbort.set(wordId, updatedWithAbort);
  store.set(wordExplanationsAtom, mapWithAbort);

  // Set 30-second timeout
  const timeoutId = setTimeout(() => {
    const currentState = store.get(wordExplanationsAtom).get(wordId);
    if (currentState && !currentState.firstEventReceived && currentState.isLoading) {
      console.log('[Content Script] Word explanation timeout - no response after 30 seconds');
      
      // Abort request
      abortController?.abort();
      
      // Update state with error
      const errorState: WordExplanationAtomState = {
        ...currentState,
        isLoading: false,
        errorMessage: 'Request timed out. Please try again.',
      };
      const errorMap = new Map(store.get(wordExplanationsAtom));
      errorMap.set(wordId, errorState);
      store.set(wordExplanationsAtom, errorMap);
      updateWordExplanationPopover();
      
      showToast('Request timed out after 30 seconds. Please try again.', 'error');
    }
  }, 30000);

  // Extract surrounding context for the word (7 words before + word + 7 words after)
  const contextText = extractSurroundingContext(wordAtomState.word, wordAtomState.range);
  console.log('[Content Script] Extracted context for API:', contextText);

  // Call words_explanation_v2 API
  await WordsExplanationV2Service.explainWord(
    wordAtomState.word,
    contextText, // Pass surrounding context instead of empty string
    {
      onEvent: (wordInfo: WordInfo) => {
        const state = store.get(wordExplanationsAtom).get(wordId);
        if (!state) return;

        console.log('[Content Script] Word explanation event:', wordInfo);

        // Parse raw_response to get meaning and examples
        const { meaning, examples } = WordsExplanationV2Service.parseRawResponse(
          wordInfo.raw_response
        );

        // Format content as markdown
        let formattedContent = meaning;
        if (examples.length > 0) {
          formattedContent += '\n\n#### Examples:\n';
          examples.forEach((example, idx) => {
            formattedContent += `${idx + 1}. ${example}\n`;
          });
        }

        // On first event
        if (!state.firstEventReceived) {
          clearTimeout(timeoutId);
          
          // Update atom state with meaning and examples
          const updated: WordExplanationAtomState = {
            ...state,
            meaning,
            examples,
            streamedContent: formattedContent,
            isLoading: false,
            firstEventReceived: true,
            shouldAllowFetchMoreExamples: true,
            activeTab: 'contextual', // Ensure we're on contextual tab
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          
          // Also update local state's streamedContent, activeTab, and isLoading
          const localState = wordExplanationsMap.get(wordId);
          if (localState) {
            localState.streamedContent = formattedContent;
            localState.activeTab = 'contextual';
            localState.isLoading = false;
            localState.firstEventReceived = true;
            localState.errorMessage = null;
          }
          
          updateWordExplanationPopover();
        } else {
          // Subsequent events (streaming updates)
          const updated: WordExplanationAtomState = {
            ...state,
            meaning,
            examples,
            streamedContent: formattedContent,
            activeTab: 'contextual', // Ensure we're on contextual tab
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          
          // Also update local state's streamedContent and activeTab
          const localState = wordExplanationsMap.get(wordId);
          if (localState) {
            localState.streamedContent = formattedContent;
            localState.activeTab = 'contextual';
          }
          
          updateWordExplanationPopover();
        }
      },
      onError: (code: string, message: string) => {
        clearTimeout(timeoutId);
        console.error('[Content Script] Word explanation error:', code, message);
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Abort the ongoing API call
        if (currentState.abortController) {
          currentState.abortController.abort();
        }

        // Reset state to show the button again (no content, not loading, button visible)
        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoading: false,
          streamedContent: '',
          firstEventReceived: false,
          errorMessage: null,
          abortController: null,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        
        // Also update local state to reset it
        const localState = wordExplanationsMap.get(wordId);
        if (localState) {
          localState.isLoading = false;
          localState.streamedContent = '';
          localState.firstEventReceived = false;
          localState.errorMessage = null;
          localState.abortController = null;
        }
        
        updateWordExplanationPopover();
        
        showToast(message || 'Failed to fetch explanation', 'error');
      },
      onComplete: () => {
        console.log('[Content Script] Word explanation streaming complete');
        clearTimeout(timeoutId);
      },
      onSubscriptionRequired: () => {
        clearTimeout(timeoutId);
        console.log('[Content Script] Subscription required for word explanation');
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Abort the ongoing API call
        if (currentState.abortController) {
          currentState.abortController.abort();
        }

        // Reset state to show the button again
        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoading: false,
          streamedContent: '',
          firstEventReceived: false,
          errorMessage: null,
          abortController: null,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        
        // Also update local state to reset it
        const localState = wordExplanationsMap.get(wordId);
        if (localState) {
          localState.isLoading = false;
          localState.streamedContent = '';
          localState.firstEventReceived = false;
          localState.errorMessage = null;
          localState.abortController = null;
        }
        
        updateWordExplanationPopover();
        
        store.set(showSubscriptionModalAtom, true);
      },
      onLoginRequired: () => {
        clearTimeout(timeoutId);
        console.log('[Content Script] Login required for word explanation');
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Abort the ongoing API call
        if (currentState.abortController) {
          currentState.abortController.abort();
        }

        // Reset state to show the button again
        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoading: false,
          streamedContent: '',
          firstEventReceived: false,
          errorMessage: null,
          abortController: null,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        
        // Also update local state to reset it
        const localState = wordExplanationsMap.get(wordId);
        if (localState) {
          localState.isLoading = false;
          localState.streamedContent = '';
          localState.firstEventReceived = false;
          localState.errorMessage = null;
          localState.abortController = null;
        }
        
        updateWordExplanationPopover();
        
        // Login modal will be shown by global handler
      },
    },
    abortController.signal
  );
}

/**
 * Handler for "Get synonyms" utility button
 */
async function handleGetSynonyms(wordId: string): Promise<void> {
  console.log('[Content Script] handleGetSynonyms called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Set loading state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    isLoadingSynonyms: true,
  };
  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordExplanationPopover();

  // Call API
  await WordSynonymsService.getSynonyms(
    { words: [wordAtomState.word] },
    {
      onSuccess: (response) => {
        console.log('[Content Script] Synonyms received:', response);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Extract synonyms array from first word result
        const synonymsList = response.synonyms.length > 0 ? response.synonyms[0].synonyms : [];

        const updated: WordExplanationAtomState = {
          ...currentState,
          synonyms: synonymsList,
          isLoadingSynonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onError: (code: string, message: string) => {
        console.error('[Content Script] Synonyms error:', code, message);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingSynonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        // Show user-friendly message for "Not found" errors
        const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
          ? 'Synonyms do not exist for this word'
          : (message || 'Failed to fetch synonyms');
        showToast(displayMessage, 'error');
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required for word synonyms');
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingSynonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        store.set(showSubscriptionModalAtom, true);
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required for word synonyms - stopping loading state');
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Stop loading state silently (no error toast)
        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingSynonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        // Login modal will be shown by global handler
      },
    }
  );
}

/**
 * Handler for "Get antonyms" utility button
 */
async function handleGetAntonyms(wordId: string): Promise<void> {
  console.log('[Content Script] handleGetAntonyms called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Set loading state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    isLoadingAntonyms: true,
  };
  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordExplanationPopover();

  // Call API
  await WordAntonymsService.getAntonyms(
    { words: [wordAtomState.word] },
    {
      onSuccess: (response) => {
        console.log('[Content Script] Antonyms received:', response);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Extract antonyms array from first word result
        const antonymsList = response.antonyms.length > 0 ? response.antonyms[0].antonyms : [];

        const updated: WordExplanationAtomState = {
          ...currentState,
          antonyms: antonymsList,
          isLoadingAntonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onError: (code: string, message: string) => {
        console.error('[Content Script] Antonyms error:', code, message);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingAntonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        // Show user-friendly message for "Not found" errors
        const displayMessage = code === 'NOT_FOUND' || (typeof message === 'string' && message.toLowerCase().includes('not found'))
          ? 'Opposite does not exist for this word'
          : (message || 'Failed to fetch antonyms');
        showToast(displayMessage, 'error');
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required for word antonyms');
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingAntonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        store.set(showSubscriptionModalAtom, true);
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required for word antonyms - stopping loading state');
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        // Stop loading state silently (no error toast)
        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingAntonyms: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        // Login modal will be shown by global handler
      },
    }
  );
}

/**
 * Handler for "Translate" utility button
 */
async function handleTranslateWord(wordId: string, _languageCode?: string): Promise<void> {
  console.log('[Content Script] handleTranslateWord called for wordId:', wordId);
  
  // Get target language from Chrome storage
  const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
  if (!nativeLanguage) {
    console.error('[Content Script] No native language set');
    showToast('Please set your native language in settings', 'error');
    return;
  }
  
  const targetLanguageCode = getLanguageCode(nativeLanguage);
  if (!targetLanguageCode) {
    console.error('[Content Script] Could not get language code for:', nativeLanguage);
    showToast('Invalid language setting', 'error');
    return;
  }
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Set loading state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    isLoadingTranslation: true,
  };
  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordExplanationPopover();

  // Call API with streaming
  const abortController = new AbortController();
  let streamedTranslation = '';

  await TranslateService.translate(
    {
      targetLangugeCode: targetLanguageCode, // Note: API uses "Languge" (typo)
      texts: [{ id: '1', text: wordAtomState.word }],
    },
    {
      onProgress: (index: number, translatedText: string) => {
        console.log('[Content Script] Translation progress:', { index, translatedText });
        streamedTranslation = translatedText;
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          translations: [{ language: nativeLanguage, translated_content: streamedTranslation }],
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onSuccess: (translatedTexts: string[]) => {
        console.log('[Content Script] Translation complete:', translatedTexts);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const finalTranslation = translatedTexts.length > 0 ? translatedTexts[0] : streamedTranslation;

        const updated: WordExplanationAtomState = {
          ...currentState,
          translations: [{ language: nativeLanguage, translated_content: finalTranslation }],
          isLoadingTranslation: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onLoginRequired: () => {
        console.log('[Content Script] Translation requires login');
        store.set(showLoginModalAtom, true);
        
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingTranslation: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
      },
      onError: (code: string, message: string) => {
        console.error('[Content Script] Translation error:', code, message);
        const currentState = store.get(wordExplanationsAtom).get(wordId);
        if (!currentState) return;

        const updated: WordExplanationAtomState = {
          ...currentState,
          isLoadingTranslation: false,
        };
        const map = new Map(store.get(wordExplanationsAtom));
        map.set(wordId, updated);
        store.set(wordExplanationsAtom, map);
        updateWordExplanationPopover();
        
        showToast(message || 'Failed to translate', 'error');
      },
    },
    abortController
  );
}

/**
 * Handler for "Ask AI" utility button - toggles Ask AI side panel
 */
function handleAskAI(wordId: string): void {
  console.log('[Content Script] handleAskAI called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  const isOpen = store.get(wordAskAISidePanelOpenAtom);
  const currentWordId = store.get(wordAskAISidePanelWordIdAtom);
  
  // If already open for this word, close it with animation
  if (isOpen && currentWordId === wordId) {
    console.log('[Content Script] Ask AI panel already open for this word, closing with animation');
    if (wordAskAICloseHandler) {
      wordAskAICloseHandler();
    } else {
      // Fallback: direct close if handler not registered yet
      handleAskAIClose();
    }
    return;
  }

  // Open Ask AI side panel
  store.set(wordAskAISidePanelOpenAtom, true);
  store.set(wordAskAISidePanelWordIdAtom, wordId);
  
  // Inject side panel
  injectWordAskAISidePanel();
  updateWordAskAISidePanel();
}

/**
 * Handler for Ask AI side panel close
 */
function handleAskAIClose(): void {
  console.log('[Content Script] handleAskAIClose called');
  
  // Close Ask AI side panel
  store.set(wordAskAISidePanelOpenAtom, false);
  store.set(wordAskAISidePanelWordIdAtom, null);
  
  // Remove side panel from DOM
  removeWordAskAISidePanel();
}

/**
 * Extract surrounding context for a word
 * Returns 7 words before + the word + 7 words after
 */
function extractSurroundingContext(word: string, range: Range | null): string {
  if (!range) {
    return `The word "${word}" in context.`;
  }

  try {
    // Get the parent element containing the text
    const container = range.commonAncestorContainer;
    const parentElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as Element;
    
    if (!parentElement) {
      return `The word "${word}" in context.`;
    }

    // Get all text content from the parent
    const fullText = parentElement.textContent || '';
    
    // Find the position of the selected word in the full text
    const rangeStart = range.startOffset;
    const rangeEnd = range.endOffset;
    
    // Calculate the actual position in the full text
    let currentOffset = 0;
    const walker = document.createTreeWalker(
      parentElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let foundNode = false;
    let textBeforeRange = '';
    let textAfterRange = '';
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      
      if (node === container) {
        foundNode = true;
        textBeforeRange = fullText.substring(0, currentOffset + rangeStart);
        textAfterRange = fullText.substring(currentOffset + rangeEnd);
        break;
      }
      
      currentOffset += node.textContent?.length || 0;
    }
    
    if (!foundNode) {
      // Fallback: use simple string split
      textBeforeRange = fullText.substring(0, fullText.indexOf(word));
      textAfterRange = fullText.substring(fullText.indexOf(word) + word.length);
    }
    
    // Split by whitespace to get words
    const wordsBefore = textBeforeRange.trim().split(/\s+/).filter(w => w.length > 0);
    const wordsAfter = textAfterRange.trim().split(/\s+/).filter(w => w.length > 0);
    
    // Take last 7 words before
    const contextBefore = wordsBefore.slice(-7).join(' ');
    
    // Take first 7 words after
    const contextAfter = wordsAfter.slice(0, 7).join(' ');
    
    // Construct the context
    const parts = [];
    if (contextBefore) parts.push(contextBefore);
    parts.push(word);
    if (contextAfter) parts.push(contextAfter);
    
    return parts.join(' ');
  } catch (error) {
    console.error('[Content Script] Error extracting surrounding context:', error);
    return `The word "${word}" in context.`;
  }
}

/**
 * Extract surrounding context for a text selection
 * Returns 15 words before + selected text + 15 words after
 */
function extractSurroundingContextForText(selectedText: string, range: Range | null): string {
  if (!range) {
    return selectedText;
  }

  try {
    // Get the parent element containing the text
    const container = range.commonAncestorContainer;
    const parentElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as Element;
    
    if (!parentElement) {
      return selectedText;
    }

    // Get all text content from the parent
    const fullText = parentElement.textContent || '';
    
    // Find the position of the selected text in the full text
    const rangeStart = range.startOffset;
    const rangeEnd = range.endOffset;
    
    // Calculate the actual position in the full text
    let currentOffset = 0;
    const walker = document.createTreeWalker(
      parentElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let foundNode = false;
    let textBeforeRange = '';
    let textAfterRange = '';
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      
      if (node === container) {
        foundNode = true;
        textBeforeRange = fullText.substring(0, currentOffset + rangeStart);
        textAfterRange = fullText.substring(currentOffset + rangeEnd);
        break;
      }
      
      currentOffset += node.textContent?.length || 0;
    }
    
    if (!foundNode) {
      // Fallback: use simple string split
      const selectedIndex = fullText.indexOf(selectedText);
      if (selectedIndex >= 0) {
        textBeforeRange = fullText.substring(0, selectedIndex);
        textAfterRange = fullText.substring(selectedIndex + selectedText.length);
      } else {
        return selectedText;
      }
    }
    
    // Split by whitespace to get words
    const wordsBefore = textBeforeRange.trim().split(/\s+/).filter(w => w.length > 0);
    const wordsAfter = textAfterRange.trim().split(/\s+/).filter(w => w.length > 0);
    
    // Take last 15 words before
    const contextBefore = wordsBefore.slice(-15).join(' ');
    
    // Take first 15 words after
    const contextAfter = wordsAfter.slice(0, 15).join(' ');
    
    // Construct the context
    const parts = [];
    if (contextBefore) parts.push(contextBefore);
    parts.push(selectedText);
    if (contextAfter) parts.push(contextAfter);
    
    return parts.join(' ');
  } catch (error) {
    console.error('[Content Script] Error extracting surrounding context for text:', error);
    return selectedText;
  }
}

/**
 * Handler for Ask AI send message
 */
async function handleAskAISendMessage(wordId: string, question: string): Promise<void> {
  console.log('[Content Script] handleAskAISendMessage called:', { wordId, question });
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Add user message to chat history
  const userMessage: ChatMessage = {
    role: 'user',
    content: question.trim(),
  };

  const updatedChatHistory = [...wordAtomState.askAI.chatHistory, userMessage];

  // Update state to show user message and set requesting state
  let updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    askAI: {
      ...wordAtomState.askAI,
      chatHistory: updatedChatHistory,
      streamingText: '',
      isRequesting: true,
      firstChunkReceived: false,
    },
  };
  let newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordAskAISidePanel();

  // Create abort controller
  const abortController = new AbortController();
  updatedState.askAI.abortController = abortController;

  // Get context for the word: extract 7 words before + word + 7 words after
  const contextText = extractSurroundingContext(wordAtomState.word, wordAtomState.range);
  
  // Format initial context with word of interest
  const initialContext = `Here is the context: ${contextText}. Here is the word of interest: ${wordAtomState.word}.`;
  console.log('[Content Script] Formatted initial context for Ask AI:', initialContext);

  try {
    await WordAskService.ask(
      {
        question: question.trim(),
        chat_history: wordAtomState.askAI.chatHistory, // Send old history (without new user message)
        initial_context: initialContext,
        context_type: 'TEXT',
      },
      {
        onChunk: (_chunk, accumulated) => {
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;

          const updated: WordExplanationAtomState = {
            ...currentState,
            askAI: {
              ...currentState.askAI,
              streamingText: accumulated,
              firstChunkReceived: true,
            },
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          updateWordAskAISidePanel();
        },
        onComplete: (updatedChatHistory, questions) => {
          console.log('[Content Script] Ask AI complete:', { updatedChatHistory, questions });
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;

          // Calculate the index of the assistant message (last message in the updated history)
          const assistantMessageIndex = updatedChatHistory.length - 1;
          
          // Update messageQuestions with the new questions for this message
          const updatedMessageQuestions = {
            ...currentState.askAI.messageQuestions,
          };
          if (questions && questions.length > 0) {
            updatedMessageQuestions[assistantMessageIndex] = questions;
          }

          const updated: WordExplanationAtomState = {
            ...currentState,
            askAI: {
              ...currentState.askAI,
              chatHistory: updatedChatHistory,
              streamingText: '',
              messageQuestions: updatedMessageQuestions,
              isRequesting: false,
              abortController: null,
            },
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          updateWordAskAISidePanel();
        },
        onError: (errorCode, errorMessage) => {
          console.error('[Content Script] Ask AI error:', errorCode, errorMessage);
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;

          const updated: WordExplanationAtomState = {
            ...currentState,
            askAI: {
              ...currentState.askAI,
              streamingText: '',
              isRequesting: false,
              abortController: null,
            },
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          updateWordAskAISidePanel();
          
          showToast(errorMessage || 'Failed to get AI response', 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required for Ask AI');
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;

          const updated: WordExplanationAtomState = {
            ...currentState,
            askAI: {
              ...currentState.askAI,
              streamingText: '',
              isRequesting: false,
              abortController: null,
            },
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          updateWordAskAISidePanel();
          
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required for Ask AI');
          const currentState = store.get(wordExplanationsAtom).get(wordId);
          if (!currentState) return;

          const updated: WordExplanationAtomState = {
            ...currentState,
            askAI: {
              ...currentState.askAI,
              streamingText: '',
              isRequesting: false,
              abortController: null,
            },
          };
          const map = new Map(store.get(wordExplanationsAtom));
          map.set(wordId, updated);
          store.set(wordExplanationsAtom, map);
          updateWordAskAISidePanel();
          
          store.set(showSubscriptionModalAtom, true);
        },
      },
      abortController
    );
  } catch (error) {
    console.error('[Content Script] Ask AI exception:', error);
    const currentState = store.get(wordExplanationsAtom).get(wordId);
    if (!currentState) return;

    const updated: WordExplanationAtomState = {
      ...currentState,
      askAI: {
        ...currentState.askAI,
        streamingText: '',
        isRequesting: false,
        abortController: null,
      },
    };
    const map = new Map(store.get(wordExplanationsAtom));
    map.set(wordId, updated);
    store.set(wordExplanationsAtom, map);
    updateWordAskAISidePanel();
    
    showToast('An error occurred', 'error');
  }
}

/**
 * Handler for stopping Ask AI request
 */
function handleAskAIStopRequest(wordId: string): void {
  console.log('[Content Script] handleAskAIStopRequest called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Abort the ongoing request
  if (wordAtomState.askAI.abortController) {
    console.log('[Content Script] Aborting Ask AI request');
    wordAtomState.askAI.abortController.abort();
  }

  // Save accumulated streaming text to chat history if it exists
  let updatedChatHistory = wordAtomState.askAI.chatHistory;
  if (wordAtomState.askAI.streamingText.trim()) {
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: wordAtomState.askAI.streamingText.trim(),
    };
    updatedChatHistory = [...wordAtomState.askAI.chatHistory, assistantMessage];
  }

  // Reset requesting state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    askAI: {
      ...wordAtomState.askAI,
      chatHistory: updatedChatHistory,
      streamingText: '',
      isRequesting: false,
      abortController: null,
    },
  };

  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordAskAISidePanel();
}

/**
 * Handler for clearing Ask AI chat
 */
function handleAskAIClearChat(wordId: string): void {
  console.log('[Content Script] handleAskAIClearChat called for wordId:', wordId);
  
  const wordAtomState = store.get(wordExplanationsAtom).get(wordId);
  if (!wordAtomState) {
    console.error('[Content Script] No atom state found for wordId:', wordId);
    return;
  }

  // Reset chat state
  const updatedState: WordExplanationAtomState = {
    ...wordAtomState,
    askAI: {
      ...wordAtomState.askAI,
      chatHistory: [],
      streamingText: '',
      messageQuestions: {},
      isRequesting: false,
      abortController: null,
    },
  };

  const newMap = new Map(store.get(wordExplanationsAtom));
  newMap.set(wordId, updatedState);
  store.set(wordExplanationsAtom, newMap);
  updateWordAskAISidePanel();
}

/**
 * Toggle text explanation panel open/closed for a specific explanation
 * If clicking same explanation ID: toggle panel (close if open, open if closed)
 * If clicking different ID: close current panel, set new active ID, open new panel
 */
async function toggleTextExplanationPanel(explanationId: string): Promise<void> {
  const activeId = store.get(activeTextExplanationIdAtom);
  const panelOpen = store.get(textExplanationPanelOpenAtom);
  
  if (explanationId === activeId) {
    // Same explanation: toggle panel
    if (panelOpen) {
      // Closing - use animated close handler if available
      if (textExplanationPanelCloseHandler) {
        console.log('[index.ts] Calling animated close handler from icon toggle');
        textExplanationPanelCloseHandler();
      } else {
        // Fallback: direct close if handler not registered yet
        console.warn('[index.ts] Close handler not available, using direct close');
        store.set(textExplanationPanelOpenAtom, false);
        updateTextExplanationPanel();
        updateTextExplanationIconContainer();
      }
    } else {
      // Opening - close side panel first if it's open
      if (sidePanelOpen) {
        console.log('[Content Script] Closing side panel before opening text explanation panel');
        setSidePanelOpen(false);
        // Wait for slide animation to complete (300ms duration)
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      
      store.set(textExplanationPanelOpenAtom, true);
      updateTextExplanationPanel();
      updateTextExplanationIconContainer();
    }
  } else {
    // Different explanation: close current, switch to new, open panel
    if (activeId) {
      // Abort any in-progress request for previous active explanation
      const explanations = store.get(textExplanationsAtom);
      const previousExplanation = explanations.get(activeId);
      if (previousExplanation?.abortController) {
        previousExplanation.abortController.abort();
      }
    }
    
    // Close side panel first if it's open
    if (sidePanelOpen) {
      console.log('[Content Script] Closing side panel before opening text explanation panel');
      setSidePanelOpen(false);
      // Wait for slide animation to complete (300ms duration)
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    
    store.set(activeTextExplanationIdAtom, explanationId);
    store.set(textExplanationPanelOpenAtom, true);
    updateTextExplanationPanel();
    updateTextExplanationIconContainer();
  }
}

// Stable callback functions to prevent infinite re-renders
let handleQuestionClickCallback: ((question: string) => Promise<void>) | null = null;
let handleInputSubmitCallback: ((inputText: string) => Promise<void>) | null = null;
let handleViewModeChangeCallback: ((mode: 'contextual' | 'translation') => void) | null = null;
let handleCloseCallback: (() => void) | null = null;
let handleSimplifyCallback: (() => Promise<void>) | null = null;
let handleTranslateCallback: ((language: string) => Promise<void>) | null = null;

// Store reference to panel's close handler for animated close from icon toggle
let textExplanationPanelCloseHandler: (() => void) | null = null;

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
  
  // Get active explanation from atom
  const activeExplanation = store.get(activeTextExplanationAtom);
  const panelOpen = store.get(textExplanationPanelOpenAtom);
  
  // If no active explanation or panel is closed, hide the panel
  if (!activeExplanation || !panelOpen) {
    textExplanationPanelRoot.render(React.createElement(React.Fragment));
    isUpdatingPanel = false;
    return;
  }
  
  const streamingText = activeExplanation.streamingText || '';
  const possibleQuestions = activeExplanation.possibleQuestions || [];
  const shouldAllowSimplifyMore = activeExplanation.shouldAllowSimplifyMore || false;
  const pendingQuestion = activeExplanation.pendingQuestion;
  const firstChunkReceived = activeExplanation.firstChunkReceived || false;
  const translations = activeExplanation.translations || [];
  
  // Get chat history for current explanation
  const explanationId = activeExplanation.id;
  const chatMessages = textExplanationChatHistory.get(explanationId) || [];
  const messageQuestions = textExplanationMessageQuestions.get(explanationId) || {};
  
  // Check if simplify is in progress (has abortController, no first chunk yet, and it's actually a Simplify request)
  const isSimplifying = !!activeExplanation.abortController && !activeExplanation.firstChunkReceived && shouldAllowSimplifyMore && activeExplanation.isSimplifyRequest === true;
  
  // isTranslating is tracked globally for translation API calls
  
  // Check if content is empty (no chat messages, no streaming text) - hide header icons if empty
  const hasContent = chatMessages.length > 0 || streamingText.trim().length > 0;
  const showHeaderIcons = hasContent;
  
  // Calculate if delete icon should be shown (only when there's simplified explanations or translations)
  const showDeleteIcon = chatMessages.length > 0 || translations.length > 0;
  
  // Create clear chat handler
  const handleClearChatCallback = () => {
    if (explanationId) {
      textExplanationChatHistory.delete(explanationId);
      textExplanationMessageQuestions.delete(explanationId);
      updateExplanationInMap(explanationId, (state) => {
        state.streamingText = '';
        state.possibleQuestions = [];
        // Clear abortController and pendingQuestion to prevent loading dots from showing
        if (state.abortController) {
          state.abortController.abort();
          state.abortController = null;
        }
        state.pendingQuestion = undefined;
        state.firstChunkReceived = false;
        // Clear simplified explanation state so Simplify button starts fresh
        state.previousSimplifiedTexts = [];
        state.simplifiedExplanationCount = 0;
        // Reset shouldAllowSimplifyMore - if we cleared chat, we should allow simplifying the original text again
        state.shouldAllowSimplifyMore = true;
        return state;
      });
      updateTextExplanationPanel();
    }
  };

  // Create stop request handler
  const handleStopRequestCallback = () => {
    const currentActiveExplanation = store.get(activeTextExplanationAtom);
    if (!currentActiveExplanation) return;
    
    const currentExplanationId = currentActiveExplanation.id;
    const currentStreamingText = currentActiveExplanation.streamingText;
    const pendingQuestion = currentActiveExplanation.pendingQuestion;
    
    // Abort the current request
    updateExplanationInMap(currentExplanationId, (state) => {
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }
      
      // If we have received some streaming text, save it to chat history
      if (currentStreamingText && currentStreamingText.trim().length > 0 && state.firstChunkReceived && pendingQuestion) {
        // Get current chat history
        if (!textExplanationChatHistory.has(currentExplanationId)) {
          textExplanationChatHistory.set(currentExplanationId, []);
        }
        const currentChatHistory = textExplanationChatHistory.get(currentExplanationId)!;
        const updatedChatHistory = [...currentChatHistory];
        
        // Add the user message if not already present
        const lastMessage = updatedChatHistory[updatedChatHistory.length - 1];
        if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== pendingQuestion) {
          updatedChatHistory.push({ role: 'user', content: pendingQuestion });
        }
        
        // Add the partial assistant response
        updatedChatHistory.push({ role: 'assistant', content: currentStreamingText });
        
        textExplanationChatHistory.set(currentExplanationId, updatedChatHistory);
      }
      
      // Clear streaming state
      state.streamingText = '';
      state.firstChunkReceived = false;
      state.possibleQuestions = [];
      state.pendingQuestion = undefined;
      state.isSimplifyRequest = undefined; // Clear simplify request flag
      
      return state;
    });
    
    updateTextExplanationPanel();
  };

  // Check if a request is in progress
  // Request is in progress if there's an abortController (regardless of firstChunkReceived)
  const isRequesting = !!activeExplanation.abortController;
  
  // Create stable callbacks if they don't exist
  if (!handleCloseCallback) {
    handleCloseCallback = () => {
      store.set(textExplanationPanelOpenAtom, false);
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
      const currentActiveExplanation = store.get(activeTextExplanationAtom);
      if (!currentActiveExplanation) return;
      
      const explanationId = currentActiveExplanation.id;
      const selectedText = currentActiveExplanation.selectedText;
      
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
      const newAbortController = new AbortController();
      updateExplanationInMap(explanationId, (state) => {
        if (state.abortController) {
          state.abortController.abort();
        }
        state.abortController = newAbortController;
        state.streamingText = '';
        state.firstChunkReceived = false;
        state.possibleQuestions = []; // Clear previous questions to prevent duplicates
        state.pendingQuestion = question; // Store the question for stop handler
        state.isSimplifyRequest = false; // This is an Ask request, not Simplify
        return state;
      });
      
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
              updateExplanationInMap(explanationId, (state) => {
                state.streamingText = accumulated;
                if (!state.firstChunkReceived) {
                  state.firstChunkReceived = true;
                }
                return state;
              });
              updateTextExplanationPanel();
            },
            onComplete: (updatedChatHistory, questions) => {
              // Get current chat history (already has user message)
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
                const currentState = store.get(textExplanationsAtom).get(explanationId);
                const pendingQuestion = currentState?.pendingQuestion;
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
              updateExplanationInMap(explanationId, (state) => {
                state.streamingText = '';
                state.possibleQuestions = questions || [];
                state.pendingQuestion = undefined; // Clear pending question
                state.abortController = null;
                state.firstChunkReceived = false;
                state.isSimplifyRequest = undefined; // Clear simplify request flag
                return state;
              });
              
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Question error:', errorCode, errorMsg);
              // Clear abort controller on error as well
              updateExplanationInMap(explanationId, (state) => {
                state.abortController = null;
                state.firstChunkReceived = false;
                state.isSimplifyRequest = undefined; // Clear simplify request flag
                return state;
              });
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
      const currentActiveExplanation = store.get(activeTextExplanationAtom);
      if (!currentActiveExplanation) return;
      
      const explanationId = currentActiveExplanation.id;
      const selectedText = currentActiveExplanation.selectedText;
      
      // Validate that selectedText is not empty
      if (!selectedText || selectedText.trim() === '') {
        console.error('[Content Script] No selected text available for simplify');
        showToast('Error: No text available for simplify', 'error');
        return;
      }
      
      const previousSimplifiedTexts = currentActiveExplanation.previousSimplifiedTexts || [];
      const textStartIndex = currentActiveExplanation.textStartIndex;
      const range = currentActiveExplanation.range;
      
      // Extract surrounding context for the text (15 words before + text + 15 words after)
      const contextText = extractSurroundingContextForText(selectedText, range);
      console.log('[Content Script] Extracted context for Simplify More API:', contextText);
      
      // Calculate textLength as the length of the contextText being sent to the API
      const textLength = contextText.length;
      
      // Abort current request if any
      const newAbortController = new AbortController();
      updateExplanationInMap(explanationId, (state) => {
        if (state.abortController) {
          state.abortController.abort();
        }
        state.abortController = newAbortController;
        state.streamingText = '';
        state.firstChunkReceived = false;
        state.possibleQuestions = [];
        state.isSimplifyRequest = true; // This is a Simplify request
        return state;
      });
      
      // Update panel to show loading state
      updateTextExplanationPanel();
      
      try {
        await SimplifyService.simplify(
          [
            {
              textStartIndex,
              textLength,
              text: contextText, // Pass surrounding context instead of just selected text
              previousSimplifiedTexts: previousSimplifiedTexts,
            },
          ],
          {
            onChunk: (_chunk, accumulated) => {
              let shouldConvertUnderline = false;
              let underlineStateToConvert: UnderlineState | null = null;
              
              updateExplanationInMap(explanationId, (state) => {
                state.streamingText = accumulated;
                if (!state.firstChunkReceived) {
                  state.firstChunkReceived = true;
                  
                  // Check if this is a bookmark-created explanation with purple underline
                  if (state.paragraphId && state.underlineState) {
                    // Check if underline is purple by examining the wrapper element
                    const wrapper = state.underlineState.wrapperElement;
                    const currentColor = wrapper.style.textDecorationColor;
                    if (currentColor.includes('149, 39, 245') || currentColor.includes('9527F5')) {
                      shouldConvertUnderline = true;
                      underlineStateToConvert = state.underlineState;
                    }
                  }
                }
                return state;
              });
              
              // Convert purple underline to green if needed
              if (shouldConvertUnderline && underlineStateToConvert) {
                console.log('[Content Script] Converting purple underline to green after first Simplify response');
                changeUnderlineColor(underlineStateToConvert, 'green');
              }
              
              updateTextExplanationPanel();
            },
            onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
              // Get current chat history
              if (!textExplanationChatHistory.has(explanationId)) {
                textExplanationChatHistory.set(explanationId, []);
              }
              const chatHistory = textExplanationChatHistory.get(explanationId)!;
              
              updateExplanationInMap(explanationId, (state) => {
                // Increment simplified explanation count
                state.simplifiedExplanationCount += 1;
                const explanationNumber = state.simplifiedExplanationCount;
                
                // Create message with heading "Simplified explanation N"
                const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${simplifiedText}`;
                
                // Add new simplified explanation as a new message (don't replace previous ones)
                chatHistory.push({ role: 'assistant', content: messageWithHeading });
                
                // Update state
                state.shouldAllowSimplifyMore = shouldAllowSimplifyMore;
                state.previousSimplifiedTexts = [...previousSimplifiedTexts, simplifiedText];
                state.streamingText = '';
                state.possibleQuestions = possibleQuestions || [];
                state.abortController = null;
                state.firstChunkReceived = false;
                state.isSimplifyRequest = undefined; // Clear simplify request flag
                
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
                
                return state;
              });
              
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Simplify error:', errorCode, errorMsg);
            },
            onLoginRequired: () => {
              store.set(showLoginModalAtom, true);
            },
            onSubscriptionRequired: () => {
              console.log('[Content Script] Subscription required for text explanation (simplify)');
              
              // Clear loading state
              updateExplanationInMap(explanationId, (state) => {
                state.abortController = null;
                state.firstChunkReceived = false;
                state.isSimplifyRequest = undefined;
                state.streamingText = '';
                return state;
              });
              
              updateTextExplanationPanel();
              
              // Show subscription modal
              store.set(showSubscriptionModalAtom, true);
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
      const currentActiveExplanation = store.get(activeTextExplanationAtom);
      if (!currentActiveExplanation || !inputText.trim()) return;
      
      const explanationId = currentActiveExplanation.id;
      const selectedText = currentActiveExplanation.selectedText;
      
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
      const newAbortController = new AbortController();
      updateExplanationInMap(explanationId, (state) => {
        if (state.abortController) {
          state.abortController.abort();
        }
        state.abortController = newAbortController;
        state.streamingText = '';
        state.firstChunkReceived = false;
        state.possibleQuestions = [];
        state.isSimplifyRequest = false; // This is an Ask request, not Simplify
        return state;
      });
      
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
              updateExplanationInMap(explanationId, (state) => {
                state.streamingText = accumulated;
                if (!state.firstChunkReceived) {
                  state.firstChunkReceived = true;
                }
                return state;
              });
              updateTextExplanationPanel();
            },
            onComplete: (updatedChatHistory, questions) => {
              // Get current chat history (already has user message)
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
              updateExplanationInMap(explanationId, (state) => {
                state.streamingText = '';
                state.possibleQuestions = questions || [];
                state.pendingQuestion = undefined; // Clear pending question
                state.abortController = null;
                state.firstChunkReceived = false;
                state.isSimplifyRequest = undefined; // Clear simplify request flag
                return state;
              });
              
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
  
  if (!handleTranslateCallback) {
    handleTranslateCallback = async (selectedLanguage?: string) => {
      const currentActiveExplanation = store.get(activeTextExplanationAtom);
      if (!currentActiveExplanation) return;
      
      const explanationId = currentActiveExplanation.id;
      const selectedText = currentActiveExplanation.selectedText;
      
      // Validate that selectedText is not empty
      if (!selectedText || selectedText.trim() === '') {
        console.error('[Content Script] No selected text available for translation');
        showToast('Error: No text available for translation', 'error');
        return;
      }
      
      // Use language from dropdown instead of Chrome storage
      if (!selectedLanguage) {
        console.error('[Content Script] No language selected from dropdown');
        showToast('Please select a language from the dropdown', 'error');
        return;
      }
      
      const languageCode = getLanguageCode(selectedLanguage);
      if (!languageCode) {
        console.error('[Content Script] Could not get language code for:', selectedLanguage);
        showToast('Invalid language selected', 'error');
        return;
      }
      
      // Check if translation already exists for this language
      const currentState = store.get(textExplanationsAtom).get(explanationId);
      if (currentState) {
        const existingTranslation = currentState.translations.find(
          t => t.language === selectedLanguage
        );
        if (existingTranslation) {
          console.log('[Content Script] Translation already exists for language:', selectedLanguage);
          return;
        }
      }
      
      // Create abort controller for the translation request
      const abortController = new AbortController();
      
      // Set translating state to true
      isTranslating = true;
      
      // Update panel to show loading state
      updateTextExplanationPanel();
      
      try {
        // Generate unique ID for the translation request
        const textItem: TranslateTextItem = {
          id: `translate_${Date.now()}`,
          text: selectedText
        };

        await TranslateService.translate(
          {
            targetLangugeCode: languageCode,
            texts: [textItem],
          },
          {
            onProgress: (_index, translatedText) => {
              // For single text translation, update immediately as soon as translation arrives
              console.log('[Content Script] Translation received, updating UI immediately');
              
              updateExplanationInMap(explanationId, (state) => {
                state.translations.push({
                  language: selectedLanguage,
                  translated_content: translatedText,
                });
                return state;
              });
              
              // Set translating state to false
              isTranslating = false;
              
              updateTextExplanationPanel();
            },
            onSuccess: (_translatedTexts) => {
              // This is called after onProgress, so we may have already updated
              // Just ensure translating state is false
              isTranslating = false;
              updateTextExplanationPanel();
            },
            onError: (errorCode, errorMsg) => {
              console.error('[Content Script] Translation error:', errorCode, errorMsg);
              // Set translating state to false on error
              isTranslating = false;
              updateTextExplanationPanel();
            },
            onLoginRequired: () => {
              // Set translating state to false
              isTranslating = false;
              store.set(showLoginModalAtom, true);
              updateTextExplanationPanel();
            },
            onSubscriptionRequired: () => {
              console.log('[Content Script] Translation requires subscription (text panel)');
              // Set translating state to false
              isTranslating = false;
              store.set(showSubscriptionModalAtom, true);
              updateTextExplanationPanel();
            },
          },
          abortController
        );
      } catch (error) {
        console.error('[Content Script] Translation exception:', error);
        // Set translating state to false on exception
        isTranslating = false;
        updateTextExplanationPanel();
      }
    };
  }
  
  // Create handlers for header actions
  const handleRemoveCallback = () => {
    removeTextExplanation(explanationId);
  };

  const handleViewOriginalCallback = () => {
    if (!activeExplanation) {
      console.log('[Content Script] No text explanation state available for view original');
      return;
    }
    scrollToAndHighlightText(activeExplanation.range, activeExplanation.underlineState);
    // Pulse the background color three times with green
    if (activeExplanation.underlineState) {
      pulseTextBackground(activeExplanation.underlineState);
    }
  };

  const handleBookmarkCallback = () => {
    if (!activeExplanation) {
      console.log('[Content Script] No active explanation for bookmark');
      return;
    }

    // If already bookmarked, remove bookmark
    if (activeExplanation.paragraphId) {
      handleRemoveTextExplanationBookmark(explanationId, activeExplanation.paragraphId);
      return;
    }

    // Get the selected text from the active explanation
    const text = activeExplanation.selectedText?.trim() || '';
    
    if (!text) {
      console.warn('[Content Script] Empty text for bookmark');
      showToast('No text to bookmark', 'error');
      return;
    }

    console.log('[Content Script] Bookmark clicked for text explanation:', text);
    
    // Store the range for later use (to add underline and icons after save)
    if (activeExplanation.range) {
      folderModalRange = activeExplanation.range.cloneRange();
    }
    
    // Get folders and show modal
    FolderService.getAllFolders(
      'PARAGRAPH',
      {
        onSuccess: async (response) => {
          console.log('[Content Script] Folders loaded successfully:', response.folders.length, 'folders');
          folderModalFolders = response.folders;
          folderModalText = text;
          folderModalSourceUrl = window.location.href;
          
          // Check for stored preference folder ID
          const storedFolderId = await ChromeStorage.getParagraphBookmarkPreferenceFolderId();
          if (storedFolderId && findFolderInTree(response.folders, storedFolderId)) {
            folderModalSelectedFolderId = storedFolderId;
            console.log('[Content Script] Auto-selected preferred folder:', storedFolderId);
          } else {
            folderModalSelectedFolderId = null;
            console.log('[Content Script] No valid preferred folder found, clearing selection');
          }
          
          folderModalOpen = true;
          injectFolderListModal();
          updateFolderListModal();
        },
        onError: (errorCode, message) => {
          console.error('[Content Script] Failed to load folders:', errorCode, message);
          showToast(`Failed to load folders: ${message}`, 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required to load folders');
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required to load folders');
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  };

  try {
    textExplanationPanelRoot.render(
      React.createElement(Provider, { store },
      React.createElement(TextExplanationSidePanel, {
        isOpen: panelOpen,
        useShadowDom: true,
        onClose: handleCloseCallback,
        iconRef: activeExplanation.iconRef,
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
        showDeleteIcon,
        pendingQuestion,
        firstChunkReceived,
        translations,
        onTranslate: handleTranslateCallback,
        isTranslating,
        isBookmarked: !!activeExplanation.paragraphId,
        onCloseHandlerReady: (handler) => {
          console.log('[index.ts] Close handler registered from TextExplanationSidePanel');
          textExplanationPanelCloseHandler = handler;
        },
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
    zIndex: 2147483643, // Below main side panel
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

// =============================================================================
// WORD EXPLANATION POPOVER
// =============================================================================

/**
 * Inject Word Explanation Popover into the page with Shadow DOM
 */
function injectWordExplanationPopover(): void {
  console.log('[Content Script] injectWordExplanationPopover called');
  
  if (shadowHostExists(WORD_EXPLANATION_POPOVER_HOST_ID)) {
    console.log('[Content Script] Word explanation popover host already exists, updating');
    updateWordExplanationPopover();
    return;
  }

  console.log('[Content Script] Creating new word explanation popover shadow host');
  const hostResult = createShadowHost({ 
    id: WORD_EXPLANATION_POPOVER_HOST_ID,
    zIndex: 2147483640,
  });

  // Inject styles
  injectStyles(hostResult.shadow, wordExplanationPopoverStyles);

  // Add spin keyframe animation (needed for spinner)
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulsate-purple {
      0%, 100% { background-color: rgba(149, 39, 245, 0.1); }
      50% { background-color: rgba(149, 39, 245, 0.25); }
    }
    @keyframes scale-bounce {
      0%, 40%, 80%, 100% { transform: scale(1); }
      20%, 60% { transform: scale(1.05); }
    }
  `;
  hostResult.shadow.appendChild(styleSheet);

  // Append host to document body (THIS WAS MISSING!)
  document.body.appendChild(hostResult.host);
  console.log('[Content Script] Word explanation popover host appended to body');

  // Render React component
  wordExplanationPopoverRoot = ReactDOM.createRoot(hostResult.mountPoint);
  console.log('[Content Script] Word explanation popover root created');
  updateWordExplanationPopover();
}

/**
 * Handle bookmark icon click for saving/unsaving words
 */
async function handleWordBookmarkClick(wordId: string): Promise<void> {
  console.log('[Content Script] handleWordBookmarkClick called for wordId:', wordId);
  
  const atomState = store.get(wordExplanationsAtom).get(wordId);
  if (!atomState) {
    console.warn('[Content Script] No atom state found for wordId:', wordId);
    return;
  }
  
  const newExplanations = new Map(store.get(wordExplanationsAtom));
  
  if (atomState.isSaved) {
    // Unsave the word
    console.log('[Content Script] Unsaving word:', atomState.word, 'with savedWordId:', atomState.savedWordId);
    newExplanations.set(wordId, { ...atomState, isSavingWord: true });
    store.set(wordExplanationsAtom, newExplanations);
    updateWordExplanationPopover();
    
    SavedWordsService.removeSavedWord(
      atomState.savedWordId!,
      {
        onSuccess: () => {
          console.log('[Content Script] Word removed from saved list successfully');
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSaved: false, savedWordId: null, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
            
            // Update bookmark icon on word span
            const localState = wordExplanationsMap.get(wordId);
            if (localState?.wordSpanElement) {
              applyGreenWordSpanStyling(localState.wordSpanElement, wordId, false);
            }
          }
          showToast('Word removed from saved list', 'success');
        },
        onError: (_code, message) => {
          console.error('[Content Script] Failed to remove word:', message);
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          showToast(`Failed to remove word: ${message}`, 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required to remove saved word');
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required to remove saved word');
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  } else {
    // Save the word
    console.log('[Content Script] Saving word:', atomState.word);
    const contextualMeaning = atomState.meaning || atomState.streamedContent;
    console.log('[Content Script] Contextual meaning:', contextualMeaning ? contextualMeaning.substring(0, 100) : 'null');
    
    newExplanations.set(wordId, { ...atomState, isSavingWord: true });
    store.set(wordExplanationsAtom, newExplanations);
    updateWordExplanationPopover();
    
    SavedWordsService.saveWord(
      {
        word: atomState.word,
        sourceUrl: window.location.href,
        contextual_meaning: contextualMeaning || null,
      },
      {
        onSuccess: (response) => {
          console.log('[Content Script] Word saved successfully with id:', response.id);
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSaved: true, savedWordId: response.id, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
            
            // Update bookmark icon on word span
            const localState = wordExplanationsMap.get(wordId);
            if (localState?.wordSpanElement) {
              applyGreenWordSpanStyling(localState.wordSpanElement, wordId, true);
            }
          }
          showToast('Word saved successfully!', 'success');
        },
        onError: (_code, message) => {
          console.error('[Content Script] Failed to save word:', message);
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          showToast(`Failed to save word: ${message}`, 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required to save word');
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required to save word');
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  }
}

/**
 * Update Word Explanation Popover state
 */
function updateWordExplanationPopover(): void {
  console.log('[Content Script] updateWordExplanationPopover called');
  
  if (!wordExplanationPopoverRoot) {
    console.warn('[Content Script] wordExplanationPopoverRoot is null, cannot update');
    return;
  }

  // Find the first visible word explanation (we only show one popover at a time)
  let visibleWordState: WordExplanationLocalState | null = null;
  let visibleWordId: string | null = null;

  console.log('[Content Script] Searching for visible word explanation in map, size:', wordExplanationsMap.size);
  for (const [wordId, state] of wordExplanationsMap.entries()) {
    console.log('[Content Script] Checking wordId:', wordId, 'popoverVisible:', state.popoverVisible);
    if (state.popoverVisible) {
      visibleWordState = state;
      visibleWordId = wordId;
      break;
    }
  }

  if (!visibleWordState || !visibleWordId) {
    // No visible popover
    console.log('[Content Script] No visible word explanation found, rendering empty fragment');
    wordExplanationPopoverRoot.render(React.createElement(React.Fragment));
    return;
  }

  console.log('[Content Script] Found visible word explanation:', {
    wordId: visibleWordId,
    word: visibleWordState.word,
    content: visibleWordState.streamedContent.substring(0, 50) + '...',
    isLoading: visibleWordState.isLoading,
    sourceRef: visibleWordState.sourceRef.current,
  });

  // Handler for tab change
  // Get atom state for this word
  const atomState = store.get(wordExplanationsAtom).get(visibleWordId);

  const handleTabChange = (tab: TabType) => {
    const state = wordExplanationsMap.get(visibleWordId!);
    if (state) {
      state.activeTab = tab;
      updateWordExplanationPopover();
    }
    // Also update atom state
    if (atomState) {
      const updated: WordExplanationAtomState = { ...atomState, activeTab: tab };
      const map = new Map(store.get(wordExplanationsAtom));
      map.set(visibleWordId!, updated);
      store.set(wordExplanationsAtom, map);
    }
  };

  // Handler for close
  const handleClose = () => {
    const state = wordExplanationsMap.get(visibleWordId!);
    if (state) {
      state.popoverVisible = false;
      updateWordExplanationPopover();
    }
  };

  // Render popover
  console.log('[Content Script] Rendering WordExplanationPopover component with props:', {
    word: visibleWordState.word,
    visible: visibleWordState.popoverVisible,
    contentLength: visibleWordState.streamedContent.length,
    activeTab: visibleWordState.activeTab,
    isLoading: visibleWordState.isLoading,
    hasSourceRef: !!visibleWordState.sourceRef.current,
    atomState: atomState ? {
      synonymsCount: atomState.synonyms.length,
      antonymsCount: atomState.antonyms.length,
      translationsCount: atomState.translations.length,
    } : null,
  });
  
  wordExplanationPopoverRoot.render(
    React.createElement(
      Provider,
      { store },
      React.createElement(WordExplanationPopover, {
        word: visibleWordState.word,
        sourceRef: visibleWordState.sourceRef,
        visible: visibleWordState.popoverVisible,
        content: visibleWordState.streamedContent,
        activeTab: visibleWordState.activeTab,
        onTabChange: handleTabChange,
        onClose: handleClose,
        useShadowDom: true,
        isLoading: visibleWordState.isLoading,
        errorMessage: visibleWordState.errorMessage || undefined,
        // Data from atoms
        synonyms: atomState?.synonyms || [],
        antonyms: atomState?.antonyms || [],
        translations: atomState?.translations || [],
        shouldAllowFetchMoreExamples: atomState?.shouldAllowFetchMoreExamples ?? true,
        // Loading states from atoms
        isLoadingExamples: atomState?.isLoadingExamples || false,
        isLoadingSynonyms: atomState?.isLoadingSynonyms || false,
        isLoadingAntonyms: atomState?.isLoadingAntonyms || false,
        isLoadingTranslation: atomState?.isLoadingTranslation || false,
        // Bookmark/Save state
        isSaved: atomState?.isSaved || false,
        isSavingWord: atomState?.isSavingWord || false,
        onBookmarkClick: () => handleWordBookmarkClick(visibleWordId!),
        // Handlers
        onGetContextualMeaning: () => handleGetContextualMeaning(visibleWordId!),
        onGetMoreExamples: () => handleGetMoreExamples(visibleWordId!),
        onGetSynonyms: () => handleGetSynonyms(visibleWordId!),
        onGetAntonyms: () => handleGetAntonyms(visibleWordId!),
        onTranslate: () => handleTranslateWord(visibleWordId!),
        onAskAI: () => handleAskAI(visibleWordId!),
        onAskAIButtonMount: (ref) => {
          // Store the button ref in state for positioning
          const currentState = store.get(wordExplanationsAtom).get(visibleWordId!);
          if (currentState) {
            const updated: WordExplanationAtomState = {
              ...currentState,
              askAIButtonRef: ref,
            };
            const map = new Map(store.get(wordExplanationsAtom));
            map.set(visibleWordId!, updated);
            store.set(wordExplanationsAtom, map);
          }
        },
      })
    )
  );
  
  console.log('[Content Script] WordExplanationPopover rendered');
}

/**
 * Remove Word Explanation Popover from the page
 */
function removeWordExplanationPopover(): void {
  removeShadowHost(WORD_EXPLANATION_POPOVER_HOST_ID, wordExplanationPopoverRoot);
  wordExplanationPopoverRoot = null;
}

/**
 * Inject Word Ask AI Side Panel into the page with Shadow DOM
 */
function injectWordAskAISidePanel(): void {
  console.log('[Content Script] injectWordAskAISidePanel called');
  
  if (shadowHostExists(WORD_ASK_AI_PANEL_HOST_ID)) {
    console.log('[Content Script] Word Ask AI side panel host already exists, updating');
    updateWordAskAISidePanel();
    return;
  }

  console.log('[Content Script] Creating new Word Ask AI side panel shadow host');
  const hostResult = createShadowHost({ 
    id: WORD_ASK_AI_PANEL_HOST_ID,
    zIndex: 2147483642,
  });

  // Inject styles
  injectStyles(hostResult.shadow, wordAskAISidePanelStyles);

  // Append host to document body
  document.body.appendChild(hostResult.host);
  console.log('[Content Script] Word Ask AI side panel host appended to body');

  // Render React component
  wordAskAISidePanelRoot = ReactDOM.createRoot(hostResult.mountPoint);
  console.log('[Content Script] Word Ask AI side panel root created');
  updateWordAskAISidePanel();
}

/**
 * Update Word Ask AI Side Panel state
 */
function updateWordAskAISidePanel(): void {
  console.log('[Content Script] updateWordAskAISidePanel called');
  
  if (!wordAskAISidePanelRoot) {
    console.warn('[Content Script] wordAskAISidePanelRoot is null, cannot update');
    return;
  }

  const isOpen = store.get(wordAskAISidePanelOpenAtom);
  const wordId = store.get(wordAskAISidePanelWordIdAtom);

  if (!isOpen || !wordId) {
    console.log('[Content Script] Side panel closed or no word ID, rendering empty fragment');
    wordAskAISidePanelRoot.render(React.createElement(React.Fragment));
    return;
  }

  // Get atom state for this word
  const atomState = store.get(wordExplanationsAtom).get(wordId);
  if (!atomState) {
    console.warn('[Content Script] No atom state found for wordId:', wordId);
    wordAskAISidePanelRoot.render(React.createElement(React.Fragment));
    return;
  }

  console.log('[Content Script] Rendering WordAskAISidePanel for word:', atomState.word);

  wordAskAISidePanelRoot.render(
    React.createElement(
      Provider,
      { store },
      React.createElement(WordAskAISidePanel, {
        isOpen: isOpen,
        onClose: handleAskAIClose,
        word: atomState.word,
        buttonRef: atomState.askAIButtonRef,
        useShadowDom: true,
        chatHistory: atomState.askAI.chatHistory,
        messageQuestions: atomState.askAI.messageQuestions,
        streamingText: atomState.askAI.streamingText,
        isRequesting: atomState.askAI.isRequesting,
        onSendMessage: (question) => handleAskAISendMessage(wordId, question),
        onStopRequest: () => handleAskAIStopRequest(wordId),
        onClearChat: () => handleAskAIClearChat(wordId),
        onCloseHandlerReady: (handler) => {
          console.log('[index.ts] Close handler registered from WordAskAISidePanel');
          wordAskAICloseHandler = handler;
        },
      })
    )
  );
  
  console.log('[Content Script] WordAskAISidePanel rendered');
}

/**
 * Remove Word Ask AI Side Panel from the page
 */
function removeWordAskAISidePanel(): void {
  removeShadowHost(WORD_ASK_AI_PANEL_HOST_ID, wordAskAISidePanelRoot);
  wordAskAISidePanelRoot = null;
}

/**
 * Update text explanation icon container
 */
function updateTextExplanationIconContainer(): void {
  if (!textExplanationIconRoot) return;
  
  const explanations = store.get(textExplanationsAtom);
  const activeId = store.get(activeTextExplanationIdAtom);
  const panelOpen = store.get(textExplanationPanelOpenAtom);
  
  // If no explanations, don't render anything (but keep root for future use)
  if (explanations.size === 0) {
    textExplanationIconRoot.render(React.createElement(React.Fragment));
    return;
  }
  
  // Create icons for all explanations
  const icons = Array.from(explanations.entries()).map(([id, state]) => {
    const iconData = {
      id: state.id,
      position: state.iconPosition,
      selectionRange: state.range,
      isSpinning: state.isSpinning,
      onTogglePanel: () => toggleTextExplanationPanel(id),
      // Green border logic: only show border if this is the active explanation AND panel is open
      isPanelOpen: id === activeId && panelOpen,
      isBookmarked: !!state.paragraphId,
      onBookmarkClick: state.paragraphId ? () => {
        if (state.paragraphId) {
          handleRemoveTextExplanationBookmark(id, state.paragraphId);
        }
      } : undefined,
      iconRef: (element: HTMLElement | null) => {
        if (state.iconRef) {
          state.iconRef.current = element;
        }
      },
    };
    
    // Debug logging for bookmarked icons
    if (iconData.isBookmarked) {
      console.log('[Content Script] Creating bookmarked icon:', {
        id: iconData.id,
        isSpinning: iconData.isSpinning,
        position: iconData.position,
        hasRange: !!iconData.selectionRange,
      });
    }
    
    return iconData;
  });
  
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
function removeTextExplanation(explanationId: string): void {
  const explanations = store.get(textExplanationsAtom);
  const explanation = explanations.get(explanationId);
  
  if (!explanation) {
    console.log('[Content Script] No text explanation state to remove');
    return;
  }

  // Remove underline from text
  if (explanation.underlineState) {
    removeTextUnderline(explanation.underlineState);
  }

  // Remove from map
  const newMap = new Map(explanations);
  newMap.delete(explanationId);
  store.set(textExplanationsAtom, newMap);

  // If this was the active explanation, clear active ID and close panel
  const activeId = store.get(activeTextExplanationIdAtom);
  if (explanationId === activeId) {
    store.set(activeTextExplanationIdAtom, null);
    store.set(textExplanationPanelOpenAtom, false);
    removeTextExplanationPanel();
  }

  // Update icon container (will hide if no explanations left)
  updateTextExplanationIconContainer();

  // If no explanations left, remove icon container
  if (newMap.size === 0) {
    removeTextExplanationIconContainer();
  }

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
// TOAST INJECTION
// =============================================================================

/**
 * Show a toast message
 */
function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  console.log('[Content Script] Showing toast:', message, type);
  
  // Clear any existing timeout
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
  
  toastMessage = message;
  toastType = type;
  toastClosing = false;
  injectToast();
  updateToast();
  
  // Auto-hide after 3 seconds with slide-out animation
  toastTimeoutId = setTimeout(() => {
    // Trigger slide-out animation
    toastClosing = true;
    updateToast();
    
    // Wait for animation to complete (300ms) before clearing
    setTimeout(() => {
      toastMessage = null;
      toastClosing = false;
      updateToast();
      toastTimeoutId = null;
    }, 300);
  }, 3000);
}

/**
 * Inject Toast into the page with Shadow DOM
 */
function injectToast(): void {
  // Check if already injected
  if (shadowHostExists(TOAST_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: TOAST_HOST_ID,
    zIndex: 2147483648, // Highest z-index for toast
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject inline toast styles (since we don't have a separate toast shadow CSS)
  const toastStyles = `
    @keyframes slideIn {
      from {
        transform: translateX(calc(100% + 20px));
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(calc(100% + 20px));
        opacity: 0;
      }
    }
    
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      pointer-events: auto;
    }
    
    .toast-closing {
      animation: slideOut 0.3s ease-in forwards;
    }
  `;
  injectStyles(shadow, toastStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  toastRoot = ReactDOM.createRoot(mountPoint);
  updateToast();

  console.log('[Content Script] Toast injected successfully');
}

/**
 * Update toast visibility based on state
 */
function updateToast(): void {
  if (!toastRoot) {
    console.warn('[Content Script] toastRoot is null, cannot update toast');
    return;
  }

  if (toastMessage) {
    console.log('[Content Script] Rendering toast with message:', toastMessage, 'closing:', toastClosing);
    
    // Create a simple div-based toast instead of using the Toast component
    // because CSS modules don't work well in Shadow DOM
    const toastElement = React.createElement(
      'div',
      {
        className: 'toast-container',
        style: {
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2147483647,
        }
      },
      React.createElement(
        'div',
        {
          className: toastClosing ? 'toast-closing' : '',
          style: {
            background: 'white',
            border: toastType === 'error' ? '2px solid #ef4444' : '2px solid #10b981',
            color: toastType === 'error' ? '#ef4444' : '#10b981',
            padding: '0.75rem 1.5rem',
            borderRadius: '13px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '0.9375rem',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(149, 39, 245, 0.15)',
            animation: toastClosing ? 'slideOut 0.3s ease-in forwards' : 'slideIn 0.3s ease-out',
            whiteSpace: 'nowrap',
          }
        },
        toastMessage
      )
    );
    
    toastRoot.render(toastElement);
  } else {
    console.log('[Content Script] Clearing toast');
    toastRoot.render(React.createElement(React.Fragment));
  }
}

/**
 * Remove Toast from the page
 */
function removeToast(): void {
  removeShadowHost(TOAST_HOST_ID, toastRoot);
  toastRoot = null;
  console.log('[Content Script] Toast removed');
}

// =============================================================================
// FOLDER LIST MODAL INJECTION
// =============================================================================

/**
 * Inject Folder List Modal into the page with Shadow DOM
 */
function injectFolderListModal(): void {
  // Check if already injected
  if (shadowHostExists(FOLDER_LIST_MODAL_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: FOLDER_LIST_MODAL_HOST_ID,
    zIndex: 2147483646, // Below toast
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject folder list modal styles
  injectStyles(shadow, folderListModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  folderListModalRoot = ReactDOM.createRoot(mountPoint);
  updateFolderListModal();

  console.log('[Content Script] Folder List Modal injected successfully');
}

/**
 * Update folder list modal visibility based on state
 */
async function updateFolderListModal(): Promise<void> {
  if (!folderListModalRoot) {
    console.warn('[Content Script] folderListModalRoot is null, cannot update modal');
    return;
  }

  if (folderModalOpen) {
    console.log('[Content Script] Rendering folder list modal with', folderModalFolders.length, 'folders');
    
    // Check if the selected folder matches the stored preference
    const storedFolderId = await ChromeStorage.getParagraphBookmarkPreferenceFolderId();
    const rememberFolderChecked = folderModalSelectedFolderId !== null && 
                                   folderModalSelectedFolderId === storedFolderId;
    // Update the tracked checkbox state
    folderModalRememberChecked = rememberFolderChecked;
    
    // Handler for remember folder checkbox change
    const handleRememberFolderChange = async (checked: boolean) => {
      folderModalRememberChecked = checked;
      // Don't save to storage here - wait until Save Text is clicked
      // This allows user to change checkbox state without immediately saving
      // Update modal to reflect the change
      updateFolderListModal();
    };
    
    folderListModalRoot.render(
      React.createElement(Provider, { store },
      React.createElement(FolderListModal, {
        folders: folderModalFolders,
        onSave: handleFolderModalSave,
        onClose: closeFolderListModal,
        useShadowDom: true,
        isSaving: folderModalSaving,
        onCreateFolder: handleCreateFolder,
        isCreatingFolder: folderModalCreatingFolder,
        initialSelectedFolderId: folderModalSelectedFolderId,
        initialExpandedFolders: folderModalExpandedFolders,
        rememberFolderChecked,
        onRememberFolderChange: handleRememberFolderChange,
      })
      )
    );
  } else {
    console.log('[Content Script] Clearing folder list modal');
    folderListModalRoot.render(React.createElement(React.Fragment));
  }
}

/**
 * Check if two ranges are the same (same start/end containers and offsets)
 */
function rangesMatch(range1: Range | null, range2: Range | null): boolean {
  if (!range1 || !range2) return false;
  return (
    range1.startContainer === range2.startContainer &&
    range1.startOffset === range2.startOffset &&
    range1.endContainer === range2.endContainer &&
    range1.endOffset === range2.endOffset
  );
}

/**
 * Handle save button click in folder modal
 */
async function handleFolderModalSave(folderId: string | null): Promise<void> {
  console.log('[Content Script] Saving text to folder:', folderId);
  
  // If "Remember my folder" checkbox is checked, save the folder preference
  if (folderModalRememberChecked && folderId) {
    await ChromeStorage.setParagraphBookmarkPreferenceFolderId(folderId);
    console.log('[Content Script] Saved folder preference on save:', folderId);
  } else if (!folderModalRememberChecked) {
    // If checkbox is unchecked, remove the preference
    await ChromeStorage.removeParagraphBookmarkPreferenceFolderId();
    console.log('[Content Script] Removed folder preference on save');
  }
  
  // Set saving state
  folderModalSaving = true;
  updateFolderListModal();
  
  // Save paragraph
  SavedParagraphService.saveParagraph(
    {
      content: folderModalText,
      source_url: folderModalSourceUrl,
      folder_id: folderId || undefined,
    },
    {
      onSuccess: (response) => {
        console.log('[Content Script] Text saved successfully with id:', response.id);
        showToast('Text saved successfully!', 'success');
        
        // Preserve folderModalText and folderModalRange before closing modal (which clears them)
        const savedText = folderModalText;
        const savedRange = folderModalRange;
        
        closeFolderListModal();
        
        // Add purple underline only after save succeeds
        let underlineState: UnderlineState | null = null;
        if (savedRange) {
          underlineState = addTextUnderline(savedRange, 'purple');
          console.log('[Content Script] Added purple underline after successful bookmark save');
        }
        
        // Check if we should update active explanation or create a new one
        const activeId = store.get(activeTextExplanationIdAtom);
        const activeExplanation = activeId ? store.get(activeTextExplanationAtom) : null;
        
        // Only update active explanation if the savedRange matches the active explanation's range
        // This means we're bookmarking from the panel (same text)
        // If ranges don't match, we're bookmarking a different text from ContentActions, so create new explanation
        if (activeId && activeExplanation && savedRange && rangesMatch(savedRange, activeExplanation.range)) {
          console.log('[Content Script] Updating active explanation with paragraphId:', response.id, 'for explanationId:', activeId, '(ranges match - bookmarking from panel)');
          updateExplanationInMap(activeId, (state) => {
            // Create a new state object to ensure Jotai detects the change
            return {
              ...state,
              paragraphId: response.id,
            };
          });
          
          // Verify the update was committed to the atom
          const updatedExplanations = store.get(textExplanationsAtom);
          const updatedState = updatedExplanations.get(activeId);
          console.log('[Content Script] Updated state paragraphId:', updatedState?.paragraphId);
          
          // Verify the derived atom has the updated state
          const verifiedActiveExplanation = store.get(activeTextExplanationAtom);
          if (verifiedActiveExplanation && verifiedActiveExplanation.paragraphId === response.id) {
            console.log('[Content Script] Confirmed active explanation has updated paragraphId');
          }
          
          // Update panel and icon container to show bookmark state
          // This will read the updated state from activeTextExplanationAtom
          updateTextExplanationPanel();
          updateTextExplanationIconContainer();
        } else if (savedRange && underlineState) {
          // Bookmark saved from ContentActions (different text) or no active explanation - create new text explanation state
          // This happens when:
          // 1. Bookmarking a different text selection from ContentActions (ranges don't match)
          // 2. No active explanation exists
          console.log('[Content Script] Creating new text explanation state from bookmark (ranges don\'t match or no active explanation)');
          
          // Validate that we have the selected text
          if (!savedText || savedText.trim() === '') {
            console.error('[Content Script] No text available for bookmark explanation');
            showToast('Error: No text available', 'error');
            return;
          }
          
          // Calculate icon position
          const selectionRect = savedRange.getBoundingClientRect();
          let containingElement: HTMLElement | null = null;
          let node: Node | null = savedRange.startContainer;
          
          while (node && node !== document.body) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              containingElement = node as HTMLElement;
              break;
            }
            node = node.parentNode;
          }
          
          if (!containingElement) {
            containingElement = document.body;
          }
          
          const elementRect = containingElement.getBoundingClientRect();
          const leftmostX = elementRect.left;
          const topmostY = selectionRect.top;
          
          const iconPosition = {
            x: leftmostX - 30,
            y: topmostY,
          };
          
          // Calculate textStartIndex and textLength
          const textStartIndex = calculateTextStartIndex(savedRange);
          const textLength = savedText.length;
          
          // Get current explanations
          const explanations = store.get(textExplanationsAtom);
          
          // Create new explanation state (without API call)
          const explanationId = `explanation-${Date.now()}`;
          const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
          
          const newExplanation: TextExplanationState = {
            id: explanationId,
            selectedText: savedText, // Use saved text instead of folderModalText which was cleared
            range: savedRange.cloneRange(),
            iconPosition,
            isSpinning: false, // No spinner since we're not calling API
            streamingText: '',
            underlineState: underlineState, // Use the purple underline we created after successful save
            abortController: null, // No active request, so buttons will be enabled
            firstChunkReceived: true, // Set to true so icon shows as green (not spinner) immediately
            iconRef,
            possibleQuestions: [],
            textStartIndex,
            textLength,
            shouldAllowSimplifyMore: true, // Show Simplify button
            previousSimplifiedTexts: [],
            simplifiedExplanationCount: 0,
            isSimplifyRequest: undefined, // Not a simplify request yet
            translations: [],
            paragraphId: response.id, // Mark as bookmarked
          };
          
          // Add to map
          const newMap = new Map(explanations);
          newMap.set(explanationId, newExplanation);
          store.set(textExplanationsAtom, newMap);
          
          // Set as active
          store.set(activeTextExplanationIdAtom, explanationId);
          
          // Reset view mode to contextual
          textExplanationViewMode = 'contextual';
          
          // Inject icon container and panel if not already injected
          injectTextExplanationIconContainer();
          injectTextExplanationPanel();
          
          // Log the explanation state for debugging
          console.log('[Content Script] Created new explanation from bookmark:', {
            id: explanationId,
            isSpinning: newExplanation.isSpinning,
            firstChunkReceived: newExplanation.firstChunkReceived,
            paragraphId: newExplanation.paragraphId,
            iconPosition: newExplanation.iconPosition,
            hasRange: !!newExplanation.range,
          });
          
          // Update icon container first to ensure iconRef is set
          updateTextExplanationIconContainer();
          
          // Force a re-render after a short delay to ensure DOM is ready
          setTimeout(() => {
            // Verify the explanation is in the atom
            const explanations = store.get(textExplanationsAtom);
            const createdExplanation = explanations.get(explanationId);
            console.log('[Content Script] Verification - explanation in atom:', {
              exists: !!createdExplanation,
              isSpinning: createdExplanation?.isSpinning,
              paragraphId: createdExplanation?.paragraphId,
            });
            
            // Update icon container again to ensure it renders
            updateTextExplanationIconContainer();
            
            // Use requestAnimationFrame to ensure iconRef is set before opening panel
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Verify iconRef is set before opening panel
                if (iconRef.current) {
                  console.log('[Content Script] IconRef is set, opening panel');
                } else {
                  console.warn('[Content Script] IconRef not set yet');
                }
                
                // Open panel
                store.set(textExplanationPanelOpenAtom, true);
                
                // Update panel
                updateTextExplanationPanel();
              });
            });
          }, 100);
          
          // Note: savedRange and savedText are local variables, no need to clear folderModalRange here
        } else {
          console.warn('[Content Script] No active explanation ID found when saving bookmark');
          
          // Add underline and icons if we have a range (fallback for saved paragraphs)
          if (folderModalRange) {
            addSavedParagraphIcons(response.id, folderModalText, folderModalRange);
            folderModalRange = null; // Clear the range after using it
          }
        }
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to save text:', errorCode, message);
        folderModalSaving = false;
        updateFolderListModal();
        showToast(`Failed to save text: ${message}`, 'error');
        // No underline to remove since it's only added after successful save
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to save text');
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to save text');
        closeFolderListModal();
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Handle create folder in folder modal
 */
async function handleCreateFolder(folderName: string, parentFolderId: string | null): Promise<void> {
  console.log('[Content Script] Creating folder:', folderName, 'with parent:', parentFolderId);
  
  // Set creating state
  folderModalCreatingFolder = true;
  updateFolderListModal();
  
  // Create folder
  SavedParagraphService.createParagraphFolder(
    {
      name: folderName,
      parent_folder_id: parentFolderId || undefined,
    },
    {
      onSuccess: (response) => {
        console.log('[Content Script] Folder created successfully with id:', response.id);
        
        // Add new folder to the list
        const newFolder: FolderWithSubFoldersResponse = {
          id: response.id,
          name: response.name,
          created_at: response.created_at,
          updated_at: response.updated_at,
          subFolders: [],
        };
        
        // Add to the appropriate location in the tree
        if (parentFolderId) {
          // Find and update the parent folder
          const updateFolderTree = (folders: FolderWithSubFoldersResponse[]): FolderWithSubFoldersResponse[] => {
            return folders.map(folder => {
              if (folder.id === parentFolderId) {
                // Add to this folder's subFolders
                return {
                  ...folder,
                  subFolders: [...folder.subFolders, newFolder]
                };
              } else if (folder.subFolders.length > 0) {
                // Recursively search in subFolders
                return {
                  ...folder,
                  subFolders: updateFolderTree(folder.subFolders)
                };
              }
              return folder;
            });
          };
          
          folderModalFolders = updateFolderTree(folderModalFolders);
          // Ensure parent folder is expanded so the new folder is visible
          folderModalExpandedFolders = new Set([...folderModalExpandedFolders, parentFolderId]);
        } else {
          // Add to root level
          folderModalFolders = [...folderModalFolders, newFolder];
        }
        
        folderModalCreatingFolder = false;
        folderModalSelectedFolderId = response.id; // Auto-select the newly created folder
        
        updateFolderListModal();
        showToast('Folder created successfully!', 'success');
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to create folder:', errorCode, message);
        folderModalCreatingFolder = false;
        updateFolderListModal();
        showToast(`Failed to create folder: ${message}`, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to create folder');
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to create folder');
        closeFolderListModal();
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Close folder list modal
 */
function closeFolderListModal(): void {
  // Note: No underline cleanup needed since underline is only added after successful save
  folderModalOpen = false;
  folderModalSaving = false;
  folderModalCreatingFolder = false;
  folderModalFolders = [];
  folderModalText = '';
  folderModalSourceUrl = '';
  folderModalSelectedFolderId = null;
  folderModalExpandedFolders = new Set();
  folderModalRememberChecked = false; // Reset checkbox state when modal closes
  // Don't clear folderModalRange here - it's used after modal closes
  // Note: folderModalUnderlineState is no longer used since underline is only added after successful save
  updateFolderListModal();
}

/**
 * Remove Folder List Modal from the page
 */
// @ts-ignore - Function reserved for future cleanup logic
function removeFolderListModal(): void {
  removeShadowHost(FOLDER_LIST_MODAL_HOST_ID, folderListModalRoot);
  folderListModalRoot = null;
  console.log('[Content Script] Folder List Modal removed');
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

/**
 * Apply blur effect to background components when login or subscription modal is visible
 */
function updateBackgroundBlur(): void {
  const isLoginModalVisible = store.get(showLoginModalAtom);
  const isSubscriptionModalVisible = store.get(showSubscriptionModalAtom);
  const isAnyModalVisible = isLoginModalVisible || isSubscriptionModalVisible;

  const hostIds = [
    WORD_EXPLANATION_POPOVER_HOST_ID,
    WORD_ASK_AI_PANEL_HOST_ID,
    SIDE_PANEL_HOST_ID,
    TEXT_EXPLANATION_PANEL_HOST_ID,
  ];

  hostIds.forEach((hostId) => {
    const host = document.getElementById(hostId);
    if (host) {
      if (isAnyModalVisible) {
        host.style.filter = 'blur(4px)';
        host.style.transition = 'filter 0.3s ease';
      } else {
        host.style.filter = 'none';
      }
    }
  });
}

// =============================================================================
// SUBSCRIPTION MODAL INJECTION
// =============================================================================

/**
 * Inject Subscription Modal into the page with Shadow DOM
 */
function injectSubscriptionModal(): void {
  // Check if already injected
  if (shadowHostExists(SUBSCRIPTION_MODAL_HOST_ID)) {
    console.log('[Content Script] Subscription Modal already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: SUBSCRIPTION_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index for modal
  });

  // Inject color CSS variables first
  injectStyles(shadow, FAB_COLOR_VARIABLES);
  
  // Inject component styles
  injectStyles(shadow, subscriptionModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  subscriptionModalRoot = ReactDOM.createRoot(mountPoint);
  subscriptionModalRoot.render(
    React.createElement(Provider, { store },
      React.createElement(SubscriptionModal, {
        useShadowDom: true,
      })
    )
  );

  console.log('[Content Script] Subscription Modal injected successfully');
}

/**
 * Remove Subscription Modal from the page
 */
function removeSubscriptionModal(): void {
  removeShadowHost(SUBSCRIPTION_MODAL_HOST_ID, subscriptionModalRoot);
  subscriptionModalRoot = null;
  console.log('[Content Script] Subscription Modal removed');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main content script logic
 */
async function initContentScript(): Promise<void> {
  // Initialize auth state before any component injection
  await initializeAuthState();
  
  const allowed = await isExtensionAllowed();
  
  if (allowed) {
    console.log('[Content Script] Running content script functionality...');
    injectFAB();
    injectSidePanel();
    injectContentActions();
    injectLoginModal();
    injectSubscriptionModal();
    injectToast();
  } else {
    console.log('[Content Script] Not running - extension not allowed on this page');
    removeFAB();
    removeSidePanel();
    removeContentActions();
    removeLoginModal();
    removeSubscriptionModal();
    removeTextExplanationPanel();
    removeTextExplanationIconContainer();
    removeToast();
  }
}

// Setup global auth listener (runs once at script initialization)
setupGlobalAuthListener();

// =============================================================================
// SAVED PARAGRAPH ICONS INJECTION
// =============================================================================

/**
 * Add saved paragraph icons and underline after successful save
 */
function addSavedParagraphIcons(paragraphId: string, selectedText: string, range: Range): void {
  console.log('[Content Script] Adding saved paragraph icons for paragraph:', paragraphId);
  
  // Calculate icon position
  const selectionRect = range.getBoundingClientRect();
  let containingElement: HTMLElement | null = null;
  let node: Node | null = range.startContainer;
  
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      containingElement = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }
  
  if (!containingElement) {
    containingElement = document.body;
  }
  
  const elementRect = containingElement.getBoundingClientRect();
  const leftmostX = elementRect.left;
  const topmostY = selectionRect.top;
  
  const iconPosition = {
    x: leftmostX - 30,
    y: topmostY,
  };
  
  // Add purple dashed underline for bookmarked text
  const underlineState = addTextUnderline(range, 'purple');
  
  // Create saved paragraph state
  const savedParagraphId = `saved-paragraph-${paragraphId}`;
  const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
  
  const savedParagraphState: SavedParagraphState = {
    id: savedParagraphId,
    paragraphId,
    selectedText,
    range: range.cloneRange(),
    iconPosition,
    underlineState,
    iconRef,
  };
  
  // Add to map
  savedParagraphs.set(savedParagraphId, savedParagraphState);
  
  // Inject icon container if not already injected
  injectSavedParagraphIconContainer();
  
  // Update icon container
  updateSavedParagraphIconContainer();
  
  // Clear text selection
  window.getSelection()?.removeAllRanges();
}

/**
 * Update saved paragraph icon container
 */
function updateSavedParagraphIconContainer(): void {
  if (!savedParagraphIconRoot) return;
  
  // If no saved paragraphs, don't render anything
  if (savedParagraphs.size === 0) {
    savedParagraphIconRoot.render(React.createElement(React.Fragment));
    return;
  }
  
  // Create icons for all saved paragraphs
  const icons = Array.from(savedParagraphs.entries()).map(([, state]) => ({
    id: state.id,
    position: state.iconPosition,
    selectionRange: state.range,
    onXplainoClick: () => {
      // Not used anymore - bookmark-only icons don't have xplaino button
    },
    onBookmarkClick: () => {
      handleRemoveSavedParagraph(state.paragraphId, state.id);
    },
    iconRef: (element: HTMLElement | null) => {
      if (state.iconRef) {
        state.iconRef.current = element;
      }
    },
  }));
  
  savedParagraphIconRoot.render(
    React.createElement(
      'div',
      { className: 'savedParagraphIconContainer' },
      icons.map((icon) =>
        React.createElement(SavedParagraphIcon, {
          key: icon.id,
          position: icon.position,
          onXplainoClick: icon.onXplainoClick,
          onBookmarkClick: icon.onBookmarkClick,
          useShadowDom: true,
          iconRef: icon.iconRef,
          selectionRange: icon.selectionRange,
        })
      )
    )
  );
}

/**
 * Inject Saved Paragraph Icon Container into the page with Shadow DOM
 */
function injectSavedParagraphIconContainer(): void {
  if (shadowHostExists(SAVED_PARAGRAPH_ICON_HOST_ID)) {
    updateSavedParagraphIconContainer();
    return;
  }

  const { host, shadow, mountPoint } = createShadowHost({
    id: SAVED_PARAGRAPH_ICON_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  injectStyles(shadow, FAB_COLOR_VARIABLES);
  injectStyles(shadow, savedParagraphIconStyles);

  document.body.appendChild(host);

  savedParagraphIconRoot = ReactDOM.createRoot(mountPoint);
  updateSavedParagraphIconContainer();

  console.log('[Content Script] Saved Paragraph Icon Container injected successfully');
}

/**
 * Remove Saved Paragraph Icon Container from the page
 * (Currently unused, but kept for potential cleanup needs)
 */
// @ts-expect-error - Function kept for potential future cleanup needs
function removeSavedParagraphIconContainer(): void {
  removeShadowHost(SAVED_PARAGRAPH_ICON_HOST_ID, savedParagraphIconRoot);
  savedParagraphIconRoot = null;
  console.log('[Content Script] Saved Paragraph Icon Container removed');
}

/**
 * Handle remove bookmark from text explanation
 */
async function handleRemoveTextExplanationBookmark(explanationId: string, paragraphId: string): Promise<void> {
  console.log('[Content Script] Removing bookmark from text explanation:', explanationId, paragraphId);
  
  // Call remove API
  SavedParagraphService.removeSavedParagraph(
    paragraphId,
    {
      onSuccess: () => {
        console.log('[Content Script] Bookmark removed successfully');
        
        // Clear paragraphId from explanation state
        updateExplanationInMap(explanationId, (state) => {
          // Create a new state object to ensure Jotai detects the change
          return {
            ...state,
            paragraphId: undefined,
          };
        });
        
        // Verify the update was committed to the atom
        const updatedExplanations = store.get(textExplanationsAtom);
        const updatedState = updatedExplanations.get(explanationId);
        console.log('[Content Script] Updated state paragraphId after removal:', updatedState?.paragraphId);
        
        // Verify the derived atom has the updated state
        const activeExplanation = store.get(activeTextExplanationAtom);
        if (activeExplanation && activeExplanation.id === explanationId && !activeExplanation.paragraphId) {
          console.log('[Content Script] Confirmed active explanation has cleared paragraphId');
        }
        
        // Update panel and icon container to reflect bookmark removal
        // This will read the updated state from activeTextExplanationAtom
        updateTextExplanationPanel();
        updateTextExplanationIconContainer();
        
        // Also remove from saved paragraphs if it exists there
        const savedParagraphId = `saved-paragraph-${paragraphId}`;
        const savedState = savedParagraphs.get(savedParagraphId);
        if (savedState) {
          // Remove underline
          if (savedState.underlineState) {
            removeTextUnderline(savedState.underlineState);
          }
          // Remove from map
          savedParagraphs.delete(savedParagraphId);
          // Update saved paragraph icon container
          updateSavedParagraphIconContainer();
        }
        
        // Show success toast
        showToast('Bookmark removed successfully!', 'success');
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to remove bookmark:', errorCode, message);
        showToast(`Failed to remove bookmark: ${message}`, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to remove bookmark');
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to remove bookmark');
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Handle remove saved paragraph
 */
async function handleRemoveSavedParagraph(paragraphId: string, savedParagraphId: string): Promise<void> {
  console.log('[Content Script] Removing saved paragraph:', paragraphId);
  
  const state = savedParagraphs.get(savedParagraphId);
  if (!state) {
    console.warn('[Content Script] Saved paragraph state not found:', savedParagraphId);
    return;
  }
  
  // Call remove API
  SavedParagraphService.removeSavedParagraph(
    paragraphId,
    {
      onSuccess: () => {
        console.log('[Content Script] Saved paragraph removed successfully');
        
        // Remove underline
        if (state.underlineState) {
          removeTextUnderline(state.underlineState);
        }
        
        // Remove from map
        savedParagraphs.delete(savedParagraphId);
        
        // Update icon container
        updateSavedParagraphIconContainer();
        
        // Show success toast
        showToast('Saved paragraph removed successfully!', 'success');
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to remove saved paragraph:', errorCode, message);
        showToast(`Failed to remove saved paragraph: ${message}`, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to remove saved paragraph');
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to remove saved paragraph');
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

// Subscribe to login and subscription modal visibility to apply blur to background components
store.sub(showLoginModalAtom, () => {
  updateBackgroundBlur();
});

store.sub(showSubscriptionModalAtom, () => {
  updateBackgroundBlur();
});

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
