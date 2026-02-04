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
import { FeatureRequestModal } from './components/FeatureRequestModal';
import { TextExplanationSidePanel } from './components/TextExplanationSidePanel';
import { TextExplanationIconContainer } from './components/TextExplanationIcon';
import { ImageExplanationIcon } from './components/ImageExplanationIcon/ImageExplanationIcon';
import { WordExplanationPopover, type TabType } from './components/WordExplanationPopover';
import { WordAskAISidePanel } from './components/WordAskAISidePanel';
import { FolderListModal } from './components/FolderListModal';
import { SavedParagraphIcon } from './components/SavedParagraphIcon';
import { WelcomeModal } from './components/WelcomeModal/WelcomeModal';
import { BookmarkSavedToast } from './components/BookmarkSavedToast';
import { Spinner } from './components/ui/Spinner';
import bookmarkSavedToastStyles from './styles/bookmarkSavedToast.shadow.css?inline';

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
import minimizeIconStyles from './styles/minimizeIcon.shadow.css?inline';
import contentActionsStyles from './styles/contentActions.shadow.css?inline';
import disableNotificationModalStyles from './styles/disableNotificationModal.shadow.css?inline';
import loginModalStyles from './styles/loginModal.shadow.css?inline';
import subscriptionModalStyles from './styles/subscriptionModal.shadow.css?inline';
import featureRequestModalStyles from './styles/featureRequestModal.shadow.css?inline';
import textExplanationSidePanelStyles from './styles/textExplanationSidePanel.shadow.css?inline';
import textExplanationIconStyles from './styles/textExplanationIcon.shadow.css?inline';
import imageExplanationIconStyles from './styles/imageExplanationIcon.shadow.css?inline';
import explanationIconButtonStyles from './styles/explanationIconButton.shadow.css?inline';
import wordExplanationPopoverStyles from './styles/wordExplanationPopover.shadow.css?inline';
import wordAskAISidePanelStyles from './styles/wordAskAISidePanel.shadow.css?inline';
import folderListModalStyles from './styles/folderListModal.shadow.css?inline';
import savedParagraphIconStyles from './styles/savedParagraphIcon.shadow.css?inline';
import welcomeModalStyles from './styles/welcomeModal.shadow.css?inline';
import baseSidePanelStyles from './styles/baseSidePanel.shadow.css?inline';
import spinnerStyles from './styles/spinner.shadow.css?inline';

// Import color CSS variables
import { getAllColorVariables } from '../constants/colors.css.js';
import { COLORS } from '../constants/colors';
import { getCurrentTheme } from '../constants/theme';

// Import services and utilities
import { SummariseService } from '../api-services/SummariseService';
import { SimplifyService } from '../api-services/SimplifyService';
import { SimplifyImageService } from '../api-services/SimplifyImageService';
import { TranslateService, getLanguageCode, TranslateTextItem } from '../api-services/TranslateService';
import { AskService } from '../api-services/AskService';
import { AskImageService } from '../api-services/AskImageService';
import { ApiErrorHandler } from '../api-services/ApiErrorHandler';
import { WordsExplanationV2Service, type WordInfo } from '../api-services/WordsExplanationV2Service';
import { MoreExamplesService } from '../api-services/MoreExamplesService';
import { WordSynonymsService } from '../api-services/WordSynonymsService';
import { WordAntonymsService } from '../api-services/WordAntonymsService';
import { WordAskService } from '../api-services/WordAskService';
import { SavedWordsService } from '../api-services/SavedWordsService';
import { FolderService } from '../api-services/FolderService';
import { SavedParagraphService } from '../api-services/SavedParagraphService';
import { SavedLinkService } from '../api-services/SavedLinkService';
import { SavedImageService } from '../api-services/SavedImageService';
import { UserSettingsService } from '../api-services/UserSettingsService';
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
import { showLoginModalAtom, showSubscriptionModalAtom, showFeatureRequestModalAtom, userAuthInfoAtom, currentThemeAtom } from '../store/uiAtoms';
import {
  textExplanationsAtom,
  activeTextExplanationIdAtom,
  textExplanationPanelOpenAtom,
  activeTextExplanationAtom,
  type TextExplanationState,
} from '../store/textExplanationAtoms';
import {
  imageExplanationsAtom,
  activeImageExplanationIdAtom,
  imageExplanationPanelOpenAtom,
  type ImageExplanationState,
} from '../store/imageExplanationAtoms';
import { youtubeTranscriptSegmentsAtom } from '../store/youtubeTranscriptAtoms';
import {
  wordExplanationsAtom,
  activeWordIdAtom,
  wordAskAISidePanelOpenAtom,
  wordAskAISidePanelWordIdAtom,
  type WordExplanationState as WordExplanationAtomState,
  type ChatMessage,
} from '../store/wordExplanationAtoms';
import { ChromeStorage } from '../storage/chrome-local/ChromeStorage';
import { ENV } from '../config/env';

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
const FEATURE_REQUEST_MODAL_HOST_ID = 'xplaino-feature-request-modal-host';
const TEXT_EXPLANATION_PANEL_HOST_ID = 'xplaino-text-explanation-panel-host';
const TEXT_EXPLANATION_ICON_HOST_ID = 'xplaino-text-explanation-icon-host';
const IMAGE_EXPLANATION_PANEL_HOST_ID = 'xplaino-image-explanation-panel-host';
const IMAGE_EXPLANATION_ICON_HOST_ID = 'xplaino-image-explanation-icon-host';
const WORD_EXPLANATION_POPOVER_HOST_ID = 'xplaino-word-explanation-popover-host';
const WORD_ASK_AI_PANEL_HOST_ID = 'xplaino-word-ask-ai-panel-host';
const TOAST_HOST_ID = 'xplaino-toast-host';
const BOOKMARK_TOAST_HOST_ID = 'xplaino-bookmark-toast-host';
const WARNING_TOAST_HOST_ID = 'xplaino-warning-toast-host';
const FOLDER_LIST_MODAL_HOST_ID = 'xplaino-folder-list-modal-host';
const WELCOME_MODAL_HOST_ID = 'xplaino-welcome-modal-host';
const YOUTUBE_ASK_AI_BUTTON_HOST_ID = 'xplaino-youtube-ask-ai-button-host';

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
let featureRequestModalRoot: ReactDOM.Root | null = null;
let textExplanationPanelRoot: ReactDOM.Root | null = null;
let textExplanationIconRoot: ReactDOM.Root | null = null;
let imageExplanationPanelRoot: ReactDOM.Root | null = null;
let imageExplanationIconRoot: ReactDOM.Root | null = null;
let wordExplanationPopoverRoot: ReactDOM.Root | null = null;
let wordAskAISidePanelRoot: ReactDOM.Root | null = null;
let wordAskAICloseHandler: (() => void) | null = null;
let toastRoot: ReactDOM.Root | null = null;
let welcomeModalRoot: ReactDOM.Root | null = null;

// Modal state
let modalVisible = false;
let welcomeModalVisible = false;

// Shared state for side panel
let sidePanelOpen = false;

// Toast state
let toastMessage: string | null = null;
let toastType: 'success' | 'error' = 'success';
let toastClosing: boolean = false;
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Bookmark toast state
let bookmarkToastUrl: string | null = null;
let bookmarkToastClosing: boolean = false;
let bookmarkToastType: 'word' | 'paragraph' | 'link' | 'image' | null = null;
let bookmarkToastRoot: ReactDOM.Root | null = null;

// Warning toast state
let warningToastVisible: boolean = false;
let warningToastClosing: boolean = false;
let warningToastRoot: ReactDOM.Root | null = null;
let youtubeAskAIButtonRoot: ReactDOM.Root | null = null;

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
let folderModalRememberCheckedInitialized: boolean = false; // Track if checkbox state has been initialized
// Folder modal mode: 'paragraph' for paragraph saving, 'link' for link saving, 'word' for word saving, 'image' for image saving
let folderModalMode: 'paragraph' | 'link' | 'word' | 'image' | null = null;
// Track if paragraph bookmark is from ContentActions (to prevent panel from opening)
let folderModalParagraphSource: 'contentactions' | 'panel' | null = null;
// Link-specific state variables
let folderModalLinkUrl: string = '';
let folderModalLinkName: string = '';
let folderModalLinkSummary: string | null = null;
// Track which source initiated the link save (for updating correct bookmark state)
let folderModalLinkSource: 'sidepanel' | 'fab' | null = null;
// Word-specific state variables
let folderModalWord: string | null = null;
let folderModalWordContextualMeaning: string | null = null;
let folderModalWordId: string | null = null;
// Image-specific state variables
let folderModalImageElement: HTMLImageElement | null = null;
let folderModalImageFile: File | Blob | null = null;

// FAB Saved Link state - tracks if current page is saved
let fabSavedLinkId: string | null = null;
// SidePanel Saved Link state - tracks if current page is saved (for SidePanel bookmark icon)
let sidePanelSavedLinkId: string | null = null;

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

// Track the last visible word info for shrink animation
// This allows us to keep rendering the popover with visible=false during the shrink animation
let lastVisibleWordInfo: {
  wordId: string;
  state: WordExplanationLocalState;
} | null = null;

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
  
  // Initialize theme atom
  try {
    const initialTheme = await getCurrentTheme();
    store.set(currentThemeAtom, initialTheme);
    console.log('[Content Script] Initial theme set:', initialTheme);
  } catch (error) {
    console.error('[Content Script] Error initializing theme:', error);
    store.set(currentThemeAtom, 'light');
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
 * Close all open sidebars except the specified one (non-blocking, triggers animations in parallel)
 * @param except - The sidebar type to exclude from closing
 */
function closeAllSidebars(except?: 'main' | 'text' | 'image' | 'wordAskAI'): void {
  console.log('[Content Script] closeAllSidebars called, except:', except);
  
  // Close main side panel
  if (except !== 'main' && sidePanelOpen) {
    console.log('[Content Script] Closing main side panel');
    sidePanelOpen = false;
    updateSidePanel();
  }
  
  // Close text explanation panel
  if (except !== 'text' && store.get(textExplanationPanelOpenAtom)) {
    console.log('[Content Script] Closing text explanation panel');
    if (textExplanationPanelCloseHandler) {
      textExplanationPanelCloseHandler();
    } else {
      // Fallback: immediate close if handler not available
      store.set(textExplanationPanelOpenAtom, false);
      updateTextExplanationPanel();
      updateTextExplanationIconContainer();
    }
  }
  
  // Close image explanation panel
  if (except !== 'image' && store.get(imageExplanationPanelOpenAtom)) {
    console.log('[Content Script] Closing image explanation panel');
    if (imageExplanationPanelCloseHandler) {
      imageExplanationPanelCloseHandler();
    } else {
      // Fallback: immediate close if handler not available
      store.set(imageExplanationPanelOpenAtom, false);
      updateImageExplanationPanel();
      updateImageExplanationIconContainer();
    }
  }
  
  // Close word Ask AI panel
  if (except !== 'wordAskAI' && store.get(wordAskAISidePanelOpenAtom)) {
    console.log('[Content Script] Closing word Ask AI panel');
    if (wordAskAICloseHandler) {
      wordAskAICloseHandler();
    } else {
      // Fallback: immediate close if handler not available
      store.set(wordAskAISidePanelOpenAtom, false);
      store.set(wordAskAISidePanelWordIdAtom, null);
      updateWordAskAISidePanel();
    }
  }
}

/**
 * Toggle side panel open/closed state
 */
function setSidePanelOpen(open: boolean, initialTab?: 'summary' | 'settings'): void {
  // If opening side panel, close all other sidebars (parallel animations)
  if (open) {
    closeAllSidebars('main');
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
 * Check if current page is a YouTube page
 */
function isYouTubePage(): boolean {
  try {
    const url = window.location.href;
    return url.includes('youtube.com');
  } catch {
    return false;
  }
}

/**
 * Check if current page is a YouTube watch page
 */
function isYouTubeWatchPage(): boolean {
  try {
    const url = window.location.href;
    return url.includes('youtube.com/watch');
  } catch {
    return false;
  }
}

/**
 * Check if extension is allowed to run on current page
 */
async function isExtensionAllowed(): Promise<boolean> {
  try {
    // For YouTube pages, don't allow standard features
    // YouTube pages will be handled separately
    if (isYouTubePage()) {
      console.log('[Content Script] YouTube page detected - standard features disabled');
      return false;
    }
    
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
    
    if (domainStatus === DomainStatus.DISABLED || 
        domainStatus === DomainStatus.BANNED || 
        domainStatus === DomainStatus.INVALID) {
      console.log(`[Content Script] Domain "${currentDomain}" is explicitly disabled (status: ${domainStatus})`);
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
async function injectFAB(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);

  // Inject component styles
  injectStyles(shadow, fabStyles);
  injectStyles(shadow, spinnerStyles);

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
// UTILITY FUNCTIONS
// =============================================================================

// Reference link pattern: [[[ ref text ]]]
const REF_LINK_PATTERN = /\[\[\[\s*(.+?)\s*\]\]\]/g;

/**
 * Filter out reference links ([[[ text ]]]) from summary text
 */
function filterReferenceLinks(summary: string): string {
  return summary.replace(REF_LINK_PATTERN, '').trim();
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

    // Get language code from user settings
    const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
    const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;

    // Call summarise API
    await SummariseService.summarise(
      {
        text: pageContent,
        context_type: 'PAGE',
        languageCode,
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
      await showWarningToast();
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
    
    // Check if current page is bookmarked
    const isBookmarked = fabSavedLinkId !== null;
    
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
          onSaveUrl: handleFabSaveUrlClick,
          onFeatureRequest: () => store.set(showFeatureRequestModalAtom, true),
          isSummarising: isSummarising,
          hasSummary: hasSummary,
          canHideActions: canHideFABActions,
          onShowModal: showDisableModal,
          isPanelOpen: isAnyPanelOpen,
          translationState: pageTranslationState,
          viewMode: pageViewMode,
          isBookmarked: isBookmarked,
        })
      )
    );
  }
}

/**
 * Update side panel state
 */
function updateSidePanel(initialTab?: 'summary' | 'settings'): void {
  if (sidePanelRoot) {
    // Handler for bookmark click from SidePanel
    const handleSidePanelBookmark = async () => {
      console.log('[Content Script] SidePanel bookmark clicked');
      
      // Get summary from state
      const summary = store.get(summaryAtom);
      
      // Get current URL and page title
      const currentUrl = window.location.href;
      const pageTitle = document.title || '';
      
      // Truncate page title to 100 characters
      const truncatedTitle = pageTitle.length > 100 ? pageTitle.substring(0, 100) : pageTitle;
      
      // Set modal mode and state
      folderModalMode = 'link';
      folderModalLinkSource = 'sidepanel';
      folderModalLinkUrl = currentUrl.length > 1024 ? currentUrl.substring(0, 1024) : currentUrl;
      folderModalLinkName = truncatedTitle;
      folderModalLinkSummary = summary && summary.trim().length > 0 ? summary : null;
      
      // Get folders and show modal
      FolderService.getAllFolders(
        {
          onSuccess: async (response) => {
            console.log('[Content Script] Folders loaded successfully for link:', response.folders.length, 'folders');
            folderModalFolders = response.folders;
            
            // Check for stored preference folder ID and auto-select/expand if found
            const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
            console.log('[Content Script] Retrieved stored bookmark folder ID from storage:', storedFolderId);
            if (storedFolderId) {
              const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
              if (ancestorPath !== null) {
                folderModalSelectedFolderId = storedFolderId;
                // Expand all ancestor folders to show the hierarchical path
                folderModalExpandedFolders = new Set(ancestorPath);
                console.log('[Content Script] Auto-selected preferred link folder:', storedFolderId, 'with ancestors:', ancestorPath);
              } else {
                folderModalSelectedFolderId = null;
                folderModalExpandedFolders = new Set();
                console.log('[Content Script] Stored link folder ID not found in tree, clearing selection. Stored ID:', storedFolderId, 'Available folders:', response.folders);
              }
            } else {
              folderModalSelectedFolderId = null;
              folderModalExpandedFolders = new Set();
              console.log('[Content Script] No stored link folder preference found');
            }
            
            folderModalOpen = true;
            injectFolderListModal();
            updateFolderListModal();
          },
          onError: (errorCode, message) => {
            console.error('[Content Script] Failed to load folders for link:', errorCode, message);
            showToast(`Failed to load folders: ${message}`, 'error');
            folderModalMode = null;
            folderModalLinkUrl = '';
            folderModalLinkName = '';
            folderModalLinkSummary = null;
            folderModalLinkSource = null;
          },
          onLoginRequired: () => {
            console.log('[Content Script] Login required to load folders for link');
            folderModalMode = null;
            folderModalLinkUrl = '';
            folderModalLinkName = '';
            folderModalLinkSummary = null;
            folderModalLinkSource = null;
            store.set(showLoginModalAtom, true);
          },
          onSubscriptionRequired: () => {
            console.log('[Content Script] Subscription required to load folders for link');
            folderModalMode = null;
            folderModalLinkUrl = '';
            folderModalLinkName = '';
            folderModalLinkSummary = null;
            folderModalLinkSource = null;
            store.set(showSubscriptionModalAtom, true);
          },
        }
      );
    };
    
    sidePanelRoot.render(
      React.createElement(Provider, { store },
        React.createElement(SidePanel, {
          isOpen: sidePanelOpen,
          useShadowDom: true,
          onClose: () => setSidePanelOpen(false),
          initialTab: initialTab,
          onShowToast: showToast,
          onShowBookmarkToast: showBookmarkToast,
          onBookmark: handleSidePanelBookmark,
          initialSavedLinkId: sidePanelSavedLinkId,
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
async function injectSidePanel(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
  // Inject component styles
  injectStyles(shadow, sidePanelStyles);
  injectStyles(shadow, minimizeIconStyles);

  // Inject base side panel styles for upgrade footer (coupon and upgrade buttons)
  injectStyles(shadow, baseSidePanelStyles);

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
        onShowToast: showToast,
        onShowBookmarkToast: showBookmarkToast,
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
async function injectContentActions(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
  // Inject component styles
  injectStyles(shadow, contentActionsStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component with Jotai Provider for theme access
  contentActionsRoot = ReactDOM.createRoot(mountPoint);
  contentActionsRoot.render(
    React.createElement(Provider, { store },
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
        onShowToast: showToast,
      })
    )
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
 * Recursively find a folder ID in the folder tree and return the path of ancestor folder IDs
 * Returns an array of folder IDs from root to the target folder (excluding the target itself)
 * Returns null if folder not found
 */
function findFolderAndGetAncestorPath(
  folders: FolderWithSubFoldersResponse[],
  targetId: string,
  currentPath: string[] = []
): string[] | null {
  for (const folder of folders) {
    if (folder.id === targetId) {
      // Found the target folder, return the current path (ancestors)
      return currentPath;
    }
    if (folder.subFolders && folder.subFolders.length > 0) {
      // Search in subFolders with current folder added to path
      const result = findFolderAndGetAncestorPath(
        folder.subFolders,
        targetId,
        [...currentPath, folder.id]
      );
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
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
  folderModalParagraphSource = 'contentactions'; // Mark as ContentActions bookmark to prevent panel from opening
  
  console.log('[Content Script] Calling FolderService.getAllFolders');
  
  // Get folders and show modal
  FolderService.getAllFolders(
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Folders loaded successfully:', response.folders.length, 'folders');
        folderModalFolders = response.folders;
        folderModalText = text;
        folderModalSourceUrl = window.location.href;
        
        // Check for stored preference folder ID and auto-select/expand if found
        const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
        console.log('[Content Script] Retrieved stored bookmark folder ID from storage:', storedFolderId);
        if (storedFolderId) {
          const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
          if (ancestorPath !== null) {
            folderModalSelectedFolderId = storedFolderId;
            // Expand all ancestor folders to show the hierarchical path
            folderModalExpandedFolders = new Set(ancestorPath);
            console.log('[Content Script] Auto-selected preferred folder:', storedFolderId, 'with ancestors:', ancestorPath);
          } else {
            folderModalSelectedFolderId = null;
            folderModalExpandedFolders = new Set();
            console.log('[Content Script] Stored folder ID not found in tree, clearing selection. Stored ID:', storedFolderId, 'Available folders:', response.folders);
          }
        } else {
          folderModalSelectedFolderId = null;
          folderModalExpandedFolders = new Set();
          console.log('[Content Script] No stored folder preference found');
        }
        
        folderModalRememberCheckedInitialized = false; // Reset flag when modal opens
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

  // Store reference to close image panel when text panel opens (for smooth transition)
  const activeImageIdToClose = store.get(activeImageExplanationIdAtom);
  const hasImagePanelToClose = activeImageIdToClose && store.get(imageExplanationPanelOpenAtom);

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

  // Clear text selection immediately to hide action button
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
      
      // Restore text selection so action button shows again
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

  // Get language code from user settings
  const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;

  try {
    // Call v2/simplify API
    await SimplifyService.simplify(
      [
        {
          textStartIndex,
          textLength,
          text: contextText, // Pass surrounding context instead of just selected text
          previousSimplifiedTexts: [],
          languageCode,
        },
      ],
      {
        onChunk: async (_chunk, accumulated) => {
          let isFirstChunk = false;
          let rangeToUnderline: Range | null = null;
          
          updateExplanationInMap(explanationId, (state) => {
            const updatedState = { ...state, streamingText: accumulated };
            
            // On first chunk: switch to green icon, add underline, open panel
            if (!updatedState.firstChunkReceived) {
              isFirstChunk = true;
              updatedState.firstChunkReceived = true;
              updatedState.isSpinning = false;
              
              // Clear the timeout since we received the first chunk
              clearTimeout(timeoutId);
              
              // Store range for underline (will be added after updateExplanationInMap)
              if (updatedState.range) {
                rangeToUnderline = updatedState.range;
              }
            }
            
            return updatedState;
          });
          
          // Add underline to selected text (after state update)
          if (isFirstChunk && rangeToUnderline) {
            const underlineState = await addTextUnderline(rangeToUnderline);
            updateExplanationInMap(explanationId, (state) => ({
              ...state,
              underlineState,
            }));
          }
          
          // Update UI after state is committed to atom
          if (isFirstChunk) {
            // Close image panel first (if open) for smooth transition, then open text panel
            if (hasImagePanelToClose && activeImageIdToClose) {
              console.log('[Content Script] Switching from image to text explanation panel (new explanation)');
              const imageExplanations = store.get(imageExplanationsAtom);
              const activeImageExplanation = imageExplanations.get(activeImageIdToClose);
              if (activeImageExplanation?.abortController) {
                activeImageExplanation.abortController.abort();
              }
              store.set(imageExplanationPanelOpenAtom, false);
              store.set(activeImageExplanationIdAtom, null);
              updateImageExplanationPanel();
              updateImageExplanationIconContainer();
            }
            
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
          
          // Restore text selection so action button shows again
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

    // Create spinner near the word
    const spinner = await createSpinner(wordSpan);

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

    // Get language code from user settings
    const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
    const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;

    // Call words_explanation_v2 API
    await WordsExplanationV2Service.explainWord(
      word,
      contextText, // Pass surrounding context instead of empty string
      languageCode,
      {
        onEvent: async (wordInfo: WordInfo) => {
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
              
              // Update inline styles - no background, only bottom border
              state.wordSpanElement.style.background = 'transparent';
              state.wordSpanElement.style.cursor = 'pointer';
              state.wordSpanElement.style.transition = 'none';
              
              // Apply styling with bottom border, bookmark icon, and close button
              await applyGreenWordSpanStyling(state.wordSpanElement, wordId, isSaved);
              
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

              // Add hover effect with very light theme color
              state.wordSpanElement.addEventListener('mouseenter', () => {
                if (state.wordSpanElement) {
                  state.wordSpanElement.style.background = COLORS.PRIMARY_OPACITY_10;
                }
              });
              state.wordSpanElement.addEventListener('mouseleave', () => {
                if (state.wordSpanElement) {
                  state.wordSpanElement.style.background = 'transparent';
                }
              });

              // Add click handler to toggle popover
              state.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show icon
              state.wordSpanElement.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (state.wordSpanElement) {
                  await showXplainoIconForWordRemoval(state.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }

            // Open popover
            state.popoverVisible = true;
            console.log('[Content Script] Opening word explanation popover for wordId:', wordId);
            console.log('[Content Script] Word span element:', state.wordSpanElement);
            console.log('[Content Script] Source ref current:', state.sourceRef.current);
            await injectWordExplanationPopover();
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
    
    // Create spinner near the word
    const spinner = await createSpinner(wordSpan);
    
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
        onSuccess: async (response) => {
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
              
              // Update inline styles - no background, only bottom border
              localState.wordSpanElement.style.background = 'transparent';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'none';
              
              // Apply styling with bottom border, bookmark icon, and close button
              await applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              }, 800);
              
              // Add hover effect with very light theme color
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = COLORS.PRIMARY_OPACITY_10;
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'transparent';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show icon
              localState.wordSpanElement.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  await showXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover
            localState.popoverVisible = true;
            await injectWordExplanationPopover();
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
    
    // Create spinner near the word
    const spinner = await createSpinner(wordSpan);
    
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
        onSuccess: async (response) => {
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
              
              // Update inline styles - no background, only bottom border
              localState.wordSpanElement.style.background = 'transparent';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'none';
              
              // Apply styling with bottom border, bookmark icon, and close button
              await applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              });
              
              // Add hover effect with very light theme color
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = COLORS.PRIMARY_OPACITY_10;
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'transparent';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show icon
              localState.wordSpanElement.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  await showXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover
            localState.popoverVisible = true;
            await injectWordExplanationPopover();
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
      await showWarningToast();
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
    
    // Create spinner near the word
    const spinner = await createSpinner(wordSpan);
    
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
        onSuccess: async (translatedTexts) => {
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
              
              // Update inline styles - no background, only bottom border
              localState.wordSpanElement.style.background = 'transparent';
              localState.wordSpanElement.style.cursor = 'pointer';
              localState.wordSpanElement.style.transition = 'none';
              
              // Apply styling with bottom border, bookmark icon, and close button
              await applyGreenWordSpanStyling(localState.wordSpanElement, wordId, isSaved);
              
              // Add scale bounce animation
              localState.wordSpanElement.style.animation = 'none';
              void localState.wordSpanElement.offsetHeight;
              localState.wordSpanElement.style.animation = 'word-explanation-scale-bounce 0.8s ease';
              setTimeout(() => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.animation = '';
                }
              }, 800);
              
              // Add hover effect with very light theme color
              localState.wordSpanElement.addEventListener('mouseenter', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = COLORS.PRIMARY_OPACITY_10;
                }
              });
              localState.wordSpanElement.addEventListener('mouseleave', () => {
                if (localState.wordSpanElement) {
                  localState.wordSpanElement.style.background = 'transparent';
                }
              });
              
              // Add click handler to toggle popover
              localState.wordSpanElement.addEventListener('click', () => {
                toggleWordPopover(wordId);
              });

              // Add double-click handler to remove word explanation and show icon
              localState.wordSpanElement.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (localState.wordSpanElement) {
                  await showXplainoIconForWordRemoval(localState.wordSpanElement, wordId);
                }
                removeWordExplanation(wordId);
              });
            }
            
            // Open popover with Grammar tab
            localState.popoverVisible = true;
            await injectWordExplanationPopover();
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
      await showWarningToast();
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
    
    // Track first progress event (similar to isFirstChunk in text explanation)
    let isFirstProgress = true;
    
    // Call translate API
    await TranslateService.translate(
      {
        targetLangugeCode: targetLanguageCode,
        texts: [{ id: '1', text: selectedText }],
      },
      {
        onProgress: (_index, translatedText) => {
          console.log('[Content Script] Translation progress event received:', translatedText);
          
          if (isFirstProgress) {
            // First progress event - open panel immediately
            isFirstProgress = false;
            
            let rangeToUnderline: Range | null = null;
            
            // Update explanation state
            updateExplanationInMap(explanationId, (state) => {
              const updatedState = {
                ...state,
                isSpinning: false,
                firstChunkReceived: true,
                translations: [{ language: nativeLanguage, translated_content: translatedText }],
              };
              
              // Store range for underline (will be added after panel opens)
              if (updatedState.range) {
                rangeToUnderline = updatedState.range;
              }
              
              return updatedState;
            });
            
            // Stop translating flag
            isTranslating = false;
            
            // Open side panel IMMEDIATELY with Translation tab (before async underline)
            store.set(textExplanationPanelOpenAtom, true);
            
            // Update icon and panel synchronously
            updateTextExplanationIconContainer();
            updateTextExplanationPanel();
            
            // Add green underline to selected text AFTER panel is open (async, non-blocking)
            if (rangeToUnderline) {
              addTextUnderline(rangeToUnderline, 'green').then((underlineState) => {
                if (underlineState) {
                  updateExplanationInMap(explanationId, (state) => ({
                    ...state,
                    underlineState,
                  }));
                }
              });
            }
          } else {
            // Subsequent progress events - update existing translation
            updateExplanationInMap(explanationId, (state) => ({
              ...state,
              translations: [{ language: nativeLanguage, translated_content: translatedText }],
            }));
            
            // Update panel with new content
            updateTextExplanationPanel();
          }
        },
        onSuccess: async (translatedTexts) => {
          console.log('[Content Script] Text translation complete:', translatedTexts);
          
          // Final cleanup - ensure state is consistent
          // Panel already opened in onProgress, just ensure translating flag is off
          isTranslating = false;
          
          // If onProgress was never called (shouldn't happen, but handle it)
          if (isFirstProgress) {
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
              abortController: null,
            };
            
            const map = new Map(store.get(textExplanationsAtom));
            map.set(explanationId, updated);
            store.set(textExplanationsAtom, map);
            
            // Add green underline
            const currentStateForUnderline = store.get(textExplanationsAtom).get(explanationId);
            if (currentStateForUnderline && currentStateForUnderline.range) {
              const underlineState = await addTextUnderline(currentStateForUnderline.range, 'green');
              if (underlineState) {
                const mapWithUnderline = new Map(store.get(textExplanationsAtom));
                const stateWithUnderline = mapWithUnderline.get(explanationId);
                if (stateWithUnderline) {
                  mapWithUnderline.set(explanationId, {
                    ...stateWithUnderline,
                    underlineState,
                    abortController: null,
                  });
                  store.set(textExplanationsAtom, mapWithUnderline);
                }
              }
            }
            
            // Open side panel
            store.set(textExplanationPanelOpenAtom, true);
            
            // Update icon and panel
            updateTextExplanationIconContainer();
            updateTextExplanationPanel();
          }
        },
        onError: (code: string, message: string) => {
          console.error('[Content Script] Text translation error:', code, message);
          
          // Stop translating flag
          isTranslating = false;
          
          // Abort controller and remove the explanation
          const currentState = store.get(textExplanationsAtom).get(explanationId);
          if (currentState?.abortController) {
            currentState.abortController.abort();
          }
          
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
          
          // Abort controller and remove the explanation
          const currentState = store.get(textExplanationsAtom).get(explanationId);
          if (currentState?.abortController) {
            currentState.abortController.abort();
          }
          
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
          
          // Abort controller and remove the explanation
          const currentState = store.get(textExplanationsAtom).get(explanationId);
          if (currentState?.abortController) {
            currentState.abortController.abort();
          }
          
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
    
    // Abort controller and remove the explanation if it was created
    const explanations = store.get(textExplanationsAtom);
    const explanationId = store.get(activeTextExplanationIdAtom);
    if (explanationId && explanations.has(explanationId)) {
      const currentState = explanations.get(explanationId);
      if (currentState?.abortController) {
        currentState.abortController.abort();
      }
      
      // Remove the explanation
      const newMap = new Map(explanations);
      newMap.delete(explanationId);
      store.set(textExplanationsAtom, newMap);
      
      // Clear active explanation
      store.set(activeTextExplanationIdAtom, null);
      store.set(textExplanationPanelOpenAtom, false);
      
      // Update icon container
      updateTextExplanationIconContainer();
      
      // Remove icon container if no explanations left
      if (newMap.size === 0) {
        removeTextExplanationIconContainer();
      }
    }
    
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
function createWordSpan(_word: string, range: Range): HTMLElement | null {
  try {
    // Get the computed styles from the selected text to preserve font properties
    const startContainer = range.startContainer;
    let fontStyle = '';
    let fontWeight = '';
    let fontSize = '';
    let fontFamily = '';
    let color = '';
    
    if (startContainer.nodeType === Node.TEXT_NODE && startContainer.parentElement) {
      const computedStyle = window.getComputedStyle(startContainer.parentElement);
      fontStyle = computedStyle.fontStyle;
      fontWeight = computedStyle.fontWeight;
      fontSize = computedStyle.fontSize;
      fontFamily = computedStyle.fontFamily;
      color = computedStyle.color;
    } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
      const computedStyle = window.getComputedStyle(startContainer as Element);
      fontStyle = computedStyle.fontStyle;
      fontWeight = computedStyle.fontWeight;
      fontSize = computedStyle.fontSize;
      fontFamily = computedStyle.fontFamily;
      color = computedStyle.color;
    }

    // Create span element
    const span = document.createElement('span');
    // Add identifying class for word spans (used by click-outside handler)
    span.classList.add('xplaino-word-span');
    // Don't add 'word-explanation-loading' class to avoid pulsating animation
    
    // Preserve original font styles
    span.style.fontStyle = fontStyle;
    span.style.fontWeight = fontWeight;
    span.style.fontSize = fontSize;
    span.style.fontFamily = fontFamily;
    span.style.color = color;
    // Explicitly set text-decoration to prevent inheritance from parent text underline
    // Word spans use bottom border, not text-decoration
    span.style.textDecoration = 'none';
    
    // No background, no border, top border-radius only
    span.style.background = 'transparent';
    span.style.border = 'none';
    span.style.borderRadius = '10px 10px 0 0';
    span.style.padding = '2px 0';
    span.style.margin = '0';
    span.style.cursor = 'default';
    span.style.position = 'relative';
    // Ensure word span is isolated from parent text-decoration
    span.style.isolation = 'isolate';
    span.style.zIndex = '1';

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
 * Create spinner near the word span using the reusable Spinner component
 */
async function createSpinner(wordSpan: HTMLElement): Promise<HTMLElement> {
  const spinnerContainer = document.createElement('div');
  spinnerContainer.className = 'primary-spinner-container';
  
  // Position spinner above the word span, centered horizontally
  // Use absolute positioning relative to the span so it scrolls with it
  // Reduced top offset from -18px to -12px to be closer to the word
  spinnerContainer.style.cssText = `
    position: absolute;
    left: 50%;
    top: -12px;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 50%;
    padding: 3px;
  `;
  
  // Append to wordSpan so it scrolls with it
  wordSpan.appendChild(spinnerContainer);

  // Create a shadow host for the spinner to use proper component styling
  const spinnerId = `word-spinner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { host, shadow, mountPoint } = createShadowHost({
    id: spinnerId,
    zIndex: 2147483647,
  });
  
  // Style the host element - override fixed positioning for inline use
  host.style.cssText = `
    all: initial;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Inject spinner styles - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);
  injectStyles(shadow, spinnerStyles);
  
  // Create React root and render Spinner component
  const root = ReactDOM.createRoot(mountPoint);
  root.render(
    React.createElement(Spinner, { size: 'sm', useShadowDom: true })
  );
  
  // Append the shadow host to the spinner container
  spinnerContainer.appendChild(host);

  return spinnerContainer;
}

/**
 * Create bookmark icon element for word span
 * NOTE: This function is no longer used as we removed the bookmark icon from word spans
 * to reduce visual clutter. Bookmark status is shown in the popover header instead.
 */
// function createBookmarkIcon(): HTMLElement {
//   const bookmarkIcon = document.createElement('div');
//   bookmarkIcon.className = 'word-explanation-bookmark-icon';
//   bookmarkIcon.style.cssText = `
//     position: absolute;
//     top: -8px;
//     left: -8px;
//     width: 16px;
//     height: 16px;
//     z-index: 1;
//     pointer-events: none;
//   `;
//   
//   // Create SVG bookmark icon
//   const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
//   svg.setAttribute('width', '16');
//   svg.setAttribute('height', '16');
//   svg.setAttribute('viewBox', '0 0 24 24');
//   svg.setAttribute('fill', COLORS.PRIMARY);
//   svg.style.cssText = 'width: 100%; height: 100%;';
//   
//   const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
//   path.setAttribute('d', 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z');
//   path.setAttribute('fill', COLORS.PRIMARY);
//   
//   svg.appendChild(path);
//   bookmarkIcon.appendChild(svg);
//   
//   return bookmarkIcon;
// }

/**
 * Create reusable green close button component for word span
 * Size is 3/4 of original (15px instead of 20px)
 */

/**
 * Show xplaino icon when word is removed via double-click
 */
async function showXplainoIconForWordRemoval(wordSpanElement: HTMLElement, _wordId: string): Promise<void> {
  const rect = wordSpanElement.getBoundingClientRect();
  const theme = await getCurrentTheme();
  const iconName = theme === 'dark' 
    ? 'xplaino-turquoise-icon.ico' 
    : 'xplaino-purple-icon.ico';
  const iconUrl = chrome.runtime.getURL(`src/assets/icons/${iconName}`);
  
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
async function applyGreenWordSpanStyling(wordSpanElement: HTMLElement, _wordId: string, _isSaved: boolean): Promise<void> {
  // Ensure position is relative for absolute positioning of icons
  if (wordSpanElement.style.position !== 'relative' && wordSpanElement.style.position !== 'absolute') {
    wordSpanElement.style.position = 'relative';
  }
  
  // No border on all sides, top border-radius only
  wordSpanElement.style.border = 'none';
  wordSpanElement.style.borderRadius = '10px 10px 0 0';
  
  // Get theme-aware primary color
  const theme = await getCurrentTheme();
  const primaryColor = theme === 'dark' ? COLORS.DARK_PRIMARY : COLORS.PRIMARY;
  
  // Add thick bottom border with pill-shaped ends using pseudo-element
  // We'll use a separate element for the bottom border since pseudo-elements are tricky in inline styles
  const existingBottomBorder = wordSpanElement.querySelector('.word-explanation-bottom-border');
  if (existingBottomBorder) {
    existingBottomBorder.remove();
  }
  
  const bottomBorder = document.createElement('div');
  bottomBorder.className = 'word-explanation-bottom-border';
  // Start with width 0 for animation
  bottomBorder.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px !important;
    min-height: 2px !important;
    max-height: 2px !important;
    background: ${primaryColor};
    border-radius: 1px;
    pointer-events: none;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    box-sizing: border-box;
  `;
  wordSpanElement.appendChild(bottomBorder);
  
  // Animate to full width after a brief delay to ensure element is rendered
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bottomBorder.style.width = '100%';
    });
  });
  
  // Remove existing bookmark icon if it exists
  const existingBookmark = wordSpanElement.querySelector('.word-explanation-bookmark-icon');
  if (existingBookmark) {
    existingBookmark.remove();
  }
  
  // Don't add bookmark icon on word span - user can see bookmark status in popover header
  // Commenting out the bookmark icon creation to avoid visual clutter
  // if (isSaved) {
  //   const bookmarkIcon = createBookmarkIcon();
  //   wordSpanElement.appendChild(bookmarkIcon);
  // }
  
  // Close button removed - use delete button in header instead
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
    
    @keyframes word-explanation-pulsate-primary {
      0%, 100% {
        background-color: ${COLORS.PRIMARY_OPACITY_10};
      }
      50% {
        background-color: ${COLORS.PRIMARY_OPACITY_25};
      }
    }
    
    .word-explanation-loading {
      animation: word-explanation-pulsate-primary 1.5s ease-in-out infinite;
      border-radius: 10px;
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
async function toggleWordPopover(wordId: string): Promise<void> {
  const state = wordExplanationsMap.get(wordId);
  if (!state) {
    console.log('[Content Script] toggleWordPopover - no state found for wordId:', wordId);
    return;
  }

  // Close any other visible popover first (only one popover visible at a time)
  for (const [otherId, otherState] of wordExplanationsMap.entries()) {
    if (otherId !== wordId && otherState.popoverVisible) {
      console.log('[Content Script] toggleWordPopover - closing other popover:', otherId);
      otherState.popoverVisible = false;
    }
  }

  const previousVisible = state.popoverVisible;
  state.popoverVisible = !state.popoverVisible;

  console.log('[Content Script] toggleWordPopover called:', {
    wordId,
    word: state.word,
    previousVisible,
    newVisible: state.popoverVisible,
    hasWordSpan: !!state.wordSpanElement,
    hasSourceRef: !!state.sourceRef.current,
  });

  if (state.popoverVisible) {
    console.log('[Content Script] toggleWordPopover - opening popover, calling injectWordExplanationPopover');
    await injectWordExplanationPopover();
  } else {
    console.log('[Content Script] toggleWordPopover - closing popover');
  }

  console.log('[Content Script] toggleWordPopover - calling updateWordExplanationPopover');
  updateWordExplanationPopover();
  console.log('[Content Script] toggleWordPopover - update complete');
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

  // Clear lastVisibleWordInfo if it was for this word
  if (lastVisibleWordInfo && lastVisibleWordInfo.wordId === wordId) {
    lastVisibleWordInfo = null;
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
    console.log('[Content Script] Local state updated - isLoading:', localState.isLoading, 'streamedContent:', localState.streamedContent);
  } else {
    console.error('[Content Script] Local state not found for wordId:', wordId);
  }
  
  console.log('[Content Script] About to call updateWordExplanationPopover with loading state');
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

  // Get language code from user settings
  const nativeLanguageForWord = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCodeForWord = nativeLanguageForWord ? (getLanguageCode(nativeLanguageForWord) || undefined) : undefined;

  // Call words_explanation_v2 API
  await WordsExplanationV2Service.explainWord(
    wordAtomState.word,
    contextText, // Pass surrounding context instead of empty string
    languageCodeForWord,
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
    await showWarningToast();
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

  // Close all other sidebars (parallel animations)
  closeAllSidebars('wordAskAI');

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

  // Get language code from user settings
  const nativeLanguageForAsk = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCodeForAsk = nativeLanguageForAsk ? (getLanguageCode(nativeLanguageForAsk) || undefined) : undefined;

  try {
    await WordAskService.ask(
      {
        question: question.trim(),
        chat_history: wordAtomState.askAI.chatHistory, // Send old history (without new user message)
        initial_context: initialContext,
        context_type: 'TEXT',
        languageCode: languageCodeForAsk,
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
function toggleTextExplanationPanel(explanationId: string): void {
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
      // Opening - close all other sidebars (parallel animations)
      closeAllSidebars('text');
      
      // Ensure panel is injected before opening
      injectTextExplanationPanel();
      
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
    
    // Close all other sidebars (parallel animations)
    closeAllSidebars('text');
    
    // Ensure panel is injected before opening
    injectTextExplanationPanel();
    
    store.set(activeTextExplanationIdAtom, explanationId);
    store.set(textExplanationPanelOpenAtom, true);
    updateTextExplanationPanel();
    updateTextExplanationIconContainer();
  }
}

/**
 * Toggle image explanation panel open/closed for a specific explanation
 * If clicking same explanation ID: toggle panel (close if open, open if closed)
 * If clicking different ID: close current panel, set new active ID, open new panel
 */
function toggleImageExplanationPanel(explanationId: string): void {
  const activeId = store.get(activeImageExplanationIdAtom);
  const panelOpen = store.get(imageExplanationPanelOpenAtom);
  
  if (explanationId === activeId) {
    // Same explanation: toggle panel
    if (panelOpen) {
      // Closing - use animated close handler if available
      if (imageExplanationPanelCloseHandler) {
        console.log('[Content Script] Calling animated close handler from image icon toggle');
        imageExplanationPanelCloseHandler();
      } else {
        // Fallback: direct close if handler not registered yet
        console.warn('[Content Script] Image close handler not available, using direct close');
        store.set(imageExplanationPanelOpenAtom, false);
        updateImageExplanationPanel();
      }
      updateImageExplanationIconContainer();
    } else {
      // Opening - close all other sidebars (parallel animations)
      closeAllSidebars('image');
      
      // Ensure panel is injected before opening
      injectImageExplanationPanel();
      
      store.set(activeImageExplanationIdAtom, explanationId);
      store.set(imageExplanationPanelOpenAtom, true);
      updateImageExplanationPanel();
      updateImageExplanationIconContainer();
    }
  } else {
    // Different explanation: close current, switch to new, open panel
    if (activeId) {
      // Abort any in-progress request for previous active explanation
      const explanations = store.get(imageExplanationsAtom);
      const previousExplanation = explanations.get(activeId);
      if (previousExplanation?.abortController) {
        previousExplanation.abortController.abort();
      }
    }
    
    // Close all other sidebars (parallel animations)
    closeAllSidebars('image');
    
    // Ensure panel is injected before opening
    injectImageExplanationPanel();
    
    store.set(activeImageExplanationIdAtom, explanationId);
    store.set(imageExplanationPanelOpenAtom, true);
    updateImageExplanationPanel();
    updateImageExplanationIconContainer();
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
      
      // Get language code from user settings
      const nativeLanguageForTextAsk = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCodeForTextAsk = nativeLanguageForTextAsk ? (getLanguageCode(nativeLanguageForTextAsk) || undefined) : undefined;
      
      try {
        await AskService.ask(
          {
            question: question.trim(),
            chat_history: chatHistoryForAPI,
            initial_context: selectedText,
            context_type: 'TEXT',
            languageCode: languageCodeForTextAsk,
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
      
      // Get language code from user settings
      const nativeLanguageForSimplifyMore = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCodeForSimplifyMore = nativeLanguageForSimplifyMore ? (getLanguageCode(nativeLanguageForSimplifyMore) || undefined) : undefined;
      
      try {
        await SimplifyService.simplify(
          [
            {
              textStartIndex,
              textLength,
              text: contextText, // Pass surrounding context instead of just selected text
              previousSimplifiedTexts: previousSimplifiedTexts,
              languageCode: languageCodeForSimplifyMore,
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
                  
                  // Check if this is a bookmark-created explanation with underline
                  if (state.paragraphId && state.underlineState) {
                    // Check if underline color by examining the wrapper element
                    const wrapper = state.underlineState.wrapperElement;
                    const currentColor = wrapper.style.textDecorationColor;
                    if (currentColor.includes('13, 128, 112') || currentColor.includes('0d8070')) {
                      shouldConvertUnderline = true;
                      underlineStateToConvert = state.underlineState;
                    }
                  }
                }
                return state;
              });
              
              // Convert underline to teal if needed
              if (shouldConvertUnderline && underlineStateToConvert) {
                console.log('[Content Script] Converting underline to teal after first Simplify response');
                changeUnderlineColor(underlineStateToConvert, 'teal');
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
      
      // Get language code from user settings
      const nativeLanguageForFollowUp = await ChromeStorage.getUserSettingNativeLanguage();
      const languageCodeForFollowUp = nativeLanguageForFollowUp ? (getLanguageCode(nativeLanguageForFollowUp) || undefined) : undefined;
      
      try {
        await AskService.ask(
          {
            question: inputText.trim(),
            chat_history: chatHistoryForAPI,
            initial_context: selectedText,
            context_type: 'TEXT',
            languageCode: languageCodeForFollowUp,
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
    
    // Mark as panel bookmark (so panel will open after save)
    folderModalParagraphSource = 'panel';
    
    // Get folders and show modal
    FolderService.getAllFolders(
      {
        onSuccess: async (response) => {
          console.log('[Content Script] Folders loaded successfully:', response.folders.length, 'folders');
          folderModalFolders = response.folders;
          folderModalText = text;
          folderModalSourceUrl = window.location.href;
          
          // Check for stored preference folder ID and auto-select/expand if found
          const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
          if (storedFolderId) {
            const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
            if (ancestorPath !== null) {
              folderModalSelectedFolderId = storedFolderId;
              // Expand all ancestor folders to show the hierarchical path
              folderModalExpandedFolders = new Set(ancestorPath);
              console.log('[Content Script] Auto-selected preferred folder:', storedFolderId, 'with ancestors:', ancestorPath);
            } else {
              folderModalSelectedFolderId = null;
              folderModalExpandedFolders = new Set();
              console.log('[Content Script] Stored folder ID not found in tree, clearing selection');
            }
          } else {
            folderModalSelectedFolderId = null;
            folderModalExpandedFolders = new Set();
            console.log('[Content Script] No stored folder preference found');
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
async function injectTextExplanationPanel(): Promise<void> {
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
  // Then inject color variables to override/ensure they're set - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);
  // Inject MinimizeIcon styles
  injectStyles(shadow, minimizeIconStyles);
  // Inject base side panel styles for upgrade footer (coupon and upgrade buttons)
  injectStyles(shadow, baseSidePanelStyles);

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
// IMAGE EXPLANATION
// =============================================================================

// Track hovered images and their icon states
const hoveredImages = new Map<HTMLImageElement, { iconId: string }>();
// Track hide timeouts for images (to delay icon disappearance)
const imageHideTimeouts = new Map<HTMLImageElement, ReturnType<typeof setTimeout>>();
// Track if mouse is over icon (to keep it visible)
const iconHoverStates = new Map<string, boolean>();

/**
 * Convert image element to File/Blob
 * Handles CORS issues by trying fetch first, then canvas for same-origin images
 */
async function convertImageToFile(imageElement: HTMLImageElement): Promise<File | null> {
  // Determine MIME type from image source or default to PNG
  let mimeType = 'image/png';
  if (imageElement.src) {
    if (imageElement.src.includes('.jpg') || imageElement.src.includes('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (imageElement.src.includes('.webp')) {
      mimeType = 'image/webp';
    } else if (imageElement.src.includes('.gif')) {
      mimeType = 'image/gif';
    }
  }
  
  // First, try fetching the image directly (works if CORS is properly configured)
  try {
    const response = await fetch(imageElement.src, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const fetchedMimeType = blob.type || mimeType;
      const file = new File([blob], 'image.png', { type: fetchedMimeType });
      console.log('[Content Script] Successfully fetched image via fetch API');
      return file;
    }
  } catch (fetchError) {
    console.log('[Content Script] Fetch failed (CORS issue), trying canvas approach:', fetchError);
    // Continue to canvas approach
  }
  
  // If fetch fails, try canvas approach (works for same-origin images)
  // Note: Canvas will be tainted for cross-origin images, so we catch that error
  try {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[Content Script] Failed to get canvas context');
      return null;
    }
    
    // Draw image to canvas
    ctx.drawImage(imageElement, 0, 0);
    
    // Convert to blob - this will throw SecurityError if canvas is tainted
    return new Promise<File | null>((resolve) => {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('[Content Script] Failed to convert canvas to blob');
            resolve(null);
            return;
          }
          
          // Convert blob to File
          const file = new File([blob], 'image.png', { type: mimeType });
          console.log('[Content Script] Successfully converted image via canvas');
          resolve(file);
        }, mimeType);
      } catch (toBlobError) {
        // Canvas is tainted (cross-origin image)
        console.error('[Content Script] Canvas is tainted (cross-origin image):', toBlobError);
        resolve(null);
      }
    });
  } catch (error) {
    // Catch any errors during canvas operations
    if (error instanceof Error && error.name === 'SecurityError') {
      console.error('[Content Script] SecurityError: Cannot export tainted canvas (cross-origin image)');
    } else {
      console.error('[Content Script] Error converting image to file via canvas:', error);
    }
    return null;
  }
}

/**
 * Update image explanation icon container
 */
function updateImageExplanationIconContainer(): void {
  if (!imageExplanationIconRoot) {
    console.warn('[Content Script] imageExplanationIconRoot is null, cannot update icon container');
    return;
  }
  
  const explanations = store.get(imageExplanationsAtom);
  const activeId = store.get(activeImageExplanationIdAtom);
  
  console.log('[Content Script] updateImageExplanationIconContainer:', {
    explanationsCount: explanations.size,
    activeId,
    icons: Array.from(explanations.values()).map(exp => ({
      id: exp.id,
      isSpinning: exp.isSpinning,
      firstChunkReceived: exp.firstChunkReceived,
      position: exp.iconPosition,
    })),
  });
  
  const icons = Array.from(explanations.values()).map((explanation) => {
    // Create bookmark click handler for this explanation
    const handleBookmarkClick = () => {
      if (!explanation.savedImageId) {
        console.warn('[Content Script] No savedImageId for bookmark click');
        return;
      }
      
      // Call delete API
      SavedImageService.deleteSavedImage(
        explanation.savedImageId,
        {
          onSuccess: () => {
            console.log('[Content Script] Image bookmark deleted successfully');
            
            // Update explanation state to clear savedImageId
            const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
              const map = new Map(store.get(imageExplanationsAtom));
              const current = map.get(id);
              if (current) {
                map.set(id, updater(current));
                store.set(imageExplanationsAtom, map);
              }
            };
            
            updateExplanationInMap(explanation.id, (state) => ({
              ...state,
              savedImageId: null,
            }));
            
            // Update icon container to hide bookmark icon
            updateImageExplanationIconContainer();
            
            // Update panel if it's currently open for this explanation
            if (activeId === explanation.id) {
              updateImageExplanationPanel();
            }
            
            showToast('Bookmark removed successfully!', 'success');
          },
          onError: (errorCode, message) => {
            console.error('[Content Script] Failed to delete image bookmark:', errorCode, message);
            let displayMessage = 'Failed to remove bookmark';
            
            if (errorCode === 'NOT_FOUND') {
              displayMessage = 'Bookmark not found';
            } else if (errorCode === 'NETWORK_ERROR') {
              displayMessage = 'Network error. Please check your connection.';
            } else if (message) {
              displayMessage = message;
            }
            
            showToast(displayMessage, 'error');
          },
          onLoginRequired: () => {
            console.log('[Content Script] Login required to delete image bookmark');
            store.set(showLoginModalAtom, true);
          },
          onSubscriptionRequired: () => {
            console.log('[Content Script] Subscription required to delete image bookmark');
            store.set(showSubscriptionModalAtom, true);
          },
        }
      );
    };
    
    return {
    id: explanation.id,
    position: explanation.iconPosition,
    isSpinning: explanation.isSpinning,
    onClick: () => {
        // Call handleImageIconClick which will toggle if content exists, or make API call if not
        handleImageIconClick(explanation.imageElement).catch((error) => {
          console.error('[Content Script] Error handling image icon click:', error);
        });
    },
    onMouseEnter: () => handleIconMouseEnter(explanation.id),
    onMouseLeave: () => handleIconMouseLeave(explanation.id),
    iconRef: explanation.iconRef,
    isPanelOpen: activeId === explanation.id && store.get(imageExplanationPanelOpenAtom),
    imageElement: explanation.imageElement,
    firstChunkReceived: explanation.firstChunkReceived,
      isBookmarked: !!explanation.savedImageId,
      onBookmarkClick: explanation.savedImageId ? handleBookmarkClick : undefined,
      isHiding: explanation.isHiding || false,
    };
  });
  
  // If no icons, render empty fragment
  if (icons.length === 0) {
    imageExplanationIconRoot.render(React.createElement(React.Fragment));
    return;
  }
  
  imageExplanationIconRoot.render(
    React.createElement(Provider, { store },
      React.createElement('div', { 
        className: 'iconContainer',
        style: {
          position: 'fixed',
          zIndex: 2147483647,
          pointerEvents: 'none',
        }
      },
        icons.map((icon) =>
          React.createElement(ImageExplanationIcon, {
            key: icon.id,
            position: icon.position,
            isSpinning: icon.isSpinning,
            onClick: icon.onClick,
            useShadowDom: true,
            iconRef: icon.iconRef ? (element) => {
              if (icon.iconRef) {
                icon.iconRef.current = element;
              }
            } : undefined,
            isPanelOpen: icon.isPanelOpen,
            imageElement: icon.imageElement,
            onMouseEnter: icon.onMouseEnter,
            onMouseLeave: icon.onMouseLeave,
            firstChunkReceived: icon.firstChunkReceived,
            isBookmarked: icon.isBookmarked,
            onBookmarkClick: icon.onBookmarkClick,
            isHiding: icon.isHiding,
          })
        )
      )
    )
  );
}

/**
 * Inject Image Explanation Icon Container into the page with Shadow DOM
 */
async function injectImageExplanationIconContainer(): Promise<void> {
  if (shadowHostExists(IMAGE_EXPLANATION_ICON_HOST_ID)) {
    updateImageExplanationIconContainer();
    return;
  }
  
  const { host, shadow, mountPoint } = createShadowHost({
    id: IMAGE_EXPLANATION_ICON_HOST_ID,
    zIndex: 2147483647,
  });
  
  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);

  // Inject component styles
  injectStyles(shadow, imageExplanationIconStyles);
  injectStyles(shadow, explanationIconButtonStyles);
  injectStyles(shadow, spinnerStyles);

  document.body.appendChild(host);
  
  imageExplanationIconRoot = ReactDOM.createRoot(mountPoint);
  updateImageExplanationIconContainer();
  
  console.log('[Content Script] Image Explanation Icon Container injected successfully');
}

/**
 * Remove Image Explanation Icon Container from the page
 */
function removeImageExplanationIconContainer(): void {
  removeShadowHost(IMAGE_EXPLANATION_ICON_HOST_ID, imageExplanationIconRoot);
  imageExplanationIconRoot = null;
  console.log('[Content Script] Image Explanation Icon Container removed');
}

/**
 * Handle image hover - show icon
 */
function handleImageHover(imageElement: HTMLImageElement): void {
  // Clear any pending hide timeout
  const existingTimeout = imageHideTimeouts.get(imageElement);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    imageHideTimeouts.delete(imageElement);
  }
  
  // Skip if already hovered
  if (hoveredImages.has(imageElement)) {
    return;
  }
  
  // Skip if image is too small
  const rect = imageElement.getBoundingClientRect();
  if (rect.width < 50 || rect.height < 50) {
    return;
  }
  
  // Calculate icon position (outside image, to the left of top-left corner)
  const iconPosition = {
    x: rect.left - 30,
    y: rect.top + 8,
  };
  
  const iconId = `image-icon-${Date.now()}-${Math.random()}`;
  hoveredImages.set(imageElement, { iconId });
  
  // Create explanation state for hovered image (not yet clicked)
  const explanationId = `image-explanation-${Date.now()}`;
  const iconRef: React.MutableRefObject<HTMLElement | null> = { current: null };
  
  const newExplanation: ImageExplanationState = {
    id: explanationId,
    imageElement,
    imageFile: new Blob(), // Will be set on click
    iconPosition,
    isSpinning: false,
    streamingText: '',
    abortController: null,
    firstChunkReceived: false,
    iconRef,
    possibleQuestions: [],
    shouldAllowSimplifyMore: false,
    previousSimplifiedTexts: [],
    simplifiedExplanationCount: 0,
    chatMessages: [],
    messageQuestions: {},
      savedImageId: null,
  };
  
  // Add to explanations map
  const explanations = new Map(store.get(imageExplanationsAtom));
  explanations.set(explanationId, newExplanation);
  store.set(imageExplanationsAtom, explanations);
  
  // Inject icon container (will update if already exists, or create if removed)
  injectImageExplanationIconContainer();
}

/**
 * Handle image hover leave - hide icon if not clicked (with delay)
 */
function handleImageHoverLeave(imageElement: HTMLImageElement): void {
  const hovered = hoveredImages.get(imageElement);
  if (!hovered) return;
  
  // Check if this image has an active explanation (was clicked)
  const explanations = store.get(imageExplanationsAtom);
  const hasActiveExplanation = Array.from(explanations.values()).some(
    (exp) => exp.imageElement === imageElement && exp.firstChunkReceived
  );
  
  // Don't hide if already active
  if (hasActiveExplanation) {
    return;
  }
  
  // Find the explanation ID for this image
  const explanation = Array.from(explanations.values()).find(
    (exp) => exp.imageElement === imageElement && !exp.firstChunkReceived
  );
  
  if (!explanation) {
    return;
  }
  
  // Don't hide if explanation is currently spinning (processing)
  if (explanation.isSpinning) {
    return;
  }
  
  // Check if mouse is currently over the icon
  const isIconHovered = iconHoverStates.get(explanation.id);
  if (isIconHovered) {
    // Don't hide if mouse is over icon
    return;
  }
  
  // Set a timeout to hide the icon after a delay (500ms)
  const timeoutId = setTimeout(() => {
    // Double-check that mouse is not over icon or image
    const stillHovered = iconHoverStates.get(explanation.id);
    if (stillHovered) {
      return; // Don't hide if mouse moved to icon
    }
    
    // Double-check that explanation is not spinning (processing)
    const currentExplanations = store.get(imageExplanationsAtom);
    const currentExplanation = currentExplanations.get(explanation.id);
    if (currentExplanation?.isSpinning) {
      return; // Don't hide if explanation is processing
    }
    
    // Start hiding animation
    const animatingExplanations = new Map(currentExplanations);
    const animatingExplanation = animatingExplanations.get(explanation.id);
    if (animatingExplanation) {
      animatingExplanations.set(explanation.id, { ...animatingExplanation, isHiding: true });
      store.set(imageExplanationsAtom, animatingExplanations);
      updateImageExplanationIconContainer();
    }
    
    // After animation completes (250ms), actually remove the explanation
    setTimeout(() => {
      hoveredImages.delete(imageElement);
      imageHideTimeouts.delete(imageElement);
      
      // Remove from explanations
      const finalExplanations = new Map(store.get(imageExplanationsAtom));
      finalExplanations.delete(explanation.id);
      store.set(imageExplanationsAtom, finalExplanations);
      
      updateImageExplanationIconContainer();
    }, 250); // Animation duration
  }, 500); // 500ms delay before starting hide
  
  imageHideTimeouts.set(imageElement, timeoutId);
}

/**
 * Handle icon mouse enter - keep icon visible
 */
function handleIconMouseEnter(explanationId: string): void {
  iconHoverStates.set(explanationId, true);
  
  // Clear any pending hide timeout for the associated image
  const explanations = store.get(imageExplanationsAtom);
  const explanation = explanations.get(explanationId);
  if (explanation) {
    const timeoutId = imageHideTimeouts.get(explanation.imageElement);
    if (timeoutId) {
      clearTimeout(timeoutId);
      imageHideTimeouts.delete(explanation.imageElement);
    }
  }
}

/**
 * Handle icon mouse leave - schedule hide if image not hovered
 */
function handleIconMouseLeave(explanationId: string): void {
  iconHoverStates.set(explanationId, false);
  
  // Check if image is still hovered
  const explanations = store.get(imageExplanationsAtom);
  const explanation = explanations.get(explanationId);
  if (!explanation) {
    return;
  }
  
  // If image has active explanation, don't hide
  if (explanation.firstChunkReceived) {
    return;
  }
  
  // Don't hide if explanation is currently spinning (processing)
  if (explanation.isSpinning) {
    return;
  }
  
  // Schedule hide with delay
  const timeoutId = setTimeout(() => {
    const stillHovered = iconHoverStates.get(explanationId);
    if (stillHovered) {
      return;
    }
    
    // Double-check that explanation is not spinning (processing)
    const currentExplanations = store.get(imageExplanationsAtom);
    const currentExplanation = currentExplanations.get(explanationId);
    if (currentExplanation?.isSpinning) {
      return; // Don't hide if explanation is processing
    }
    
    // Start hiding animation
    const animatingExplanations = new Map(currentExplanations);
    const animatingExplanation = animatingExplanations.get(explanationId);
    if (animatingExplanation) {
      animatingExplanations.set(explanationId, { ...animatingExplanation, isHiding: true });
      store.set(imageExplanationsAtom, animatingExplanations);
      updateImageExplanationIconContainer();
    }
    
    // After animation completes (250ms), actually remove the explanation
    setTimeout(() => {
      hoveredImages.delete(explanation.imageElement);
      imageHideTimeouts.delete(explanation.imageElement);
      
      const finalExplanations = new Map(store.get(imageExplanationsAtom));
      finalExplanations.delete(explanationId);
      store.set(imageExplanationsAtom, finalExplanations);
      
      updateImageExplanationIconContainer();
    }, 250); // Animation duration
  }, 500);
  
  imageHideTimeouts.set(explanation.imageElement, timeoutId);
}

/**
 * Handle image icon click - trigger simplify API or toggle panel
 */
async function handleImageIconClick(imageElement: HTMLImageElement): Promise<void> {
  console.log('[Content Script] Image icon clicked');
  
  // Find the explanation for this image
  const explanations = store.get(imageExplanationsAtom);
  let explanation = Array.from(explanations.values()).find(
    (exp) => exp.imageElement === imageElement
  );
  
  if (!explanation) {
    console.warn('[Content Script] No explanation found for clicked image');
    return;
  }
  
  const explanationId = explanation.id;
  
  // Cancel any pending hide timeout for this image
  const pendingTimeout = imageHideTimeouts.get(imageElement);
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    imageHideTimeouts.delete(imageElement);
  }
  
  // Check if explanation already exists and has content (chatMessages or streamingText)
  const hasContent = (explanation.chatMessages && explanation.chatMessages.length > 0) || 
                     (explanation.streamingText && explanation.streamingText.trim().length > 0) ||
                     explanation.firstChunkReceived;
  
  if (hasContent) {
    // Explanation already has content, just toggle the panel
    console.log('[Content Script] Explanation already has content, toggling panel');
    await toggleImageExplanationPanel(explanationId);
    return;
  }
  
  // Explanation doesn't have content yet, proceed with API call
  // Convert image to file
  let imageFile: File | null = null;
  try {
    imageFile = await convertImageToFile(imageElement);
  } catch (error) {
    console.error('[Content Script] Error converting image:', error);
    if (error instanceof Error && error.name === 'SecurityError') {
      showToast('Cannot process this image due to security restrictions. Please try an image from the same website.', 'error');
    } else {
      showToast('Failed to process image. Please try again.', 'error');
    }
    return;
  }
  
  if (!imageFile) {
    console.error('[Content Script] Failed to convert image to file (likely CORS issue)');
    showToast('Cannot process this image due to security restrictions. Please try an image from the same website.', 'error');
    return;
  }
  
  // Get current explanations and active ID
  const currentExplanations = store.get(imageExplanationsAtom);
  const activeId = store.get(activeImageExplanationIdAtom);
  
  // If there's an active explanation, abort it and close its panel
  if (activeId) {
    const activeExplanation = currentExplanations.get(activeId);
    if (activeExplanation?.abortController) {
      activeExplanation.abortController.abort();
    }
    store.set(imageExplanationPanelOpenAtom, false);
  }

  // Store reference to close text panel when image panel opens (for smooth transition)
  const activeTextIdToClose = store.get(activeTextExplanationIdAtom);
  const hasTextPanelToClose = activeTextIdToClose && store.get(textExplanationPanelOpenAtom);
  
  // Update explanation with image file and set spinning
  const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
    const map = new Map(store.get(imageExplanationsAtom));
    const current = map.get(id);
    if (current) {
      map.set(id, updater(current));
      store.set(imageExplanationsAtom, map);
      return true;
    } else {
      console.warn('[Content Script] Explanation not found in map for update:', id);
      return false;
    }
  };
  
  // Ensure explanation exists before updating
  const currentMap = store.get(imageExplanationsAtom);
  if (!currentMap.has(explanationId)) {
    console.error('[Content Script] Explanation not found in map:', explanationId);
    return;
  }
  
  updateExplanationInMap(explanationId, (state) => ({
    ...state,
    imageFile,
    isSpinning: true,
    streamingText: '',
    firstChunkReceived: false,
    possibleQuestions: [],
    abortController: new AbortController(),
  }));
  
  // Set as active BEFORE calling API
  store.set(activeImageExplanationIdAtom, explanationId);
  console.log('[Content Script] Set active image explanation ID:', explanationId);
  updateImageExplanationIconContainer();
  
  // Get language code from user settings
  const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;
  
  // Call simplify_image_v2 API
  try {
    await SimplifyImageService.simplify(
      imageFile,
      [],
      languageCode,
      {
        onChunk: (_chunk, accumulated) => {
          let isFirstChunk = false;
          
          const updated = updateExplanationInMap(explanationId, (state) => {
            const updatedState = { ...state, streamingText: accumulated };
            
            // On first chunk: stop spinning, open panel
            if (!updatedState.firstChunkReceived) {
              isFirstChunk = true;
              updatedState.firstChunkReceived = true;
              updatedState.isSpinning = false;
            }
            
            return updatedState;
          });
          
          if (!updated) {
            console.error('[Content Script] Failed to update explanation in onChunk');
            return;
          }
          
          // Update UI after state is committed
          if (isFirstChunk) {
            console.log('[Content Script] First chunk received for image explanation:', explanationId);
            
            // Ensure active ID is set
            store.set(activeImageExplanationIdAtom, explanationId);
            
            // Ensure panel is injected before opening
            injectImageExplanationPanel();
            
            // Open panel
            store.set(imageExplanationPanelOpenAtom, true);
            console.log('[Content Script] Set imageExplanationPanelOpenAtom to true');
            
            // Close text panel first (if open) for smooth transition, then update image panel
            if (hasTextPanelToClose && activeTextIdToClose) {
              console.log('[Content Script] Switching from text to image explanation panel (new explanation)');
              const textExplanations = store.get(textExplanationsAtom);
              const activeTextExplanation = textExplanations.get(activeTextIdToClose);
              if (activeTextExplanation?.abortController) {
                activeTextExplanation.abortController.abort();
              }
              store.set(textExplanationPanelOpenAtom, false);
              store.set(activeTextExplanationIdAtom, null);
              updateTextExplanationPanel();
              updateTextExplanationIconContainer();
            }
            
            // Small delay to ensure state is committed
            setTimeout(() => {
              updateImageExplanationPanel();
              updateImageExplanationIconContainer();
            }, 0);
          } else {
            // Update panel with new content
            updateImageExplanationPanel();
          }
        },
        onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
          updateExplanationInMap(explanationId, (state) => {
            const existingMessages = state.chatMessages || [];
            const chatMessages = [...existingMessages];
            const currentCount = state.simplifiedExplanationCount || 0;
            const explanationNumber = currentCount > 0 ? currentCount : 1;

            const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${simplifiedText}`;
            chatMessages.push({ role: 'assistant', content: messageWithHeading });

            const messageIndex = chatMessages.length - 1;
            const messageQuestions = { ...(state.messageQuestions || {}) };
            if (possibleQuestions && possibleQuestions.length > 0) {
              messageQuestions[messageIndex] = possibleQuestions;
            }

            return {
            ...state,
              streamingText: '', // Clear streamingText since we added it to chatMessages
            shouldAllowSimplifyMore,
              possibleQuestions: [],
            abortController: null,
              isSimplifyRequest: false,
              chatMessages,
              messageQuestions,
              simplifiedExplanationCount: explanationNumber,
            };
          });
          updateImageExplanationPanel();
          updateImageExplanationIconContainer();
        },
        onError: (errorCode, errorMessage) => {
          console.error('[Content Script] Image simplify error:', errorCode, errorMessage);
          const explanations = store.get(imageExplanationsAtom);
          if (explanations.has(explanationId)) {
            removeImageExplanation(explanationId);
          }
          showToast(`Error: ${errorMessage}`, 'error');
        },
        onLoginRequired: () => {
          // Stop spinner animation when login is required
          updateExplanationInMap(explanationId, (state) => ({
            ...state,
            isSpinning: false,
            abortController: null,
          }));
          updateImageExplanationIconContainer();
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          // Stop spinner animation when subscription is required
          updateExplanationInMap(explanationId, (state) => ({
            ...state,
            isSpinning: false,
            abortController: null,
          }));
          updateImageExplanationIconContainer();
          store.set(showSubscriptionModalAtom, true);
        },
      },
      store.get(imageExplanationsAtom).get(explanationId)?.abortController || undefined
    );
  } catch (error) {
    console.error('[Content Script] Image simplify exception:', error);
    updateExplanationInMap(explanationId, (state) => ({
      ...state,
      isSpinning: false,
      abortController: null,
    }));
    showToast('An error occurred while simplifying image', 'error');
    updateImageExplanationIconContainer();
  }
}

/**
 * Handle image ask - call ask_image_v2 API
 */
async function handleImageAsk(explanationId: string, question: string): Promise<void> {
  console.log('[Content Script] Image ask:', question);
  
  const explanations = store.get(imageExplanationsAtom);
  const explanation = explanations.get(explanationId);
  
  if (!explanation) {
    console.error('[Content Script] No explanation found for image ask');
    return;
  }
  
  // Prepare chat history
  const chatHistory = explanation.chatMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
  
  // Add user message to chat history
  const updatedChatHistory = [...chatHistory, { role: 'user' as const, content: question }];
  
  // Update explanation with pending question
  const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
    const map = new Map(store.get(imageExplanationsAtom));
    const current = map.get(id);
    if (current) {
      map.set(id, updater(current));
      store.set(imageExplanationsAtom, map);
    }
  };
  
  // Create new abort controller
  const newAbortController = new AbortController();
  updateExplanationInMap(explanationId, (state) => ({
    ...state,
    abortController: newAbortController,
    chatMessages: updatedChatHistory,
  }));
  
  // Update panel to show loading state
  updateImageExplanationPanel();
  
  // Get language code
  const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;
  
  try {
    await AskImageService.ask(
      explanation.imageFile,
      question,
      chatHistory, // Send old history (without new user message)
      'TEXT',
      languageCode,
      {
        onChunk: (_chunk, accumulated) => {
          updateExplanationInMap(explanationId, (state) => {
            // Update the last message (assistant message) with streaming text
            const updatedMessages = [...state.chatMessages];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                content: accumulated,
              };
            } else {
              // Add new assistant message
              updatedMessages.push({
                role: 'assistant',
                content: accumulated,
              });
            }
            
            return {
              ...state,
              chatMessages: updatedMessages,
            };
          });
          updateImageExplanationPanel();
        },
        onComplete: (updatedChatHistory, questions) => {
          // Extract only the assistant message from updatedChatHistory
          const assistantMessage = updatedChatHistory[updatedChatHistory.length - 1];
          
          // Verify it's an assistant message
          if (assistantMessage && assistantMessage.role === 'assistant') {
            updateExplanationInMap(explanationId, (state) => {
              // The message is already in chatMessages from onChunk, just update the last one with final content
              const updatedMessages = [...state.chatMessages];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              
              if (lastMessage && lastMessage.role === 'assistant') {
                // Update the existing assistant message with final content
                updatedMessages[updatedMessages.length - 1] = {
                  ...lastMessage,
                  content: assistantMessage.content,
                };
              } else {
                // Fallback: add if somehow not present
                updatedMessages.push(assistantMessage);
              }
            
            // Store questions for the last assistant message (by index)
              const messageQuestions = { ...(state.messageQuestions || {}) };
              if (questions && questions.length > 0) {
                const assistantMessageIndex = updatedMessages.length - 1;
                messageQuestions[assistantMessageIndex] = questions;
            }
            
              return {
              ...state,
                chatMessages: updatedMessages,
                messageQuestions,
              abortController: null,
              };
            });
          }
          
          updateImageExplanationPanel();
        },
        onError: (errorCode, errorMessage) => {
          console.error('[Content Script] Image ask error:', errorCode, errorMessage);
          updateExplanationInMap(explanationId, (state) => ({
            ...state,
            abortController: null,
          }));
          showToast(`Error: ${errorMessage}`, 'error');
          updateImageExplanationPanel();
        },
        onLoginRequired: () => {
          store.set(showLoginModalAtom, true);
        },
      },
      newAbortController
    );
  } catch (error) {
    console.error('[Content Script] Image ask exception:', error);
    updateExplanationInMap(explanationId, (state) => ({
      ...state,
      abortController: null,
    }));
    showToast('An error occurred while asking about image', 'error');
    updateImageExplanationPanel();
  }
}

/**
 * Handle image simplify more
 */
async function handleImageSimplifyMore(explanationId: string): Promise<void> {
  const explanations = store.get(imageExplanationsAtom);
  const explanation = explanations.get(explanationId);
  
  if (!explanation) {
    console.error('[Content Script] No explanation found for image simplify more');
    return;
  }
  
  const previousSimplifiedTexts = [...explanation.previousSimplifiedTexts, explanation.streamingText];
  
  const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
    const map = new Map(store.get(imageExplanationsAtom));
    const current = map.get(id);
    if (current) {
      map.set(id, updater(current));
      store.set(imageExplanationsAtom, map);
    }
  };
  
  const newAbortController = new AbortController();
  updateExplanationInMap(explanationId, (state) => ({
    ...state,
    abortController: newAbortController,
    streamingText: '',
    firstChunkReceived: false,
    possibleQuestions: [],
    isSimplifyRequest: true,
    previousSimplifiedTexts,
    simplifiedExplanationCount: state.simplifiedExplanationCount + 1,
  }));
  
  updateImageExplanationPanel();
  
  const nativeLanguage = await ChromeStorage.getUserSettingNativeLanguage();
  const languageCode = nativeLanguage ? (getLanguageCode(nativeLanguage) || undefined) : undefined;
  
  try {
    await SimplifyImageService.simplify(
      explanation.imageFile,
      previousSimplifiedTexts,
      languageCode,
      {
        onChunk: (_chunk, accumulated) => {
          updateExplanationInMap(explanationId, (state) => ({
            ...state,
            streamingText: accumulated,
            firstChunkReceived: true,
          }));
          updateImageExplanationPanel();
        },
        onComplete: (simplifiedText, shouldAllowSimplifyMore, possibleQuestions) => {
          updateExplanationInMap(explanationId, (state) => {
            const existingMessages = state.chatMessages || [];
            const chatMessages = [...existingMessages];
            const explanationNumber = state.simplifiedExplanationCount || 1;

            const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${simplifiedText}`;
            chatMessages.push({ role: 'assistant', content: messageWithHeading });

            const messageIndex = chatMessages.length - 1;
            const messageQuestions = { ...(state.messageQuestions || {}) };
            if (possibleQuestions && possibleQuestions.length > 0) {
              messageQuestions[messageIndex] = possibleQuestions;
            }

            return {
            ...state,
              streamingText: '', // Clear streamingText since we added it to chatMessages
            shouldAllowSimplifyMore,
              possibleQuestions: [],
            abortController: null,
            isSimplifyRequest: false,
              chatMessages,
              messageQuestions,
            };
          });
          updateImageExplanationPanel();
        },
        onError: (errorCode, errorMessage) => {
          console.error('[Content Script] Image simplify more error:', errorCode, errorMessage);
          updateExplanationInMap(explanationId, (state) => ({
            ...state,
            abortController: null,
            isSimplifyRequest: false,
          }));
          showToast(`Error: ${errorMessage}`, 'error');
          updateImageExplanationPanel();
        },
        onLoginRequired: () => {
          store.set(showLoginModalAtom, true);
        },
      },
      newAbortController
    );
  } catch (error) {
    console.error('[Content Script] Image simplify more exception:', error);
    updateExplanationInMap(explanationId, (state) => ({
      ...state,
      abortController: null,
      isSimplifyRequest: false,
    }));
    showToast('An error occurred while simplifying image', 'error');
    updateImageExplanationPanel();
  }
}

// Stable callback functions for image explanation panel
let handleImageQuestionClickCallback: ((question: string) => Promise<void>) | null = null;
let handleImageInputSubmitCallback: ((inputText: string) => Promise<void>) | null = null;
let handleImageCloseCallback: (() => void) | null = null;
let handleImageSimplifyCallback: (() => Promise<void>) | null = null;

// Store reference to panel's close handler for animated close from icon toggle
let imageExplanationPanelCloseHandler: (() => void) | null = null;

let isUpdatingImagePanel = false;
let pendingImageUpdate = false;

/**
 * Update image explanation panel state
 */
function updateImageExplanationPanel(): void {
  if (!imageExplanationPanelRoot) {
    console.warn('[Content Script] imageExplanationPanelRoot is null, cannot update panel');
    return;
  }
  
  if (isUpdatingImagePanel) {
    pendingImageUpdate = true;
    return;
  }
  
  isUpdatingImagePanel = true;
  pendingImageUpdate = false;
  
  const activeId = store.get(activeImageExplanationIdAtom);
  const panelOpen = store.get(imageExplanationPanelOpenAtom);
  const explanations = store.get(imageExplanationsAtom);
  const activeExplanation = activeId ? explanations.get(activeId) : null;
  
  console.log('[Content Script] updateImageExplanationPanel:', {
    activeId,
    panelOpen,
    hasActiveExplanation: !!activeExplanation,
    explanationId: activeExplanation?.id,
    explanationsCount: explanations.size,
    allExplanationIds: Array.from(explanations.keys()),
  });
  
  if (!activeExplanation || !panelOpen) {
    console.log('[Content Script] Panel closed or no active explanation, rendering empty');
    imageExplanationPanelRoot.render(React.createElement(React.Fragment));
    isUpdatingImagePanel = false;
    return;
  }
  
  const streamingText = activeExplanation.streamingText || '';
  const possibleQuestions = activeExplanation.possibleQuestions || [];
  const shouldAllowSimplifyMore = activeExplanation.shouldAllowSimplifyMore || false;
  const firstChunkReceived = activeExplanation.firstChunkReceived || false;
  const chatMessages = activeExplanation.chatMessages || [];
  const messageQuestions = activeExplanation.messageQuestions || {};
  const isRequesting = activeExplanation.abortController !== null;
  const isSimplifying = activeExplanation.isSimplifyRequest === true;

  // Determine header icon visibility and delete icon visibility
  const hasContent =
    (chatMessages && chatMessages.length > 0) ||
    (typeof streamingText === 'string' && streamingText.trim().length > 0);
  const showHeaderIcons = hasContent;
  const showDeleteIcon = hasContent;
  
  const explanationId = activeExplanation.id;
  
  // Set up callbacks
  if (!handleImageQuestionClickCallback) {
    handleImageQuestionClickCallback = async (question: string) => {
      await handleImageAsk(explanationId, question);
    };
  }
  
  if (!handleImageInputSubmitCallback) {
    handleImageInputSubmitCallback = async (inputText: string) => {
      await handleImageAsk(explanationId, inputText);
    };
  }
  
  if (!handleImageCloseCallback) {
    handleImageCloseCallback = () => {
      store.set(imageExplanationPanelOpenAtom, false);
      store.set(activeImageExplanationIdAtom, null);
      updateImageExplanationPanel();
    };
  }
  
  if (!handleImageSimplifyCallback) {
    handleImageSimplifyCallback = async () => {
      await handleImageSimplifyMore(explanationId);
    };
  }

  const handleImageRemoveCallback = () => {
    removeImageExplanation(explanationId);
  };

  const handleImageClearChatCallback = () => {
    if (explanationId) {
      const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
        const map = new Map(store.get(imageExplanationsAtom));
        const current = map.get(id);
        if (current) {
          map.set(id, updater(current));
          store.set(imageExplanationsAtom, map);
        }
      };

      updateExplanationInMap(explanationId, (state) => {
        // Clear abortController and abort any ongoing requests
        if (state.abortController) {
          state.abortController.abort();
        }

        return {
          ...state,
          chatMessages: [],
          messageQuestions: {},
          streamingText: '',
          possibleQuestions: [],
          abortController: null,
          firstChunkReceived: false,
          // Clear simplified explanation state so Simplify button starts fresh
          previousSimplifiedTexts: [],
          simplifiedExplanationCount: 0,
          // Reset shouldAllowSimplifyMore - if we cleared chat, we should allow simplifying the original image again
          shouldAllowSimplifyMore: true,
          isSimplifyRequest: false,
        };
      });

      updateImageExplanationPanel();
    }
  };

  const handleImageBookmarkCallback = () => {
    if (!activeExplanation) {
      console.log('[Content Script] No active explanation for bookmark');
      return;
    }

    // If already bookmarked, delete the bookmark
    if (activeExplanation.savedImageId) {
      console.log('[Content Script] Deleting image bookmark:', activeExplanation.savedImageId);
      
      SavedImageService.deleteSavedImage(
        activeExplanation.savedImageId,
        {
          onSuccess: () => {
            console.log('[Content Script] Image bookmark deleted successfully');
            
            // Update explanation state to clear savedImageId
            const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
              const map = new Map(store.get(imageExplanationsAtom));
              const current = map.get(id);
              if (current) {
                map.set(id, updater(current));
                store.set(imageExplanationsAtom, map);
              }
            };
            
            updateExplanationInMap(explanationId, (state) => ({
              ...state,
              savedImageId: null,
            }));
            
            // Update icon container to hide bookmark icon
            updateImageExplanationIconContainer();
            
            // Update panel to show unfilled bookmark
            updateImageExplanationPanel();
            
            showToast('Bookmark removed successfully!', 'success');
          },
          onError: (errorCode, message) => {
            console.error('[Content Script] Failed to delete image bookmark:', errorCode, message);
            let displayMessage = 'Failed to remove bookmark';
            
            if (errorCode === 'NOT_FOUND') {
              displayMessage = 'Bookmark not found';
            } else if (errorCode === 'NETWORK_ERROR') {
              displayMessage = 'Network error. Please check your connection.';
            } else if (message) {
              displayMessage = message;
            }
            
            showToast(displayMessage, 'error');
          },
          onLoginRequired: () => {
            console.log('[Content Script] Login required to delete image bookmark');
            store.set(showLoginModalAtom, true);
          },
          onSubscriptionRequired: () => {
            console.log('[Content Script] Subscription required to delete image bookmark');
            store.set(showSubscriptionModalAtom, true);
          },
        }
      );
      return;
    }

    // If not bookmarked, open folder modal to save
    console.log('[Content Script] Bookmark clicked for image explanation');
    
    // Store image data in modal state
    folderModalImageElement = activeExplanation.imageElement;
    folderModalImageFile = activeExplanation.imageFile;
    
    // Set mode to image
    folderModalMode = 'image';
    
    // Get folders and show modal
    FolderService.getAllFolders(
      {
        onSuccess: async (response) => {
          console.log('[Content Script] Folders loaded successfully for image:', response.folders.length, 'folders');
          folderModalFolders = response.folders;
          
          // Check for stored preference folder ID and auto-select/expand if found
          const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Retrieved stored bookmark folder ID from storage:', storedFolderId);
          if (storedFolderId) {
            const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
            if (ancestorPath !== null) {
              folderModalSelectedFolderId = storedFolderId;
              // Expand all ancestor folders to show the hierarchical path
              folderModalExpandedFolders = new Set(ancestorPath);
              console.log('[Content Script] Auto-selected preferred image folder:', storedFolderId, 'with ancestors:', ancestorPath);
            } else {
              folderModalSelectedFolderId = null;
              folderModalExpandedFolders = new Set();
              console.log('[Content Script] Stored image folder ID not found in tree, clearing selection. Stored ID:', storedFolderId, 'Available folders:', response.folders);
            }
          } else {
            folderModalSelectedFolderId = null;
            folderModalExpandedFolders = new Set();
            console.log('[Content Script] No stored image folder preference found');
          }
          
          folderModalRememberCheckedInitialized = false; // Reset flag when modal opens
          folderModalOpen = true;
          injectFolderListModal();
          updateFolderListModal();
        },
        onError: (errorCode, message) => {
          console.error('[Content Script] Failed to load folders for image:', errorCode, message);
          showToast(`Failed to load folders: ${message}`, 'error');
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required to load folders for image');
          store.set(showLoginModalAtom, true);
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required to load folders for image');
          store.set(showSubscriptionModalAtom, true);
        },
      }
    );
  };

  const handleImageViewOriginalCallback = () => {
    if (!activeExplanation) {
      console.log('[Content Script] No image explanation state available for view original');
      return;
    }
    scrollToAndHighlightImage(activeExplanation.imageElement);
  };
  
  try {
    imageExplanationPanelRoot.render(
      React.createElement(Provider, { store },
        React.createElement(TextExplanationSidePanel, {
          isOpen: true,
          onClose: handleImageCloseCallback,
          iconRef: activeExplanation.iconRef,
          useShadowDom: true,
          onLoginRequired: () => {
            store.set(showLoginModalAtom, true);
          },
          streamingText,
          viewMode: 'contextual',
          possibleQuestions,
          onQuestionClick: handleImageQuestionClickCallback,
          onInputSubmit: handleImageInputSubmitCallback,
          chatMessages,
          messageQuestions,
          onClearChat: handleImageClearChatCallback,
          onStopRequest: () => {
            const exp = store.get(imageExplanationsAtom).get(explanationId);
            if (!exp) return;
            
            // Abort the request
            if (exp.abortController) {
              exp.abortController.abort();
            }
            
            // Update state to revert button states
            const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
              const map = new Map(store.get(imageExplanationsAtom));
              const current = map.get(id);
              if (current) {
                map.set(id, updater(current));
                store.set(imageExplanationsAtom, map);
              }
            };
            
            updateExplanationInMap(explanationId, (state) => {
              // If we have streaming text and it's a simplify request, save it to chat history
              if (state.streamingText && state.streamingText.trim().length > 0 && state.isSimplifyRequest) {
                const existingMessages = state.chatMessages || [];
                const chatMessages = [...existingMessages];
                const currentCount = state.simplifiedExplanationCount || 0;
                const explanationNumber = currentCount > 0 ? currentCount : 1;
                
                const messageWithHeading = `## Simplified explanation ${explanationNumber}\n\n${state.streamingText}`;
                chatMessages.push({ role: 'assistant', content: messageWithHeading });
                
                return {
                  ...state,
                  chatMessages,
                  streamingText: '',
                  abortController: null,
                  isSimplifyRequest: false,
                  firstChunkReceived: false,
                };
              }
              
              // For ask requests, the streaming text is already in chatMessages (updated in onChunk)
              // Just clear the streaming state and reset flags
              return {
                ...state,
                streamingText: '',
                abortController: null,
                isSimplifyRequest: false,
                firstChunkReceived: false,
              };
            });
            
            updateImageExplanationPanel();
          },
          isRequesting,
          shouldAllowSimplifyMore,
          onSimplify: handleImageSimplifyCallback,
          isSimplifying,
          showHeaderIcons,
          showDeleteIcon,
          onRemove: handleImageRemoveCallback,
          onViewOriginal: handleImageViewOriginalCallback,
          onBookmark: handleImageBookmarkCallback,
          isBookmarked: !!activeExplanation.savedImageId,
          hideFooter: true,
          firstChunkReceived,
          onCloseHandlerReady: (handler) => {
            console.log('[index.ts] Close handler registered from ImageExplanationSidePanel');
            imageExplanationPanelCloseHandler = handler;
          },
        })
      )
    );
  } finally {
    isUpdatingImagePanel = false;
    if (pendingImageUpdate) {
      setTimeout(() => {
        updateImageExplanationPanel();
      }, 0);
    }
  }
}

/**
 * Inject Image Explanation Panel into the page with Shadow DOM
 */
async function injectImageExplanationPanel(): Promise<void> {
  if (shadowHostExists(IMAGE_EXPLANATION_PANEL_HOST_ID)) {
    console.log('[Content Script] Image explanation panel host already exists, updating');
    updateImageExplanationPanel();
    return;
  }
  
  console.log('[Content Script] Creating new image explanation panel shadow host');
  const { host, shadow, mountPoint } = createShadowHost({
    id: IMAGE_EXPLANATION_PANEL_HOST_ID,
    zIndex: 2147483643,
  });
  
  // Inject component styles first (they define variables after all:initial)
  injectStyles(shadow, textExplanationSidePanelStyles);
  // Then inject color variables to override/ensure they're set - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);
  // Inject MinimizeIcon styles
  injectStyles(shadow, minimizeIconStyles);
  // Inject base side panel styles for upgrade footer (coupon and upgrade buttons)
  injectStyles(shadow, baseSidePanelStyles);
  
  document.body.appendChild(host);
  console.log('[Content Script] Image explanation panel host appended to body');
  
  imageExplanationPanelRoot = ReactDOM.createRoot(mountPoint);
  console.log('[Content Script] Image explanation panel root created');
  updateImageExplanationPanel();
  
  console.log('[Content Script] Image Explanation Panel injected successfully');
}

/**
 * Remove Image Explanation Panel from the page
 */
function removeImageExplanationPanel(): void {
  removeShadowHost(IMAGE_EXPLANATION_PANEL_HOST_ID, imageExplanationPanelRoot);
  imageExplanationPanelRoot = null;
  console.log('[Content Script] Image Explanation Panel removed');
}

/**
 * Setup image hover detection
 */
function setupImageHoverDetection(): void {
  // Find all images on the page
  const images = document.querySelectorAll('img');
  
  images.forEach((img) => {
    // Skip if already has listeners
    if ((img as any).__xplainoImageListener) {
      return;
    }
    
    const handleMouseEnter = () => {
      handleImageHover(img);
    };
    
    const handleMouseLeave = () => {
      handleImageHoverLeave(img);
    };
    
    img.addEventListener('mouseenter', handleMouseEnter);
    img.addEventListener('mouseleave', handleMouseLeave);
    
    // Mark as having listeners
    (img as any).__xplainoImageListener = true;
    (img as any).__xplainoImageMouseEnter = handleMouseEnter;
    (img as any).__xplainoImageMouseLeave = handleMouseLeave;
  });
  
  // Use MutationObserver to handle dynamically added images
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          // Check if the added node is an image
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (!(img as any).__xplainoImageListener) {
              const handleMouseEnter = () => handleImageHover(img);
              const handleMouseLeave = () => handleImageHoverLeave(img);
              img.addEventListener('mouseenter', handleMouseEnter);
              img.addEventListener('mouseleave', handleMouseLeave);
              (img as any).__xplainoImageListener = true;
              (img as any).__xplainoImageMouseEnter = handleMouseEnter;
              (img as any).__xplainoImageMouseLeave = handleMouseLeave;
            }
          }
          // Check for images within the added node
          const images = element.querySelectorAll('img');
          images.forEach((img) => {
            if (!(img as any).__xplainoImageListener) {
              const handleMouseEnter = () => handleImageHover(img);
              const handleMouseLeave = () => handleImageHoverLeave(img);
              img.addEventListener('mouseenter', handleMouseEnter);
              img.addEventListener('mouseleave', handleMouseLeave);
              (img as any).__xplainoImageListener = true;
              (img as any).__xplainoImageMouseEnter = handleMouseEnter;
              (img as any).__xplainoImageMouseLeave = handleMouseLeave;
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('[Content Script] Image hover detection setup complete');
}

// =============================================================================
// WORD EXPLANATION POPOVER
// =============================================================================

/**
 * Inject Word Explanation Popover into the page with Shadow DOM
 */
async function injectWordExplanationPopover(): Promise<void> {
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

  // CRITICAL: Inject theme-aware color variables FIRST
  const colorVariables = await getAllColorVariables();
  injectStyles(hostResult.shadow, colorVariables, true);

  // Then inject component styles
  injectStyles(hostResult.shadow, wordExplanationPopoverStyles);
  injectStyles(hostResult.shadow, minimizeIconStyles);
  injectStyles(hostResult.shadow, spinnerStyles);

  // Add spin keyframe animation (needed for spinner)
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulsate-primary {
      0%, 100% { background-color: ${COLORS.PRIMARY_OPACITY_10}; }
      50% { background-color: ${COLORS.PRIMARY_OPACITY_25}; }
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
        onSuccess: async () => {
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
              await applyGreenWordSpanStyling(localState.wordSpanElement, wordId, false);
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
    // Show folder selection modal for saving word
    console.log('[Content Script] Opening folder modal for word:', atomState.word);
    const contextualMeaning = atomState.meaning || atomState.streamedContent;
    console.log('[Content Script] Contextual meaning:', contextualMeaning ? contextualMeaning.substring(0, 100) : 'null');
    
    // Store word data in modal state
    folderModalWord = atomState.word;
    folderModalWordContextualMeaning = contextualMeaning || null;
    folderModalWordId = wordId;
    folderModalMode = 'word';
    
    // Get folders and show modal
    FolderService.getAllFolders(
      {
        onSuccess: async (response) => {
          console.log('[Content Script] Folders loaded successfully for word:', response.folders.length, 'folders');
          folderModalFolders = response.folders;
          
          // Check for stored preference folder ID and auto-select/expand if found
          const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Retrieved stored bookmark folder ID from storage:', storedFolderId);
          if (storedFolderId) {
            const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
            if (ancestorPath !== null) {
              folderModalSelectedFolderId = storedFolderId;
              // Expand all ancestor folders to show the hierarchical path
              folderModalExpandedFolders = new Set(ancestorPath);
              console.log('[Content Script] Auto-selected preferred word folder:', storedFolderId, 'with ancestors:', ancestorPath);
            } else {
              folderModalSelectedFolderId = null;
              folderModalExpandedFolders = new Set();
              console.log('[Content Script] Stored word folder ID not found in tree, clearing selection. Stored ID:', storedFolderId, 'Available folders:', response.folders);
            }
          } else {
            folderModalSelectedFolderId = null;
            folderModalExpandedFolders = new Set();
            console.log('[Content Script] No stored word folder preference found');
          }
          
          folderModalRememberCheckedInitialized = false; // Reset flag when modal opens
          folderModalOpen = true;
          injectFolderListModal();
          updateFolderListModal();
        },
        onError: (errorCode, message) => {
          console.error('[Content Script] Failed to load folders for word:', errorCode, message);
          showToast(`Failed to load folders: ${message}`, 'error');
          // Reset word state on error
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
        },
        onLoginRequired: () => {
          console.log('[Content Script] Login required to load folders for word');
          store.set(showLoginModalAtom, true);
          // Reset word state
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
        },
        onSubscriptionRequired: () => {
          console.log('[Content Script] Subscription required to load folders for word');
          store.set(showSubscriptionModalAtom, true);
          // Reset word state
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(wordId);
          if (currentState) {
            updated.set(wordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
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
    console.log('[Content Script] Checking wordId:', wordId, 'popoverVisible:', state.popoverVisible, 'word:', state.word);
    if (state.popoverVisible) {
      visibleWordState = state;
      visibleWordId = wordId;
      break;
    }
  }

  // Determine which state to use for rendering
  let stateToRender: WordExplanationLocalState | null = null;
  let wordIdToRender: string | null = null;
  let isVisible = false;

  console.log('[Content Script] Visibility state check:', {
    hasVisibleWord: !!visibleWordState,
    visibleWordId,
    hasLastVisibleWordInfo: !!lastVisibleWordInfo,
    lastVisibleWordId: lastVisibleWordInfo?.wordId,
  });

  if (visibleWordState && visibleWordId) {
    // A popover is currently visible - update lastVisibleWordInfo for animation
    stateToRender = visibleWordState;
    wordIdToRender = visibleWordId;
    isVisible = true;
    lastVisibleWordInfo = {
      wordId: visibleWordId,
      state: visibleWordState,
    };
    console.log('[Content Script] Found visible word explanation, saving to lastVisibleWordInfo:', {
      wordId: visibleWordId,
      word: visibleWordState.word,
      isVisible: true,
    });
  } else if (lastVisibleWordInfo) {
    // No visible popover, but we have a last visible one - render with visible=false for shrink animation
    stateToRender = lastVisibleWordInfo.state;
    wordIdToRender = lastVisibleWordInfo.wordId;
    isVisible = false;
    console.log('[Content Script] No visible popover, but using lastVisibleWordInfo for fade-out animation:', {
      wordId: lastVisibleWordInfo.wordId,
      word: lastVisibleWordInfo.state.word,
      isVisible: false,
    });
  }

  if (!stateToRender || !wordIdToRender) {
    // No visible popover and no last visible info - render empty
    console.log('[Content Script] No visible word explanation and no lastVisibleWordInfo, rendering empty fragment');
    wordExplanationPopoverRoot.render(React.createElement(React.Fragment));
    return;
  }

  console.log('[Content Script] Rendering word explanation with state:', {
    wordId: wordIdToRender,
    word: stateToRender.word,
    contentLength: stateToRender.streamedContent.length,
    isLoading: stateToRender.isLoading,
    hasSourceRef: !!stateToRender.sourceRef.current,
    sourceRefElement: stateToRender.sourceRef.current?.tagName,
    isVisible,
  });

  // Handler for tab change
  // Get atom state for this word
  const atomState = store.get(wordExplanationsAtom).get(wordIdToRender);

  const handleTabChange = (tab: TabType) => {
    const state = wordExplanationsMap.get(wordIdToRender!);
    if (state) {
      state.activeTab = tab;
      updateWordExplanationPopover();
    }
    // Also update atom state
    if (atomState) {
      const updated: WordExplanationAtomState = { ...atomState, activeTab: tab };
      const map = new Map(store.get(wordExplanationsAtom));
      map.set(wordIdToRender!, updated);
      store.set(wordExplanationsAtom, map);
    }
  };

  // Handler for close
  const handleClose = () => {
    console.log('[Content Script] handleClose called (minimize button clicked):', {
      wordId: wordIdToRender,
      hasState: !!wordExplanationsMap.get(wordIdToRender!),
    });
    
    const state = wordExplanationsMap.get(wordIdToRender!);
    if (state) {
      console.log('[Content Script] handleClose - setting popoverVisible to false:', {
        word: state.word,
        previousVisible: state.popoverVisible,
      });
      state.popoverVisible = false;
      console.log('[Content Script] handleClose - calling updateWordExplanationPopover');
      updateWordExplanationPopover();
      console.log('[Content Script] handleClose - update complete');
    }
  };

  // Handler for animation complete (shrink animation finished)
  const handleAnimationComplete = () => {
    console.log('[Content Script] handleAnimationComplete called - fade-out animation finished:', {
      hadLastVisibleWordInfo: !!lastVisibleWordInfo,
      lastVisibleWordId: lastVisibleWordInfo?.wordId,
    });
    
    lastVisibleWordInfo = null;
    console.log('[Content Script] handleAnimationComplete - cleared lastVisibleWordInfo');
    
    // Now render empty fragment since animation is done
    if (wordExplanationPopoverRoot) {
      console.log('[Content Script] handleAnimationComplete - rendering empty fragment');
      wordExplanationPopoverRoot.render(React.createElement(React.Fragment));
    }
    
    console.log('[Content Script] handleAnimationComplete - complete');
  };

  // Render popover
  console.log('[Content Script] Rendering WordExplanationPopover component with props:', {
    word: stateToRender.word,
    visible: isVisible,
    contentLength: stateToRender.streamedContent.length,
    activeTab: stateToRender.activeTab,
    isLoading: stateToRender.isLoading,
    hasSourceRef: !!stateToRender.sourceRef.current,
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
        word: stateToRender.word,
        sourceRef: stateToRender.sourceRef,
        visible: isVisible,
        content: stateToRender.streamedContent,
        activeTab: stateToRender.activeTab,
        onTabChange: handleTabChange,
        onClose: handleClose,
        onAnimationComplete: handleAnimationComplete,
        useShadowDom: true,
        isLoading: stateToRender.isLoading,
        errorMessage: stateToRender.errorMessage || undefined,
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
        onBookmarkClick: () => handleWordBookmarkClick(wordIdToRender!),
        onDelete: () => {
          removeWordExplanation(wordIdToRender!);
        },
        // Handlers
        onGetContextualMeaning: () => handleGetContextualMeaning(wordIdToRender!),
        onGetMoreExamples: () => handleGetMoreExamples(wordIdToRender!),
        onGetSynonyms: () => handleGetSynonyms(wordIdToRender!),
        onGetAntonyms: () => handleGetAntonyms(wordIdToRender!),
        onTranslate: () => handleTranslateWord(wordIdToRender!),
        onAskAI: () => handleAskAI(wordIdToRender!),
        onAskAIButtonMount: (ref) => {
          // Store the button ref in state for positioning
          const currentState = store.get(wordExplanationsAtom).get(wordIdToRender!);
          if (currentState) {
            const updated: WordExplanationAtomState = {
              ...currentState,
              askAIButtonRef: ref,
            };
            const map = new Map(store.get(wordExplanationsAtom));
            map.set(wordIdToRender!, updated);
            store.set(wordExplanationsAtom, map);
            updateWordAskAISidePanel();
          }
        },
        askAISidePanelRef: (() => {
          // Get ref to the Ask AI side panel shadow host
          const panelHost = document.getElementById(WORD_ASK_AI_PANEL_HOST_ID);
          if (panelHost?.shadowRoot) {
            const panel = panelHost.shadowRoot.querySelector('.wordAskAISidePanel') as HTMLElement;
            return panel ? { current: panel } : undefined;
          }
          return undefined;
        })(),
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
async function injectWordAskAISidePanel(): Promise<void> {
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

  // CRITICAL: Inject theme-aware color variables FIRST
  const colorVariables = await getAllColorVariables();
  injectStyles(hostResult.shadow, colorVariables, true);

  // Then inject component styles
  injectStyles(hostResult.shadow, wordAskAISidePanelStyles);
  // Inject MinimizeIcon styles
  injectStyles(hostResult.shadow, minimizeIconStyles);
  // Inject base side panel styles for upgrade footer (coupon and upgrade buttons)
  injectStyles(hostResult.shadow, baseSidePanelStyles);

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

  // Get local state to check actual popover visibility (more reliable than atom state)
  const localState = wordExplanationsMap.get(wordId);
  const isPopoverOpen = localState?.popoverVisible ?? false;

  console.log('[Content Script] Rendering WordAskAISidePanel for word:', atomState.word, {
    isPopoverOpen,
    atomStatePopoverVisible: atomState.popoverVisible,
    localStatePopoverVisible: localState?.popoverVisible,
  });

  wordAskAISidePanelRoot.render(
    React.createElement(
      Provider,
      { store },
      React.createElement(WordAskAISidePanel, {
        isOpen: isOpen,
        onClose: handleAskAIClose,
        word: atomState.word,
        buttonRef: atomState.sourceRef,
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
        askAIButtonRef: atomState.askAIButtonRef || undefined,
        isWordPopoverOpen: isPopoverOpen,
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
      // Use wrapper element for scroll tracking (more reliable than Range on some websites)
      wrapperElement: state.underlineState?.wrapperElement || null,
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
async function injectTextExplanationIconContainer(): Promise<void> {
  if (shadowHostExists(TEXT_EXPLANATION_ICON_HOST_ID)) {
    updateTextExplanationIconContainer();
    return;
  }

  const { host, shadow, mountPoint } = createShadowHost({
    id: TEXT_EXPLANATION_ICON_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);
  injectStyles(shadow, textExplanationIconStyles);
  injectStyles(shadow, explanationIconButtonStyles);
  injectStyles(shadow, spinnerStyles);

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
 * Remove image explanation completely (icon, panel, and state)
 */
function removeImageExplanation(explanationId: string): void {
  const explanations = store.get(imageExplanationsAtom);
  const explanation = explanations.get(explanationId);

  if (!explanation) {
    console.log('[Content Script] No image explanation state to remove');
    return;
  }

  // Clear hover and timeout state for this image
  hoveredImages.delete(explanation.imageElement);
  const timeoutId = imageHideTimeouts.get(explanation.imageElement);
  if (timeoutId) {
    clearTimeout(timeoutId);
    imageHideTimeouts.delete(explanation.imageElement);
  }
  iconHoverStates.delete(explanationId);

  // Remove from map
  const newMap = new Map(explanations);
  newMap.delete(explanationId);
  store.set(imageExplanationsAtom, newMap);

  // If this was the active explanation, clear active ID and close panel
  const activeId = store.get(activeImageExplanationIdAtom);
  if (explanationId === activeId) {
    store.set(activeImageExplanationIdAtom, null);
    store.set(imageExplanationPanelOpenAtom, false);
    removeImageExplanationPanel();
  }

  // Update icon container (will hide if no explanations left)
  updateImageExplanationIconContainer();

  // If no explanations left, remove icon container
  if (newMap.size === 0) {
    removeImageExplanationIconContainer();
  }

  console.log('[Content Script] Image explanation removed completely');
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
    
    // Note: Pulsation animation is handled separately by pulseTextBackground()
    // which is called after this function

  } catch (error) {
    console.error('[Content Script] Error in scrollToAndHighlightText:', error);
  }
}

/**
 * Scroll to image element and briefly highlight it
 */
function scrollToAndHighlightImage(imageElement: HTMLImageElement): void {
  if (!imageElement || !document.contains(imageElement)) {
    console.warn('[Content Script] Image element not found for scrollToAndHighlightImage');
    return;
  }

  try {
    const rect = imageElement.getBoundingClientRect();
    const scrollY = window.scrollY + rect.top - 150; // Offset for better visibility

    window.scrollTo({
      top: scrollY,
      behavior: 'smooth',
    });

    const originalBoxShadow = imageElement.style.boxShadow;
    imageElement.style.boxShadow = `0 0 0 3px ${COLORS.SUCCESS}`;

    setTimeout(() => {
      imageElement.style.boxShadow = originalBoxShadow;
    }, 1500);
  } catch (error) {
    console.error('[Content Script] Error in scrollToAndHighlightImage:', error);
  }
}

// =============================================================================
// DISABLE NOTIFICATION MODAL INJECTION
// =============================================================================

/**
 * Inject Disable Notification Modal into the page with Shadow DOM
 */
async function injectDisableModal(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
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
async function injectToast(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(TOAST_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: TOAST_HOST_ID,
    zIndex: 2147483648, // Highest z-index for toast
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
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
            // Theme-aware background using CSS variable from extension settings
            background: 'var(--color-bg-primary-theme)',
            border: toastType === 'error' ? `2px solid ${COLORS.ERROR}` : `2px solid ${COLORS.SUCCESS}`,
            color: toastType === 'error' ? COLORS.ERROR : COLORS.SUCCESS,
            padding: '0.75rem 1.5rem',
            borderRadius: '13px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '0.9375rem',
            fontWeight: '500',
            boxShadow: `0 4px 12px ${COLORS.PRIMARY_OPACITY_15}`,
            animation: toastClosing ? 'slideOut 0.3s ease-in forwards' : 'slideIn 0.3s ease-out',
            whiteSpace: 'nowrap',
            maxWidth: '400px',
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
// BOOKMARK TOAST INJECTION
// =============================================================================

/**
 * Show bookmark toast with link to saved bookmarks page
 */
async function showBookmarkToast(type: 'word' | 'paragraph' | 'link' | 'image', urlPath: string): Promise<void> {
  // Check if user has disabled this toast
  let shouldShow = false;
  if (type === 'word') {
    shouldShow = !(await ChromeStorage.getDontShowWordBookmarkSavedLinkToast());
  } else if (type === 'paragraph') {
    shouldShow = !(await ChromeStorage.getDontShowTextBookmarkSavedLinkToast());
  } else if (type === 'link') {
    shouldShow = !(await ChromeStorage.getDontShowLinkBookmarkSavedLinkToast());
  } else if (type === 'image') {
    shouldShow = !(await ChromeStorage.getDontShowImageBookmarkSavedLinkToast());
  }

  if (!shouldShow) {
    console.log('[Content Script] Bookmark toast disabled by user preference');
    return;
  }

  const fullUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}${urlPath}`;
  bookmarkToastUrl = fullUrl;
  bookmarkToastType = type;
  bookmarkToastClosing = false;
  
  injectBookmarkToast();
  updateBookmarkToast();
}

/**
 * Inject Bookmark Toast into the page with Shadow DOM
 */
async function injectBookmarkToast(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(BOOKMARK_TOAST_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: BOOKMARK_TOAST_HOST_ID,
    zIndex: 2147483648, // Same as regular toast
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
  // Inject bookmark saved toast styles from CSS file
  injectStyles(shadow, bookmarkSavedToastStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  bookmarkToastRoot = ReactDOM.createRoot(mountPoint);
  updateBookmarkToast();

  console.log('[Content Script] Bookmark Toast injected successfully');
}

/**
 * Update bookmark toast visibility based on state
 */
function updateBookmarkToast(): void {
  if (!bookmarkToastRoot) {
    console.warn('[Content Script] bookmarkToastRoot is null, cannot update bookmark toast');
    return;
  }

  if (bookmarkToastUrl && bookmarkToastType) {
    console.log('[Content Script] Rendering bookmark toast with URL:', bookmarkToastUrl, 'type:', bookmarkToastType, 'closing:', bookmarkToastClosing);
    
    const handleOkay = () => {
      bookmarkToastClosing = true;
      updateBookmarkToast();
      setTimeout(() => {
        bookmarkToastUrl = null;
        bookmarkToastType = null;
        bookmarkToastClosing = false;
        updateBookmarkToast();
      }, 300);
    };

    const handleDontShowAgain = async () => {
      // Set ALL storage flags to disable toast for all entity types (global preference)
      await ChromeStorage.setDontShowWordBookmarkSavedLinkToast(true);
      await ChromeStorage.setDontShowTextBookmarkSavedLinkToast(true);
      await ChromeStorage.setDontShowLinkBookmarkSavedLinkToast(true);
      await ChromeStorage.setDontShowImageBookmarkSavedLinkToast(true);
      
      bookmarkToastClosing = true;
      updateBookmarkToast();
      setTimeout(() => {
        bookmarkToastUrl = null;
        bookmarkToastType = null;
        bookmarkToastClosing = false;
        updateBookmarkToast();
      }, 300);
    };

    bookmarkToastRoot.render(
      React.createElement(BookmarkSavedToast, {
        bookmarkType: bookmarkToastType,
        url: bookmarkToastUrl,
        isClosing: bookmarkToastClosing,
        onOkay: handleOkay,
        onDontShowAgain: handleDontShowAgain,
        useShadowDom: true,
      })
    );
  } else {
    console.log('[Content Script] Clearing bookmark toast');
    bookmarkToastRoot.render(React.createElement(React.Fragment));
  }
}

// =============================================================================
// WARNING TOAST INJECTION
// =============================================================================

/**
 * Show warning toast for native language setting
 */
async function showWarningToast(): Promise<void> {
  warningToastVisible = true;
  warningToastClosing = false;
  
  await injectWarningToast();
  updateWarningToast();
}

/**
 * Inject Warning Toast into the page with Shadow DOM
 */
async function injectWarningToast(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(WARNING_TOAST_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: WARNING_TOAST_HOST_ID,
    zIndex: 2147483649, // Higher than regular toast
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);

  // Inject styles for animations
  const styles = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
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
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  injectStyles(shadow, styles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  warningToastRoot = ReactDOM.createRoot(mountPoint);
  updateWarningToast();

  console.log('[Content Script] Warning Toast injected successfully');
}

/**
 * Update warning toast visibility based on state
 */
function updateWarningToast(): void {
  if (!warningToastRoot) {
    console.warn('[Content Script] warningToastRoot is null, cannot update warning toast');
    return;
  }

  if (warningToastVisible) {
    console.log('[Content Script] Rendering warning toast, closing:', warningToastClosing);
    
    const handleClose = () => {
      warningToastClosing = true;
      updateWarningToast();
      setTimeout(() => {
        warningToastVisible = false;
        warningToastClosing = false;
        updateWarningToast();
      }, 300);
    };

    const settingsUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/user/account/settings`;
    
    const handleLinkClick = (e: MouseEvent) => {
      e.preventDefault();
      window.open(settingsUrl, '_blank');
    };

    // Create Settings icon SVG (from lucide-react Settings icon)
    const settingsIcon = React.createElement(
      'svg',
      {
        width: '16',
        height: '16',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2.5',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }
      },
      React.createElement('path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }),
      React.createElement('circle', { cx: '12', cy: '12', r: '3' })
    );

    // Create X icon for close button
    const closeIcon = React.createElement(
      'svg',
      {
        width: '16',
        height: '16',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2.5',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      React.createElement('path', { d: 'M18 6 6 18' }),
      React.createElement('path', { d: 'M6 6l12 12' })
    );

    // Use bright yellow color
    const yellowColor = '#F59E0B'; // Bright amber/yellow

    const toastElement = React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2147483649,
        }
      },
      React.createElement(
        'div',
        {
          style: {
            background: 'var(--color-bg-primary-theme)',
            border: `2px solid ${yellowColor}`,
            color: yellowColor,
            padding: '0.75rem 1rem',
            borderRadius: '13px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '0.9375rem',
            fontWeight: '500',
            animation: warningToastClosing ? 'slideOut 0.3s ease-in forwards' : 'slideIn 0.3s ease-out',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }
        },
        React.createElement(
          'div',
          { style: { flex: '1', lineHeight: '1.5' } },
          'Please set your native language in ',
          React.createElement(
            'a',
            {
              href: settingsUrl,
              onClick: handleLinkClick,
              style: {
                color: yellowColor,
                textDecoration: 'underline',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '4px',
              },
              onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.opacity = '0.8';
              },
              onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.opacity = '1';
              },
            },
            settingsIcon,
            'settings'
          ),
          '. If done, please ',
          React.createElement(
            'a',
            {
              href: '#',
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                // Close the warning toast
                handleClose();
                // Open settings side panel
                setSidePanelOpen(true, 'settings');
              },
              style: {
                color: yellowColor,
                textDecoration: 'underline',
                fontWeight: '600',
                cursor: 'pointer',
              },
              onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.opacity = '0.8';
              },
              onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.opacity = '1';
              },
            },
            'login'
          ),
          ' and refresh the page'
        ),
        React.createElement(
          'button',
          {
            onClick: handleClose,
            style: {
              flexShrink: '0',
              background: 'transparent',
              border: 'none',
              color: yellowColor,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: '0.7',
            },
            onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = `rgba(245, 158, 11, 0.1)`;
              e.currentTarget.style.opacity = '1';
            },
            onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.opacity = '0.7';
            },
          },
          closeIcon
        )
      )
    );
    
    warningToastRoot.render(toastElement);
  } else {
    console.log('[Content Script] Clearing warning toast');
    warningToastRoot.render(React.createElement(React.Fragment));
  }
}

// =============================================================================
// FOLDER LIST MODAL INJECTION
// =============================================================================

/**
 * Inject Folder List Modal into the page with Shadow DOM
 */
async function injectFolderListModal(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(FOLDER_LIST_MODAL_HOST_ID)) {
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: FOLDER_LIST_MODAL_HOST_ID,
    zIndex: 2147483646, // Below toast
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
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
    console.log('[Content Script] Rendering folder list modal with', folderModalFolders.length, 'folders, mode:', folderModalMode);
    
    // Determine which save handler and create folder handler to use based on mode
    const saveHandler = folderModalMode === 'link' 
      ? handleFolderModalSaveForLink 
      : folderModalMode === 'word'
      ? handleFolderModalSaveForWord
      : folderModalMode === 'image'
      ? handleFolderModalSaveForImage
      : handleFolderModalSave;
    const createFolderHandler = folderModalMode === 'link'
      ? handleCreateLinkFolder
      : handleCreateParagraphFolder; // Use paragraph folder handler for both paragraph, word, and image modes
    
    // Check if the selected folder matches the stored preference (unified for all bookmark types)
    const storedFolderId = await ChromeStorage.getBookmarkPreferenceFolderId();
    // Only initialize checkbox state from storage if not already initialized by user
    // This prevents overwriting user's manual checkbox changes
    if (!folderModalRememberCheckedInitialized) {
      const rememberFolderChecked = folderModalSelectedFolderId !== null && 
                                     folderModalSelectedFolderId === storedFolderId;
      folderModalRememberChecked = rememberFolderChecked;
      folderModalRememberCheckedInitialized = true;
      console.log('[Content Script] Initial checkbox state:', rememberFolderChecked, 'Selected folder:', folderModalSelectedFolderId, 'Stored folder:', storedFolderId);
    } else {
      console.log('[Content Script] Checkbox state preserved (user modified):', folderModalRememberChecked, 'Selected folder:', folderModalSelectedFolderId, 'Stored folder:', storedFolderId);
    }
    
    // Handler for remember folder checkbox change
    const handleRememberFolderChange = async (checked: boolean) => {
      console.log('[Content Script] Checkbox changed to:', checked, 'Selected folder:', folderModalSelectedFolderId);
      folderModalRememberChecked = checked;
      folderModalRememberCheckedInitialized = true; // Mark as initialized by user
      // Don't save to storage here - wait until Save is clicked
      // This allows user to change checkbox state without immediately saving
      // Update modal to reflect the change
      updateFolderListModal();
    };
    
    // Handler for name change (only for link mode)
    const handleNameChange = (name: string) => {
      folderModalLinkName = name;
    };
    
    // Determine modal title based on mode and summary availability
    const modalTitle = folderModalMode === 'link' 
      ? (folderModalLinkSummary && folderModalLinkSummary.trim().length > 0 
          ? 'Save Page with summary' 
          : 'Save Page')
      : folderModalMode === 'word'
      ? 'Save Word'
      : folderModalMode === 'image'
      ? 'Save Image'
      : 'Save Text';
    
    folderListModalRoot.render(
      React.createElement(Provider, { store },
      React.createElement(FolderListModal, {
        folders: folderModalFolders,
        onSave: saveHandler,
        onClose: closeFolderListModal,
        useShadowDom: true,
        isSaving: folderModalSaving,
        onCreateFolder: createFolderHandler,
        isCreatingFolder: folderModalCreatingFolder,
        initialSelectedFolderId: folderModalSelectedFolderId,
        initialExpandedFolders: folderModalExpandedFolders,
        rememberFolderChecked: folderModalRememberChecked,
        onRememberFolderChange: handleRememberFolderChange,
        showNameInput: folderModalMode === 'link',
        initialName: folderModalMode === 'link' ? folderModalLinkName : undefined,
        onNameChange: folderModalMode === 'link' ? handleNameChange : undefined,
        modalTitle,
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
      onSuccess: async (response) => {
        console.log('[Content Script] Text saved successfully with id:', response.id);
        console.log('[Content Script] Checkbox state:', folderModalRememberChecked, 'Folder ID:', folderId);
        
        // If "Remember my folder" checkbox is checked, save the folder preference after successful save
        if (folderModalRememberChecked && folderId) {
          await ChromeStorage.setBookmarkPreferenceFolderId(folderId);
          console.log('[Content Script] Saved bookmark folder preference on save:', folderId);
          // Verify it was saved
          const verify = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Verified saved bookmark folder ID:', verify);
        } else if (!folderModalRememberChecked) {
          // If checkbox is unchecked, remove the preference after successful save
          await ChromeStorage.removeBookmarkPreferenceFolderId();
          console.log('[Content Script] Removed bookmark folder preference on save');
        }
        
        showToast('Text saved successfully!', 'success');
        showBookmarkToast('paragraph', '/user/saved-paragraphs');
        
        // Preserve folderModalText, folderModalRange, and folderModalParagraphSource before closing modal (which clears them)
        const savedText = folderModalText;
        const savedRange = folderModalRange;
        const savedParagraphSource = folderModalParagraphSource; // Preserve flag before modal closes
        console.log('[Content Script] Preserved paragraph source before closing modal:', savedParagraphSource);
        
        closeFolderListModal();
        
        // Add underline only after save succeeds
        let underlineState: UnderlineState | null = null;
        if (savedRange) {
          underlineState = await addTextUnderline(savedRange, 'primary');
          console.log('[Content Script] Added underline after successful bookmark save');
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
            underlineState: underlineState, // Use the underline we created after successful save
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
            
            // Only open panel if bookmark is NOT from ContentActions
            const isFromContentActions = savedParagraphSource === 'contentactions';
            console.log('[Content Script] Checking bookmark source:', { savedParagraphSource, isFromContentActions });
            if (!isFromContentActions) {
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
            } else {
              console.log('[Content Script] Bookmark from ContentActions - panel will not open');
            }
          }, 100);
          
          // Note: savedRange and savedText are local variables, no need to clear folderModalRange here
        } else {
          console.warn('[Content Script] No active explanation ID found when saving bookmark');
          
          // Add underline and icons if we have a range (fallback for saved paragraphs)
          if (folderModalRange) {
            await addSavedParagraphIcons(response.id, folderModalText, folderModalRange);
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
 * Handle save button click in folder modal for links
 */
async function handleFolderModalSaveForLink(folderId: string | null, name?: string): Promise<void> {
  console.log('[Content Script] Saving link to folder:', folderId, 'with name:', name);
  
  // Set saving state
  folderModalSaving = true;
  updateFolderListModal();
  
  // Use name parameter if provided, otherwise fall back to stored name
  const nameToSave = name || folderModalLinkName;
  const nameToSaveLimited = nameToSave.length > 50 ? nameToSave.substring(0, 50) : nameToSave;
  
  // Filter reference links from summary if available
  const filteredSummary = folderModalLinkSummary 
    ? filterReferenceLinks(folderModalLinkSummary) 
    : undefined;
  
  // Save link
  await SavedLinkService.saveLink(
    {
      url: folderModalLinkUrl,
      name: nameToSaveLimited || undefined,
      summary: filteredSummary,
      folder_id: folderId || undefined,
    },
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Link saved successfully with id:', response.id);
        console.log('[Content Script] Checkbox state:', folderModalRememberChecked, 'Folder ID:', folderId);
        
        // If "Remember my folder" checkbox is checked, save the folder preference after successful save
        if (folderModalRememberChecked && folderId) {
          await ChromeStorage.setBookmarkPreferenceFolderId(folderId);
          console.log('[Content Script] Saved bookmark folder preference on save:', folderId);
          // Verify it was saved
          const verify = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Verified saved bookmark folder ID:', verify);
        } else if (!folderModalRememberChecked) {
          // If checkbox is unchecked, remove the preference after successful save
          await ChromeStorage.removeBookmarkPreferenceFolderId();
          console.log('[Content Script] Removed bookmark folder preference on save');
        }
        
        showToast('Link saved successfully!', 'success');
        showBookmarkToast('link', '/user/saved-links');
        
        // Update bookmark icon state based on source
        if (folderModalMode === 'link') {
          if (folderModalLinkSource === 'fab') {
            fabSavedLinkId = response.id;
            updateFAB();
          } else if (folderModalLinkSource === 'sidepanel') {
            sidePanelSavedLinkId = response.id;
            updateSidePanel();
          }
        }
        
        closeFolderListModal();
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to save link:', errorCode, message);
        folderModalSaving = false;
        let displayMessage = 'Failed to save link';
        
        // Handle specific error codes
        if (errorCode === 'VAL_001') {
          displayMessage = 'URL is too long';
        } else if (errorCode === 'VAL_002') {
          displayMessage = 'Name is too long';
        } else if (errorCode === 'NOT_FOUND') {
          displayMessage = 'Folder not found';
        } else if (errorCode === 'NETWORK_ERROR') {
          displayMessage = 'Network error. Please check your connection.';
        } else if (message) {
          displayMessage = message;
        }
        
        updateFolderListModal();
        showToast(displayMessage, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to save link');
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to save link');
        closeFolderListModal();
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Convert File or Blob to data URL
 */
function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Handle save button click in folder modal for images
 */
async function handleFolderModalSaveForImage(folderId: string | null): Promise<void> {
  console.log('[Content Script] Saving image to folder:', folderId);
  
  if (!folderModalImageElement) {
    console.error('[Content Script] Missing image element for saving');
    showToast('Error: Missing image data', 'error');
    return;
  }
  
  // Set saving state
  folderModalSaving = true;
  updateFolderListModal();
  
  // Get image URL - prefer element src, fallback to converting file to data URL
  let imageUrl: string;
  if (folderModalImageElement.src && folderModalImageElement.src.startsWith('http')) {
    // Use the image element's src if it's a valid URL
    imageUrl = folderModalImageElement.src;
  } else if (folderModalImageFile) {
    // Convert File/Blob to data URL
    try {
      imageUrl = await fileToDataUrl(folderModalImageFile);
    } catch (error) {
      console.error('[Content Script] Failed to convert image to data URL:', error);
      folderModalSaving = false;
      updateFolderListModal();
      showToast('Error: Failed to process image', 'error');
      return;
    }
  } else {
    // Fallback: try to get src from element
    imageUrl = folderModalImageElement.src || '';
    if (!imageUrl) {
      console.error('[Content Script] No image URL available');
      folderModalSaving = false;
      updateFolderListModal();
      showToast('Error: No image URL available', 'error');
      return;
    }
  }
  
  // Save image
  await SavedImageService.saveImage(
    {
      sourceUrl: window.location.href,
      imageUrl: imageUrl,
      folderId: folderId || undefined,
      name: undefined, // Can be enhanced later to allow custom names
    },
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Image saved successfully with id:', response.id);
        console.log('[Content Script] Checkbox state:', folderModalRememberChecked, 'Folder ID:', folderId);
        
        // Find the explanation for this image and update it with savedImageId
        const explanations = store.get(imageExplanationsAtom);
        const explanation = Array.from(explanations.values()).find(
          (exp) => exp.imageElement === folderModalImageElement
        );
        
        if (explanation) {
          const updateExplanationInMap = (id: string, updater: (state: ImageExplanationState) => ImageExplanationState) => {
            const map = new Map(store.get(imageExplanationsAtom));
            const current = map.get(id);
            if (current) {
              map.set(id, updater(current));
              store.set(imageExplanationsAtom, map);
            }
          };
          
          updateExplanationInMap(explanation.id, (state) => ({
            ...state,
            savedImageId: response.id,
          }));
          
          // Update icon container to show bookmark icon
          updateImageExplanationIconContainer();
          
          // Update panel if it's currently open for this explanation
          const activeId = store.get(activeImageExplanationIdAtom);
          if (activeId === explanation.id) {
            updateImageExplanationPanel();
          }
        }
        
        // If "Remember my folder" checkbox is checked, save the folder preference after successful save
        if (folderModalRememberChecked && folderId) {
          await ChromeStorage.setBookmarkPreferenceFolderId(folderId);
          console.log('[Content Script] Saved bookmark folder preference on save:', folderId);
          // Verify it was saved
          const verify = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Verified saved bookmark folder ID:', verify);
        } else if (!folderModalRememberChecked) {
          // If checkbox is unchecked, remove the preference after successful save
          await ChromeStorage.removeBookmarkPreferenceFolderId();
          console.log('[Content Script] Removed bookmark folder preference on save');
        }
        
        showToast('Image saved successfully!', 'success');
        showBookmarkToast('image', '/user/saved-images');
        
        closeFolderListModal();
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to save image:', errorCode, message);
        folderModalSaving = false;
        updateFolderListModal();
        
        let displayMessage = 'Failed to save image';
        
        // Handle specific error codes
        if (errorCode === 'VAL_001') {
          displayMessage = 'Image URL is too long';
        } else if (errorCode === 'VAL_002') {
          displayMessage = 'Source URL is too long';
        } else if (errorCode === 'VAL_003') {
          displayMessage = 'Name is too long';
        } else if (errorCode === 'NOT_FOUND') {
          displayMessage = 'Folder not found';
        } else if (errorCode === 'NETWORK_ERROR') {
          displayMessage = 'Network error. Please check your connection.';
        } else if (message) {
          displayMessage = message;
        }
        
        showToast(displayMessage, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to save image');
        folderModalSaving = false;
        updateFolderListModal();
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to save image');
        folderModalSaving = false;
        updateFolderListModal();
        closeFolderListModal();
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Handle save button click in folder modal for words
 */
async function handleFolderModalSaveForWord(folderId: string | null): Promise<void> {
  console.log('[Content Script] Saving word to folder:', folderId);
  
  if (!folderModalWord || !folderModalWordId) {
    console.error('[Content Script] Missing word data for saving');
    showToast('Error: Missing word data', 'error');
    return;
  }
  
  // Set saving state
  folderModalSaving = true;
  updateFolderListModal();
  
  // Get word state
  const atomState = store.get(wordExplanationsAtom).get(folderModalWordId);
  if (!atomState) {
    console.error('[Content Script] Word state not found for wordId:', folderModalWordId);
    folderModalSaving = false;
    updateFolderListModal();
    showToast('Error: Word state not found', 'error');
    return;
  }
  
  // Update word state to show saving
  const newExplanations = new Map(store.get(wordExplanationsAtom));
  newExplanations.set(folderModalWordId, { ...atomState, isSavingWord: true });
  store.set(wordExplanationsAtom, newExplanations);
  updateWordExplanationPopover();
  
  // Save word
  SavedWordsService.saveWord(
    {
      word: folderModalWord,
      sourceUrl: window.location.href,
      contextualMeaning: folderModalWordContextualMeaning,
      folderId: folderId || undefined,
    },
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Word saved successfully with id:', response.id);
        console.log('[Content Script] Checkbox state:', folderModalRememberChecked, 'Folder ID:', folderId);
        
        // If "Remember my folder" checkbox is checked, save the folder preference after successful save
        if (folderModalRememberChecked && folderId) {
          await ChromeStorage.setBookmarkPreferenceFolderId(folderId);
          console.log('[Content Script] Saved bookmark folder preference on save:', folderId);
          // Verify it was saved
          const verify = await ChromeStorage.getBookmarkPreferenceFolderId();
          console.log('[Content Script] Verified saved bookmark folder ID:', verify);
        } else if (!folderModalRememberChecked) {
          // If checkbox is unchecked, remove the preference after successful save
          await ChromeStorage.removeBookmarkPreferenceFolderId();
          console.log('[Content Script] Removed bookmark folder preference on save');
        }
        
        // Update word state
        if (folderModalWordId) {
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(folderModalWordId);
          if (currentState) {
            updated.set(folderModalWordId, { ...currentState, isSaved: true, savedWordId: response.id, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
            
            // Update bookmark icon on word span
            const localState = wordExplanationsMap.get(folderModalWordId);
            if (localState?.wordSpanElement) {
              await applyGreenWordSpanStyling(localState.wordSpanElement, folderModalWordId, true);
            }
          }
        }
        
        showToast('Word saved successfully!', 'success');
        showBookmarkToast('word', '/user/saved-words');
        
        closeFolderListModal();
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to save word:', errorCode, message);
        folderModalSaving = false;
        updateFolderListModal();
        
        // Update word state to remove saving indicator
        if (folderModalWordId) {
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(folderModalWordId);
          if (currentState) {
            updated.set(folderModalWordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
        }
        
        let displayMessage = 'Failed to save word';
        
        // Handle specific error codes
        if (errorCode === 'NOT_FOUND') {
          displayMessage = 'Folder not found';
        } else if (errorCode === 'NETWORK_ERROR') {
          displayMessage = 'Network error. Please check your connection.';
        } else if (message) {
          displayMessage = message;
        }
        
        showToast(displayMessage, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to save word');
        folderModalSaving = false;
        updateFolderListModal();
        
        // Update word state to remove saving indicator
        if (folderModalWordId) {
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(folderModalWordId);
          if (currentState) {
            updated.set(folderModalWordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
        }
        
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to save word');
        folderModalSaving = false;
        updateFolderListModal();
        
        // Update word state to remove saving indicator
        if (folderModalWordId) {
          const updated = new Map(store.get(wordExplanationsAtom));
          const currentState = updated.get(folderModalWordId);
          if (currentState) {
            updated.set(folderModalWordId, { ...currentState, isSavingWord: false });
            store.set(wordExplanationsAtom, updated);
            updateWordExplanationPopover();
          }
        }
        
        closeFolderListModal();
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Handle create paragraph folder in folder modal
 */
async function handleCreateParagraphFolder(folderName: string, parentFolderId: string | null): Promise<void> {
  console.log('[Content Script] Creating paragraph folder:', folderName, 'with parent:', parentFolderId);
  
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
 * Handle create link folder in folder modal
 */
async function handleCreateLinkFolder(folderName: string, parentFolderId: string | null): Promise<void> {
  console.log('[Content Script] Creating link folder:', folderName, 'with parent:', parentFolderId);
  
  // Set creating state
  folderModalCreatingFolder = true;
  updateFolderListModal();
  
  // Create folder
  SavedLinkService.createLinkFolder(
    {
      name: folderName,
      parent_folder_id: parentFolderId || undefined,
    },
    {
      onSuccess: (response) => {
        console.log('[Content Script] Link folder created successfully with id:', response.id);
        
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
        console.error('[Content Script] Failed to create link folder:', errorCode, message);
        folderModalCreatingFolder = false;
        updateFolderListModal();
        showToast(`Failed to create folder: ${message}`, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to create link folder');
        closeFolderListModal();
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to create link folder');
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
  folderModalRememberCheckedInitialized = false; // Reset initialization flag
  // Clear link-specific state
  folderModalMode = null;
  folderModalLinkUrl = '';
  folderModalLinkName = '';
  folderModalLinkSummary = null;
  folderModalLinkSource = null;
  // Clear paragraph source flag
  folderModalParagraphSource = null;
  // Clear word-specific state
  folderModalWord = null;
  folderModalWordContextualMeaning = null;
  folderModalWordId = null;
  // Clear image-specific state
  folderModalImageElement = null;
  folderModalImageFile = null;
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
// FAB SAVE LINK MODAL INJECTION
// =============================================================================

/**
 * Handle FAB Save page link button click
 */
async function handleFabSaveUrlClick(): Promise<void> {
  console.log('[Content Script] FAB Save page link clicked');
  
  // If already bookmarked, remove the saved link
  if (fabSavedLinkId) {
    await handleFabRemoveLink();
    return;
  }
  
  // Get summary from state
  const summary = store.get(summaryAtom);
  
  // Get current URL and page title
  const currentUrl = window.location.href;
  const pageTitle = document.title || '';
  
  // Truncate page title to 100 characters
  const truncatedTitle = pageTitle.length > 100 ? pageTitle.substring(0, 100) : pageTitle;
  
  // Set modal mode and state
  folderModalMode = 'link';
  folderModalLinkSource = 'fab';
  folderModalLinkUrl = currentUrl.length > 1024 ? currentUrl.substring(0, 1024) : currentUrl;
  folderModalLinkName = truncatedTitle;
  folderModalLinkSummary = summary && summary.trim().length > 0 ? summary : null;
  
  // Get folders and show modal
  FolderService.getAllFolders(
    {
      onSuccess: async (response) => {
        console.log('[Content Script] Folders loaded successfully for FAB link:', response.folders.length, 'folders');
        folderModalFolders = response.folders;
        
        // Check for stored preference folder ID and auto-select/expand if found
        const storedFolderId = await ChromeStorage.getLinkBookmarkPreferenceFolderId();
        console.log('[Content Script] Retrieved stored link folder ID from storage:', storedFolderId);
        if (storedFolderId) {
          const ancestorPath = findFolderAndGetAncestorPath(response.folders, storedFolderId);
          if (ancestorPath !== null) {
            folderModalSelectedFolderId = storedFolderId;
            // Expand all ancestor folders to show the hierarchical path
            folderModalExpandedFolders = new Set(ancestorPath);
            console.log('[Content Script] Auto-selected preferred link folder:', storedFolderId, 'with ancestors:', ancestorPath);
          } else {
            folderModalSelectedFolderId = null;
            folderModalExpandedFolders = new Set();
            console.log('[Content Script] Stored link folder ID not found in tree, clearing selection. Stored ID:', storedFolderId, 'Available folders:', response.folders);
          }
        } else {
          folderModalSelectedFolderId = null;
          folderModalExpandedFolders = new Set();
          console.log('[Content Script] No stored link folder preference found');
        }
        
        folderModalRememberCheckedInitialized = false; // Reset flag when modal opens
        folderModalOpen = true;
        injectFolderListModal();
        updateFolderListModal();
      },
      onError: (errorCode, message) => {
        console.error('[Content Script] Failed to load folders for FAB link:', errorCode, message);
        showToast(`Failed to load folders: ${message}`, 'error');
        folderModalMode = null;
        folderModalLinkUrl = '';
        folderModalLinkName = '';
        folderModalLinkSummary = null;
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required to load folders for FAB link');
        folderModalMode = null;
        folderModalLinkUrl = '';
        folderModalLinkName = '';
        folderModalLinkSummary = null;
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required to load folders for FAB link');
        folderModalMode = null;
        folderModalLinkUrl = '';
        folderModalLinkName = '';
        folderModalLinkSummary = null;
        store.set(showSubscriptionModalAtom, true);
      },
    }
  );
}

/**
 * Handle FAB Remove Link
 */
async function handleFabRemoveLink(): Promise<void> {
  if (!fabSavedLinkId) {
    showToast('No saved link to remove', 'error');
    return;
  }

  const linkIdToRemove = fabSavedLinkId;

  await SavedLinkService.removeSavedLink(
    linkIdToRemove,
    {
      onSuccess: () => {
        console.log('[Content Script] FAB link removed successfully');
        fabSavedLinkId = null; // Clear saved link ID
        updateFAB(); // Update FAB to show unfilled bookmark icon
        showToast('Link removed successfully!', 'success');
      },
      onError: (errorCode, errorMessage) => {
        console.error('[Content Script] Failed to remove FAB link:', errorCode, errorMessage);
        let displayMessage = 'Failed to remove link';
        
        if (errorCode === 'NOT_FOUND') {
          displayMessage = 'Link not found';
          // Clear saved link ID if link doesn't exist
          fabSavedLinkId = null;
          updateFAB();
        } else if (errorCode === 'NETWORK_ERROR') {
          displayMessage = 'Network error. Please check your connection.';
        } else if (errorMessage) {
          displayMessage = errorMessage;
        }
        
        showToast(displayMessage, 'error');
      },
      onLoginRequired: () => {
        console.log('[Content Script] Login required for removing FAB link');
        store.set(showLoginModalAtom, true);
      },
      onSubscriptionRequired: () => {
        console.log('[Content Script] Subscription required for removing FAB link');
        showToast('Subscription required to remove links', 'error');
      },
    }
  );
}


// =============================================================================
// LOGIN MODAL INJECTION
// =============================================================================

/**
 * Inject Login Modal into the page with Shadow DOM
 */
async function injectLoginModal(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
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
 * Apply blur effect to background components when login, subscription, or feature request modal is visible
 */
function updateBackgroundBlur(): void {
  const isLoginModalVisible = store.get(showLoginModalAtom);
  const isSubscriptionModalVisible = store.get(showSubscriptionModalAtom);
  const isFeatureRequestModalVisible = store.get(showFeatureRequestModalAtom);
  const isAnyModalVisible = isLoginModalVisible || isSubscriptionModalVisible || isFeatureRequestModalVisible;

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
async function injectSubscriptionModal(): Promise<void> {
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

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
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
// FEATURE REQUEST MODAL INJECTION
// =============================================================================

/**
 * Inject Feature Request Modal into the page with Shadow DOM
 */
async function injectFeatureRequestModal(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(FEATURE_REQUEST_MODAL_HOST_ID)) {
    console.log('[Content Script] Feature Request Modal already injected');
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: FEATURE_REQUEST_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index for modal
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
  // Inject component styles
  injectStyles(shadow, featureRequestModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  featureRequestModalRoot = ReactDOM.createRoot(mountPoint);
  featureRequestModalRoot.render(
    React.createElement(Provider, { store },
      React.createElement(FeatureRequestModal, {
        useShadowDom: true,
      })
    )
  );

  console.log('[Content Script] Feature Request Modal injected successfully');
}

/**
 * Remove Feature Request Modal from the page
 */
function removeFeatureRequestModal(): void {
  removeShadowHost(FEATURE_REQUEST_MODAL_HOST_ID, featureRequestModalRoot);
  featureRequestModalRoot = null;
  console.log('[Content Script] Feature Request Modal removed');
}

// =============================================================================
// WELCOME MODAL INJECTION
// =============================================================================

/**
 * Inject Welcome Modal into the page with Shadow DOM
 */
async function injectWelcomeModal(): Promise<void> {
  // Check if already injected
  if (shadowHostExists(WELCOME_MODAL_HOST_ID)) {
    console.log('[Content Script] Welcome Modal already injected');
    updateWelcomeModal();
    return;
  }

  // Create Shadow DOM host
  const { host, shadow, mountPoint } = createShadowHost({
    id: WELCOME_MODAL_HOST_ID,
    zIndex: 2147483647, // Highest z-index for modal
  });

  // Inject color CSS variables first - get theme-aware variables
  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables, true);
  
  // Inject component styles
  injectStyles(shadow, welcomeModalStyles);

  // Append to document
  document.body.appendChild(host);

  // Render React component
  welcomeModalRoot = ReactDOM.createRoot(mountPoint);
  updateWelcomeModal();

  console.log('[Content Script] Welcome Modal injected successfully');
}

/**
 * Update welcome modal visibility based on state
 */
function updateWelcomeModal(): void {
  if (!welcomeModalRoot) return;

  welcomeModalRoot.render(
    React.createElement(WelcomeModal, {
      visible: welcomeModalVisible,
      onOk: handleWelcomeModalOk,
      onDontShowAgain: handleWelcomeModalDontShowAgain,
    })
  );
}

/**
 * Remove Welcome Modal from the page
 */
function removeWelcomeModal(): void {
  removeShadowHost(WELCOME_MODAL_HOST_ID, welcomeModalRoot);
  welcomeModalRoot = null;
  console.log('[Content Script] Welcome Modal removed');
}

/**
 * Handle "Ok" button click
 */
function handleWelcomeModalOk(): void {
  welcomeModalVisible = false;
  updateWelcomeModal();
}

/**
 * Handle "Don't show me again" button click
 */
async function handleWelcomeModalDontShowAgain(): Promise<void> {
  await ChromeStorage.setDontShowWelcomeModal(true);
  welcomeModalVisible = false;
  updateWelcomeModal();
}

// =============================================================================
// YOUTUBE WATCH PAGE INITIALIZATION
// =============================================================================

/**
 * Inject YouTube Ask AI button into the page
 * NOTE: YouTube Ask AI button feature is currently disabled
 */
async function injectYouTubeAskAIButton(): Promise<void> {
  // YouTube Ask AI button is disabled - feature not available
  return;
}

/**
 * Remove YouTube Ask AI button from the page
 */
function removeYouTubeAskAIButton(): void {
  const host = document.getElementById(YOUTUBE_ASK_AI_BUTTON_HOST_ID);
  if (host) {
    host.remove();
  }
  if (youtubeAskAIButtonRoot) {
    youtubeAskAIButtonRoot.unmount();
    youtubeAskAIButtonRoot = null;
  }
  console.log('[Content Script] YouTube Ask AI button removed');
}

/**
 * Initialize YouTube watch page
 */
async function initYouTubeWatchPage(): Promise<void> {
  console.log('[Content Script] Initializing YouTube watch page...');
  
  // Check domain status - don't inject button if domain is BANNED
  const currentDomain = extractDomain(window.location.href);
  if (currentDomain) {
    const domainStatus = await ChromeStorage.getDomainStatus(currentDomain);
    if (domainStatus === DomainStatus.BANNED) {
      console.log(`[Content Script] Domain "${currentDomain}" is BANNED - YouTube Ask AI button will not be shown`);
      removeYouTubeAskAIButton();
      return;
    }
  }
  
  // Wait a bit for page to fully load
  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }
  
  // Additional wait for YouTube's dynamic content
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  await injectYouTubeAskAIButton();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Handle xplaino_text query parameter for auto-search
 */
function handleXplainoTextSearch(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const searchText = urlParams.get('xplaino_text');
  
  if (searchText) {
    // Wait for DOM to be ready, then search
    setTimeout(() => {
      // window.find() is a non-standard but widely supported API
      const found = (window as any).find(searchText, false, false, false, false, false);
      if (found) {
        console.log(`[Content Script] Found and highlighted: "${searchText}"`);
      } else {
        console.log(`[Content Script] Text not found: "${searchText}"`);
      }
    }, 100);
  }
}

/**
 * Main content script logic
 */
async function initContentScript(): Promise<void> {
  // Initialize auth state before any component injection
  await initializeAuthState();
  
  // Sync user account settings from backend API (on each URL load)
  // This also ensures extension settings exist with default value
  await UserSettingsService.syncUserAccountSettings();
  await ChromeStorage.ensureUserExtensionSettings();
  
  // Handle xplaino_text query parameter for auto-search
  handleXplainoTextSearch();
  
  // Handle YouTube pages separately
  if (isYouTubePage()) {
    console.log('[Content Script] YouTube page detected');
    
    // Remove any standard features that might have been injected
    removeFAB();
    removeSidePanel();
    removeContentActions();
    removeLoginModal();
    removeSubscriptionModal();
    removeFeatureRequestModal();
    removeTextExplanationPanel();
    removeTextExplanationIconContainer();
    removeImageExplanationPanel();
    removeImageExplanationIconContainer();
    removeToast();
    removeWelcomeModal();
    
    // For watch pages, inject the Ask AI button
    if (isYouTubeWatchPage()) {
      await initYouTubeWatchPage();
    }
    
    return;
  }
  
  const allowed = await isExtensionAllowed();
  
  if (allowed) {
    console.log('[Content Script] Running content script functionality...');
    // Inject all components in parallel with proper async handling
    await Promise.all([
      injectFAB(),
      injectSidePanel(),
      injectContentActions(),
      injectLoginModal(),
      injectSubscriptionModal(),
      injectFeatureRequestModal(),
      injectToast(),
      injectImageExplanationIconContainer(),
      injectImageExplanationPanel(),
    ]);
    setupImageHoverDetection();
    
    // Check if welcome modal should be shown
    // Only show if domain is not BANNED or DISABLED
    const currentDomain = extractDomain(window.location.href);
    if (currentDomain) {
      const domainStatus = await ChromeStorage.getDomainStatus(currentDomain);
      const dontShowWelcomeModal = await ChromeStorage.getDontShowWelcomeModal();
      
      // Only show modal if:
      // 1. User hasn't clicked "Don't show me again"
      // 2. Domain status is ENABLED or not set (null = default enabled)
      if (!dontShowWelcomeModal && 
          (domainStatus === null || domainStatus === DomainStatus.ENABLED)) {
        // Show modal after a short delay to ensure page is loaded
        setTimeout(async () => {
          welcomeModalVisible = true;
          await injectWelcomeModal();
        }, 500);
      } else {
        console.log('[Content Script] Welcome modal not shown:', {
          dontShowWelcomeModal,
          domainStatus,
        });
      }
    }
  } else {
    console.log('[Content Script] Not running - extension not allowed on this page');
    removeFAB();
    removeSidePanel();
    removeContentActions();
    removeLoginModal();
    removeSubscriptionModal();
    removeFeatureRequestModal();
    removeTextExplanationPanel();
    removeTextExplanationIconContainer();
    removeImageExplanationPanel();
    removeImageExplanationIconContainer();
    removeToast();
    removeWelcomeModal();
    removeYouTubeAskAIButton();
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
async function addSavedParagraphIcons(paragraphId: string, selectedText: string, range: Range): Promise<void> {
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
  
  // Add dashed underline for bookmarked text
  const underlineState = await addTextUnderline(range, 'primary');
  
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
async function injectSavedParagraphIconContainer(): Promise<void> {
  if (shadowHostExists(SAVED_PARAGRAPH_ICON_HOST_ID)) {
    updateSavedParagraphIconContainer();
    return;
  }

  const { host, shadow, mountPoint } = createShadowHost({
    id: SAVED_PARAGRAPH_ICON_HOST_ID,
    zIndex: 2147483647, // Highest z-index
  });

  const colorVariables = await getAllColorVariables();
  injectStyles(shadow, colorVariables);
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

store.sub(showFeatureRequestModalAtom, () => {
  updateBackgroundBlur();
});

// Debounce timer for theme refresh to prevent duplicate calls
let themeRefreshTimer: number | null = null;
// Track if a theme refresh is currently in progress
let themeRefreshInProgress = false;
// Track if another refresh should run after the current one completes
let themeRefreshPending = false;

/**
 * Check if a style element contains color variables CSS
 * More specific detection to avoid removing component styles
 */
function isColorVariablesStyle(styleElement: HTMLStyleElement): boolean {
  const content = styleElement.textContent || '';
  
  // Check for data attribute first (most reliable)
  if (styleElement.getAttribute('data-xplaino-color-variables') === 'true') {
    return true;
  }
  
  // Check for :host selector (color variables use :host)
  if (content.includes(':host') && content.includes('--color-')) {
    return true;
  }
  
  // Check for multiple color variable markers (more specific than just --color-primary)
  const colorVariableMarkers = [
    '--color-primary:',
    '--color-bg-primary-theme:',
    '--color-text-primary-theme:',
    '--color-bg-secondary-theme:',
    '--color-border-default-theme:',
  ];
  
  const markerCount = colorVariableMarkers.filter(marker => content.includes(marker)).length;
  // If it has 3+ color variable markers, it's likely the color variables style
  // This avoids matching component styles that might reference one or two variables
  return markerCount >= 3;
}

/**
 * Refresh theme CSS variables in all Shadow DOM roots
 * Improved debouncing with race condition prevention
 */
async function refreshThemeInAllShadowRoots(): Promise<void> {
  console.log('[Content Script] refreshThemeInAllShadowRoots called');
  
  // If a refresh is currently in progress, mark that another one is needed
  if (themeRefreshInProgress) {
    console.log('[Content Script] Refresh in progress, marking pending refresh');
    themeRefreshPending = true;
    return;
  }
  
  // Clear any pending debounce timer
  if (themeRefreshTimer !== null) {
    clearTimeout(themeRefreshTimer);
    themeRefreshTimer = null;
  }
  
  // Debounce: wait a bit to batch multiple rapid calls
  return new Promise((resolve) => {
    themeRefreshTimer = window.setTimeout(async () => {
      // Mark refresh as in progress
      themeRefreshInProgress = true;
      themeRefreshPending = false;
      
      try {
        // Get current theme
        const currentTheme = await getCurrentTheme();
        console.log('[Content Script] Current theme resolved:', currentTheme);
        
        // Get theme-specific CSS variables
        const themeCSS = await getAllColorVariables(currentTheme, true);
        console.log('[Content Script] Theme CSS generated, length:', themeCSS.length);
        
        // List of all host IDs that have color variables injected
        const hostIds = [
          FAB_HOST_ID,
          SIDE_PANEL_HOST_ID,
          CONTENT_ACTIONS_HOST_ID,
          TEXT_EXPLANATION_PANEL_HOST_ID,
          TEXT_EXPLANATION_ICON_HOST_ID,
          IMAGE_EXPLANATION_PANEL_HOST_ID,
          IMAGE_EXPLANATION_ICON_HOST_ID,
          WORD_EXPLANATION_POPOVER_HOST_ID,
          WORD_ASK_AI_PANEL_HOST_ID,
          DISABLE_MODAL_HOST_ID,
          TOAST_HOST_ID,
          BOOKMARK_TOAST_HOST_ID,
          WARNING_TOAST_HOST_ID,
          FOLDER_LIST_MODAL_HOST_ID,
          LOGIN_MODAL_HOST_ID,
          SUBSCRIPTION_MODAL_HOST_ID,
          FEATURE_REQUEST_MODAL_HOST_ID,
          WELCOME_MODAL_HOST_ID,
          YOUTUBE_ASK_AI_BUTTON_HOST_ID,
          SAVED_PARAGRAPH_ICON_HOST_ID,
        ];
        
        let updatedCount = 0;
        
        // Update theme CSS in all shadow roots
        for (const hostId of hostIds) {
          const host = document.getElementById(hostId);
          if (!host) {
            console.log('[Content Script] Host not found:', hostId);
            continue;
          }
          
          if (!host.shadowRoot) {
            console.log('[Content Script] Shadow root not found for:', hostId);
            continue;
          }
          
          const shadow = host.shadowRoot;
          
          // Log all styles before modification
          const allStylesBefore = Array.from(shadow.querySelectorAll('style'));
          console.log(`[Content Script] ${hostId}: Found ${allStylesBefore.length} style elements before refresh`);
          
          // Find and remove existing color variable style elements
          const existingStyles = Array.from(shadow.querySelectorAll('style'));
          let colorStyleElement: HTMLStyleElement | null = null;
          let firstComponentStyle: HTMLStyleElement | null = null;
          
          for (const style of existingStyles) {
            if (isColorVariablesStyle(style)) {
              colorStyleElement = style;
              console.log(`[Content Script] ${hostId}: Found color variables style to remove`);
            } else if (!firstComponentStyle) {
              // First non-color-variables style is likely a component style
              firstComponentStyle = style;
            }
          }
          
          // Remove color variables style if found
          if (colorStyleElement) {
            colorStyleElement.remove();
            console.log(`[Content Script] ${hostId}: Removed old theme CSS`);
          }
          
          // Inject new theme CSS in the correct position
          // CRITICAL: Color variables MUST be injected FIRST, before any component styles
          // Component styles use `:host { all: initial }` which can cause issues if order is wrong
          const newStyleElement = document.createElement('style');
          newStyleElement.setAttribute('data-xplaino-color-variables', 'true');
          newStyleElement.textContent = themeCSS;
          
          // Find the first style element (if any) to insert before it
          // This ensures color variables are always before component styles
          const firstStyleElement = shadow.querySelector('style');
          if (firstStyleElement) {
            // Insert before first style element (which should be component styles)
            shadow.insertBefore(newStyleElement, firstStyleElement);
            console.log(`[Content Script] ${hostId}: Injected new theme CSS before first component style`);
          } else {
            // No styles yet, insert at beginning (before mount point)
            if (shadow.firstChild) {
              shadow.insertBefore(newStyleElement, shadow.firstChild);
            } else {
              shadow.appendChild(newStyleElement);
            }
            console.log(`[Content Script] ${hostId}: Injected new theme CSS at beginning (no other styles)`);
          }
          
          updatedCount++;
          
          // Log styles after modification
          const allStylesAfter = Array.from(shadow.querySelectorAll('style'));
          console.log(`[Content Script] ${hostId}: Now has ${allStylesAfter.length} style elements after refresh`);
          
          // Verify the color variables style was injected correctly
          const injectedStyle = shadow.querySelector('style[data-xplaino-color-variables="true"]');
          if (injectedStyle) {
            const hasThemeVars = injectedStyle.textContent?.includes('--color-bg-primary-theme:');
            console.log(`[Content Script] ${hostId}: Color variables style verified, has theme vars:`, hasThemeVars);
          } else {
            console.warn(`[Content Script] ${hostId}: WARNING - Color variables style not found after injection!`);
          }
        }
        
        console.log('[Content Script] Theme refresh complete. Updated', updatedCount, 'shadow roots');
        resolve();
      } catch (error) {
        console.error('[Content Script] Error refreshing theme:', error);
        resolve();
      } finally {
        themeRefreshTimer = null;
        themeRefreshInProgress = false;
        
        // If another refresh was requested while this one was running, trigger it now
        if (themeRefreshPending) {
          console.log('[Content Script] Pending refresh detected, triggering now');
          themeRefreshPending = false;
          // Use setTimeout to avoid call stack issues
          setTimeout(() => refreshThemeInAllShadowRoots(), 0);
        }
      }
    }, 50); // 50ms debounce
  });
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
  
  // Listen for theme changes
  if (areaName === 'local') {
    const themeKeys = [
      ChromeStorage.KEYS.USER_SETTING_GLOBAL_THEME, // Legacy - kept for backwards compatibility
      ChromeStorage.KEYS.USER_SETTING_THEME_ON_SITE, // Legacy - kept for backwards compatibility
      'xplaino-user-account-settings', // New account settings
      'xplaino-user-extension-settings', // New extension settings
    ];
    
    const themeChanged = themeKeys.some((key) => changes[key]);
    if (themeChanged) {
      console.log('[Content Script] Theme storage changed detected:', Object.keys(changes));
      
      // Update theme atom
      getCurrentTheme().then((newTheme) => {
        store.set(currentThemeAtom, newTheme);
        console.log('[Content Script] Theme atom updated to:', newTheme);
      });
      
      refreshThemeInAllShadowRoots();
    }
  }
});

// Listen for custom login required event
window.addEventListener('xplaino:login-required', () => {
  console.log('[Content Script] Login required event received');
  store.set(showLoginModalAtom, true);
});

// Listen for YouTube transcript segments from page context
window.addEventListener('message', (event: MessageEvent) => {
  try {
    // Only accept messages from the same origin (YouTube page)
    if (event.origin !== window.location.origin) {
      return;
    }
    
    // Check if this is a transcript message
    if (event.data && event.data.type === 'XPLAINO_YOUTUBE_TRANSCRIPT') {
      const segments = event.data.segments;
      console.log('[Content Script] Received YouTube transcript segments:', segments);
      console.log('[Content Script] Number of segments:', segments?.length || 0);
      
      // Update the atom with the segments
      store.set(youtubeTranscriptSegmentsAtom, segments);
      
      // Console log the segments as requested
      console.log('[Content Script] YouTube transcript segments saved to state:', segments);
    }
  } catch (error) {
    console.error('[Content Script] Error handling transcript message:', error);
  }
});

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

// Handle YouTube SPA navigation (pushState/popState)
if (isYouTubePage()) {
  let lastUrl = window.location.href;
  
  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      initContentScript();
      handleXplainoTextSearch();
    }
  });
  
  // Intercept pushState and replaceState for YouTube SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        initContentScript();
        handleXplainoTextSearch();
      }
    }, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        initContentScript();
        handleXplainoTextSearch();
      }
    }, 100);
  };
  
  // Also listen for YouTube's custom navigation events
  document.addEventListener('yt-navigate-start', () => {
    removeYouTubeAskAIButton();
  });
  
  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => {
      initContentScript();
      handleXplainoTextSearch();
    }, 500);
  });
}

export {};
